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
		const client = getMatrixClientService()?.getClient?.();
		if (!client)
			throw new Error('Matrix client unavailable for call timeline');
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
				// Whoever this client is, since this client is the one
				// starting the call. Nobody else can say it, and it is the
				// only thing on the card that the participant lists cannot
				// reconstruct.
				actorUserId: client.getUserId?.() ?? undefined,
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
				const current = session.memberships.flatMap((membership) =>
					membership.sender
						? [
								{
									userId: membership.sender,
									displayName:
										room.getMember(membership.sender)
											?.name || membership.sender
								}
							]
						: []
				);
				if (current.length > 0) {
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
		tracked.stop = () => {
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
