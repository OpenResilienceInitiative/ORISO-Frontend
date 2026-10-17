import { ClientEvent } from 'matrix-js-sdk';
import type { RoomMessageEventContent } from 'matrix-js-sdk/lib/@types/events';
import { MatrixRTCSessionEvent } from 'matrix-js-sdk/lib/matrixrtc/MatrixRTCSession';
import { getMatrixClientService } from './matrixClientRegistry';
import { CallTimelineMessageService } from './callTimelineMessageService';
import type { CallData } from './CallManager';
import type { CallLifecycleMessage } from '../utils/callLifecycleMessage';

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
		const writer = new CallTimelineMessageService(() => {
			return getMatrixClientService()?.getClient?.() === client
				? {
						sendMessage: (roomId, content, transactionId) =>
							client.sendMessage(
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
			isCurrentClient: () =>
				getMatrixClientService()?.getClient?.() === client,
			retryAttempts: 0,
			message: {
				callId: call.callId,
				roomRef: call.signalRoomId || call.roomId,
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
			if (getMatrixClientService()?.getClient?.() !== client) {
				throw new Error(
					'The Matrix account changed during call startup'
				);
			}
		} catch (error) {
			this.calls.delete(call.callId);
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
	 * Whether this call still has a live card.
	 *
	 * A finalised call is removed from the map, so this answers "is the card
	 * still open" — which is what decides whether reopening the same call is
	 * reuse or a fresh start. `CallManager.startCall` asks before taking its
	 * reuse path: an unattended group call that `leaveCall` already wrote as
	 * `missed` must not be reopened under its own id, because the card is
	 * terminal and nothing would publish a new one.
	 */
	isTracking(callId: string): boolean {
		return this.calls.has(callId);
	}

	finishIfUnattended(callId: string): void {
		const tracked = this.calls.get(callId);
		if (!tracked || tracked.message.startedAt) return;
		this.finish(callId);
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

	private publish(tracked: TrackedCall): void {
		void tracked.writer.publish(tracked.message).catch(() => {
			// The writer retains the original transaction ID and root event after
			// failure, so retrying a terminal edit cannot create another call card.
			// Never send it through a replacement login client.
			if (!tracked.isCurrentClient()) return;
			if (tracked.message.state !== 'running') {
				if (tracked.retryTimer !== undefined) return;
				const delay = TERMINAL_RETRY_DELAYS_MS[tracked.retryAttempts];
				if (delay !== undefined) {
					tracked.retryAttempts += 1;
					tracked.retryTimer = setTimeout(() => {
						tracked.retryTimer = undefined;
						if (tracked.isCurrentClient()) this.publish(tracked);
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
