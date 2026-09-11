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
}

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
			message: {
				callId: call.callId,
				roomRef: call.signalRoomId || call.roomId,
				callRoomId: call.elementCallRoomId || call.roomId,
				state: 'running',
				callType: call.isVideo ? 'video' : 'audio',
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
						participants: [...participants.values()]
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

	finish(callId: string): void {
		const tracked = this.calls.get(callId);
		if (!tracked || tracked.message.state !== 'running') return;
		const endedAt = new Date().toISOString();
		tracked.message = {
			...tracked.message,
			state: tracked.message.startedAt ? 'ended' : 'missed',
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
	}

	private publish(tracked: TrackedCall): void {
		void tracked.writer.publish(tracked.message).catch(() => {
			// Avoid logging room IDs or raw transport errors from counselling calls.
			console.warn('Call timeline update could not be saved');
		});
	}
}

export const callLifecycleTracker = new CallLifecycleTracker();
