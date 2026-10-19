import { ClientEvent, type MatrixClient } from 'matrix-js-sdk';
import type { RoomMessageEventContent } from 'matrix-js-sdk/lib/@types/events';
import { MatrixRTCSessionEvent } from 'matrix-js-sdk/lib/matrixrtc/MatrixRTCSession';
import { getMatrixClientService } from './matrixClientRegistry';
import {
	CallTimelineMessageService,
	TimelineClientUnavailableError
} from './callTimelineMessageService';
import type { CallData } from './CallManager';
import type { CallLifecycleMessage } from '../utils/callLifecycleMessage';
import { isMatrixRoomEncrypted } from '../utils/matrixRoomEncryption';

interface TrackedCall {
	message: CallLifecycleMessage;
	stop: () => void;
	writer: CallTimelineMessageService;
	isCurrentClient: () => boolean;
	retryAttempts: number;
	retryTimer?: ReturnType<typeof setTimeout>;
}

const TERMINAL_RETRY_DELAYS_MS = [1000, 2000, 4000] as const;

/** Keeps room timeline metadata tied to actual MatrixRTC attendance. */
class CallLifecycleTracker {
	private readonly calls = new Map<string, TrackedCall>();

	async begin(call: CallData): Promise<void> {
		if (this.calls.has(call.callId)) return;
		const first = getMatrixClientService()?.getClient?.();
		if (!first)
			throw new Error('Matrix client unavailable for call timeline');
		/*
		 * The client this call is tracked on, which can be REPLACED mid-call.
		 *
		 * A token refresh builds a new `MatrixClient` for the same account and
		 * tears the old one down. Capturing it in a `const` left every guard
		 * here comparing against an object the service had thrown away, so
		 * after an ordinary refresh: the membership listener was attached to a
		 * dead client and never fired again, the mismatch cleanup inside it
		 * was therefore never reached either, and the terminal write found
		 * `isCurrentClient()` false and gave up. The durable card stayed
		 * `running` for good — on a refresh the user cannot see or avoid.
		 *
		 * So it is a variable, and `onClientChange` moves it. Which is the
		 * mechanism `SessionStream` already uses for its room listeners; the
		 * tracker simply was not using it.
		 */
		let client = first;
		const ownUserId = first.getUserId?.() ?? undefined;
		/*
		 * The client this ACCOUNT is signed in with right now, or null.
		 *
		 * Every guard that asks "may this card still be written" wants the
		 * account, not the object. Asking the object question instead had two
		 * consequences that only show up around a token refresh, and both end
		 * the same way — a durable card stuck on `running`, on a surface the
		 * user cannot see or avoid:
		 *
		 *   - startup read a same-account replacement as an account change
		 *     and aborted, AFTER the root write had already published the
		 *     card;
		 *   - `finish` unsubscribes from `onClientChange` before the terminal
		 *     write has succeeded, so a refresh during the retry delay left
		 *     `client` pointing at the discarded instance and every retry was
		 *     silently abandoned.
		 *
		 * `client` stays a variable for the LISTENERS, which genuinely need
		 * an object to attach to; the writing guards ask here instead.
		 */
		const currentClient = (): MatrixClient | null => {
			const now = getMatrixClientService()?.getClient?.();
			if (!now) return null;
			if (ownUserId === undefined) {
				/*
				 * Nothing to compare accounts with. A client that cannot say
				 * who it is — an older SDK, a test double — leaves object
				 * identity as the only signal there is, which is what this
				 * guard used before and is still the safe answer: an unknown
				 * account is not knowably ours.
				 */
				return now === client ? now : null;
			}
			return (now.getUserId?.() ?? undefined) === ownUserId ? now : null;
		};
		/*
		 * Crypto first, then the card.
		 *
		 * `MatrixClientService.initializeClient` announces the replacement
		 * client BEFORE `initRustCrypto()` resolves — deliberately, so room
		 * listeners re-attach without missing events. For a listener that is
		 * right; for a WRITE into an encrypted counselling room it is not.
		 * A membership change or a hangup landing in that window reaches
		 * `sendMessage` on a client that cannot encrypt yet, and this card
		 * carries the participants' display names.
		 *
		 * A client that does not have the method at all cannot be asked —
		 * an older SDK, a test double — and is left alone; only one that
		 * answers "not yet" is made to wait. The wait is not a loss: the
		 * write throws `TimelineClientUnavailableError`, which `publish`
		 * retries for any state rather than only for a terminal one.
		 *
		 * Crypto alone is not enough. Right after a refresh the room is not
		 * loaded yet, and the SDK's `encryptEventIfNeeded` returns early for
		 * an unknown room — so the card would go out in plaintext. The room
		 * must be known to be encrypted too, as `publishCallIdentity` asks.
		 */
		const roomRef = call.signalRoomId || call.roomId;
		const canWrite = (client: MatrixClient): boolean =>
			typeof client.getCrypto !== 'function' ||
			(client.getCrypto() !== undefined &&
				isMatrixRoomEncrypted(client, roomRef));
		const writer = new CallTimelineMessageService(() => {
			const live = currentClient();
			const now = live && canWrite(live) ? live : null;
			return now
				? {
						sendMessage: (roomId, content, transactionId) =>
							now.sendMessage(
								roomId,
								// The SDK union only lists standard msgtypes; our builder
								// supplies the required body and an application msgtype.
								content as RoomMessageEventContent,
								transactionId
							)
					}
				: null;
		});
		const tracked: TrackedCall = {
			writer,
			isCurrentClient: () => currentClient() !== null,
			retryAttempts: 0,
			message: {
				callId: call.callId,
				roomRef,
				callRoomId: call.elementCallRoomId || call.roomId,
				state: 'running',
				callType: call.isVideo ? 'video' : 'audio',
				// Carried on the card so that rejoining it later does not have
				// to guess: the client-facing session's `isGroup` is false for a
				// supervision call inside a 1:1 session, and a call rejoined as
				// non-group is ended for everybody when one person leaves.
				isGroup: call.isGroup,
				// Whoever this client is, since this client is the one
				// starting the call. Nobody else can say it, and it is the
				// only thing on the card that the participant lists cannot
				// reconstruct.
				actorUserId: ownUserId,
				invitedAt: new Date().toISOString(),
				participants: []
			},
			stop: () => undefined
		};
		this.calls.set(call.callId, tracked);
		try {
			await tracked.writer.publish(tracked.message);
			const live = currentClient();
			if (live === null) {
				throw new Error(
					'The Matrix account changed during call startup'
				);
			}
			/*
			 * And take the replacement, not just the permission.
			 *
			 * `onClientChange` is subscribed below — AFTER this await — and
			 * it does not replay. A same-account token refresh landing while
			 * the root write was in flight therefore passed the check above
			 * and was then never heard about again: `client` stayed the
			 * stopped instance, the membership listeners attached to it, and
			 * nobody joining or leaving ever reached the card. Same stuck
			 * `running` card as the refresh bugs this guard was written for,
			 * through the one window the subscription cannot cover.
			 */
			client = live;
		} catch (error) {
			/*
			 * Unless nothing was ever sent, in which case there is nothing
			 * out there to reconcile.
			 *
			 * `TimelineClientUnavailableError` is thrown by the writer BEFORE
			 * `sendMessage` — it is how the guard above says "this client
			 * cannot encrypt into that room yet". So this one failure is not
			 * the ambiguous kind the rest of this comment is about: no
			 * request left the browser, no acknowledgement can have been
			 * lost, and no card can exist. Keeping the tracker here had
			 * `CallManager` abort the uninvited call, discard its room, and
			 * call `finish()` — whose delayed retry then published a `missed`
			 * card, once crypto was ready, for a call that never rang and
			 * whose room is gone.
			 *
			 * The named error is what makes the two worlds distinguishable;
			 * where they are not, the reasoning below still holds.
			 */
			if (error instanceof TimelineClientUnavailableError) {
				this.calls.delete(call.callId);
				throw error;
			}
			/*
			 * The card may be out there even though the write failed.
			 *
			 * A lost ACKNOWLEDGEMENT is indistinguishable here from a lost
			 * request: the event is stored, the response never arrives, and
			 * `publish` rejects. Deleting the tracker on the way out made the
			 * caller's `finish` a no-op on a call id nothing knows any more,
			 * so that accepted card stayed `running` for good — offering a
			 * Join button for a call room that startup had already discarded.
			 *
			 * So the root is attempted once more, under the transaction id
			 * the writer retained for exactly this. Matrix treats a repeated
			 * transaction id as idempotent: if the first attempt did land,
			 * the server returns its event id and stores nothing, which gives
			 * the tracker the root to edit; if it did not, this writes it.
			 * Either way the tracker survives with a card the caller's
			 * cleanup can close.
			 *
			 * And it survives a FAILED second attempt too, which it did not
			 * before. One outage covers both writes easily — they are
			 * milliseconds apart — so "the immediate retry failed" says
			 * nothing about whether the first event is on the server; it
			 * mostly says the connection is still down. Dropping the tracker
			 * on it put the lost-acknowledgement case straight back where it
			 * started: a retained `running` card, a Join button for a
			 * discarded room, and a `finish` with nothing to finish.
			 *
			 * So the tracker is kept and the caller's cleanup writes the
			 * ending through the delayed retry path, which has the seconds
			 * this one does not. Without an acknowledged root that ending is
			 * a second root rather than an edit, and the reader folds the two
			 * by `[roomRef, callId]` from the same sender — "keeps the first
			 * durable identity through three revisions" — so the card the
			 * server kept ends up closed.
			 *
			 * The cost is the other world: if nothing ever landed, this
			 * writes one `missed` card for a call that never rang. An earlier
			 * version of this chose the opposite and said so in a test. It is
			 * the wrong way round. The two worlds are indistinguishable from
			 * here, and they are not equally bad — a `missed` notice is a
			 * line in a timeline, while a stuck `running` card offers a Join
			 * button for ever. And if the failure is not transient at all —
			 * no client, no permission, no room — the delayed retries fail
			 * too and nothing is written, so the phantom is confined to an
			 * outage that clears within seconds of a start that failed.
			 */
			await this.retryRootWrite(tracked);
			throw error;
		}
		if (tracked.message.state !== 'running') return;
		let detachMembership: (() => void) | undefined;
		const attach = () => {
			if (detachMembership || tracked.message.state !== 'running') return;
			const room = client.getRoom(tracked.message.callRoomId);
			if (!room || !client.matrixRTC) return;
			const session = client.matrixRTC.getRoomSession(room);
			const refresh = () => {
				if (getMatrixClientService()?.getClient?.() !== client) {
					tracked.stop();
					this.calls.delete(call.callId);
					return;
				}
				/*
				 * One person, one entry — however many devices they are on.
				 *
				 * MatrixRTC publishes a membership per device, so somebody
				 * who joins from a phone and a laptop appeared on the card
				 * twice: two avatars, an attendee count one too high, and two
				 * React children under the same key.
				 */
				const seen = new Set<string>();
				const current = session.memberships.flatMap((membership) => {
					const userId = membership.sender;
					if (!userId || seen.has(userId)) return [];
					seen.add(userId);
					return [
						{
							userId,
							displayName: room.getMember(userId)?.name || userId
						}
					];
				});
				if (current.length > 0) {
					/*
					 * Answered means somebody ELSE arrived.
					 *
					 * The caller's own membership appears as soon as its
					 * iframe opens, so this used to set `startedAt` before
					 * the callee had done anything — and an unanswered call
					 * the caller then hung up was written as `ended`, with
					 * the ringing time as its duration. That is exactly the
					 * distinction `missed` exists to make.
					 *
					 * With no actor recorded (an older card, or a client that
					 * could not name itself) any membership counts, which is
					 * the behaviour this replaces.
					 */
					const actor = tracked.message.actorUserId;
					const answered =
						actor === undefined ||
						current.some(
							(participant) => participant.userId !== actor
						);
					if (answered)
						tracked.message.startedAt ??= new Date().toISOString();
					const participants = new Map(
						tracked.message.participants.map((participant) => [
							participant.userId,
							participant
						])
					);
					current.forEach((participant) =>
						participants.set(participant.userId, participant)
					);
					tracked.message = {
						...tracked.message,
						// Who was ever here, and who is here now. The first is
						// a union that never shrinks, which is what an ended
						// card should show; the second is replaced outright,
						// so somebody who leaves disappears from it. Folding
						// them together loses one of the two answers.
						participants: [...participants.values()],
						present: current
					};
					this.publish(tracked);
				} else if (tracked.message.startedAt) {
					this.finish(call.callId);
				}
			};
			session.on(MatrixRTCSessionEvent.MembershipsChanged, refresh);
			detachMembership = () =>
				session.off(MatrixRTCSessionEvent.MembershipsChanged, refresh);
			refresh();
		};
		client.on?.(ClientEvent.Room, attach);

		/*
		 * Follow the account, not the object.
		 *
		 * A replacement client for the SAME account is a token refresh and the
		 * call is still the same call, so the listeners move to it. A different
		 * account — or none — is a logout, and then there is nothing left that
		 * may write this card: the tracked call is dropped, which is what the
		 * mismatch check inside `refresh` used to be for and could no longer
		 * reach, because it was driven by the dead client's own listener.
		 */
		const unsubscribeClientChange =
			getMatrixClientService()?.onClientChange?.((next) => {
				if (next === client) return;
				client.off?.(ClientEvent.Room, attach);
				detachMembership?.();
				detachMembership = undefined;
				if (!next || (next.getUserId?.() ?? undefined) !== ownUserId) {
					tracked.stop();
					this.calls.delete(call.callId);
					return;
				}
				client = next;
				client.on?.(ClientEvent.Room, attach);
				attach();
			}) ?? undefined;

		tracked.stop = () => {
			unsubscribeClientChange?.();
			client.off?.(ClientEvent.Room, attach);
			detachMembership?.();
		};
		attach();
	}

	/**
	 * Close a call that nobody ever joined.
	 *
	 * A MatrixRTC group call belongs to the room rather than to whoever
	 * invited everybody, so one person leaving must not end it for the rest —
	 * which is why `endCall` does not finish group calls, and why the tracker
	 * waits for memberships to drop to zero instead. A call nobody joined is
	 * the exception: there is no rest. Without this, cancelling or leaving an
	 * unanswered group call left the card saying "running" for good, offering
	 * a Join button that could only ever answer `unavailable`.
	 *
	 * `finish` writes `missed` when nothing ever started, which is what this
	 * case is.
	 */
	/**
	 * @returns whether it actually wrote the ending.
	 *
	 * `CallManager.leaveCall` records that on the retained call: a card this
	 * client has closed must not be reopened under the same id, while a call
	 * it never tracked — an incoming one, whose card belongs to the caller —
	 * must still be rejoinable. "Did we finish it" separates those; "do we
	 * still know it" does not.
	 */
	finishIfUnattended(callId: string): boolean {
		const tracked = this.calls.get(callId);
		if (!tracked || tracked.message.startedAt) return false;
		this.finish(callId);
		return true;
	}

	finish(callId: string): void {
		const tracked = this.calls.get(callId);
		if (!tracked || tracked.message.state !== 'running') return;
		const endedAt = new Date().toISOString();
		tracked.message = {
			...tracked.message,
			state: tracked.message.startedAt ? 'ended' : 'missed',
			// Nobody is in a call that has ended. Leaving the last live list
			// behind would make the card say otherwise for as long as it is
			// on screen.
			present: [],
			endedAt,
			durationSeconds: tracked.message.startedAt
				? Math.max(
						0,
						Math.floor(
							(Date.parse(endedAt) -
								Date.parse(tracked.message.startedAt)) /
								1000
						)
					)
				: undefined
		};
		tracked.stop();
		/*
		 * The ending gets a budget of its own. A running update that never
		 * landed — a crypto window longer than all three delays — leaves the
		 * counter spent, and a hangup failing once after that would get no
		 * retry at all.
		 */
		tracked.retryAttempts = 0;
		this.publish(tracked);
		/*
		 * Done with it. The retry chain below holds `tracked` directly, so
		 * the terminal write still finishes its attempts — but nothing looks
		 * a finished call up again, and keeping every call of the session in
		 * this map kept its writer, its participant list and its timers alive
		 * for as long as the tab stayed open.
		 */
		this.calls.delete(callId);
	}

	/**
	 * One more attempt at the root write, under the transaction it already
	 * used — so it cannot produce a second card.
	 *
	 * Worth attempting even though nothing branches on the outcome: when it
	 * lands, the writer learns the root event id, and the ending the caller
	 * writes next is an edit of the card rather than a second one.
	 */
	private async retryRootWrite(tracked: TrackedCall): Promise<void> {
		try {
			await tracked.writer.publish(tracked.message);
		} catch {
			// Nothing to decide on it; the ending is written either way.
		}
	}

	private publish(tracked: TrackedCall): void {
		void tracked.writer
			.publish(tracked.message)
			.then(() => {
				/*
				 * A write that lands gives the budget back.
				 *
				 * `retryAttempts` counts for the whole CALL, and it only ever
				 * grew. That was harmless while a terminal write was the only
				 * thing retried — there is one of those per call — and stopped
				 * being harmless the moment a running update could retry too:
				 * a presence update caught in the crypto window could spend all
				 * three delays, and the hangup that followed would then index
				 * past the end of the table and be abandoned on its first
				 * failure, leaving the durable card `running` for good.
				 */
				tracked.retryAttempts = 0;
			})
			.catch((error: unknown) => {
				// The writer retains the original transaction ID and root event after
				// failure, so retrying a terminal edit cannot create another call card.
				// Never send it through a replacement login client.
				if (!tracked.isCurrentClient()) return;
				/*
				 * A client that is not ready YET is retried whatever the state.
				 *
				 * Only terminal writes are retried otherwise, because a running
				 * one is re-sent by the next membership change anyway. That
				 * reasoning fails for the crypto window: it closes in seconds
				 * and nothing re-triggers a publish afterwards, so a presence
				 * update that fell into it would leave the card showing the
				 * wrong people for the rest of the call.
				 */
				const notReadyYet =
					error instanceof TimelineClientUnavailableError;
				if (tracked.message.state !== 'running' || notReadyYet) {
					if (tracked.retryTimer !== undefined) return;
					const delay =
						TERMINAL_RETRY_DELAYS_MS[tracked.retryAttempts];
					if (delay !== undefined) {
						tracked.retryAttempts += 1;
						tracked.retryTimer = setTimeout(() => {
							tracked.retryTimer = undefined;
							if (tracked.isCurrentClient())
								this.publish(tracked);
						}, delay);
						return;
					}
				}
				// Avoid logging room IDs or raw transport errors from counselling calls.
				console.warn('Call timeline update could not be saved');
			});
	}
}

export const callLifecycleTracker = new CallLifecycleTracker();
