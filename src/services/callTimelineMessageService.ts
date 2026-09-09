import type { MatrixClient, MatrixEvent } from 'matrix-js-sdk';
import { getMatrixClientService } from './matrixClientRegistry';
import {
	buildCallLifecycleContent,
	CallLifecycleMessage,
	parseCallLifecycleMessage
} from '../utils/callLifecycleMessage';

export interface CallTimelineStartInput {
	callId: string;
	roomRef: string;
	callRoomId: string;
	isVideo: boolean;
}

export type CallTimelineOutcome = 'ended' | 'missed';

interface PendingCall extends CallTimelineStartInput {
	eventId?: string;
	startedAt: string;
}

const eventIdFromResponse = (response: unknown): string | undefined => {
	if (!response || typeof response !== 'object') return undefined;
	const eventId = (response as Record<string, unknown>).event_id;
	return typeof eventId === 'string' ? eventId : undefined;
};

/**
 * Writes the durable, encrypted call item into the conversation room. The
 * starter owns the normal m.replace transition. A different device can still
 * publish a resolution event; the renderer collapses it by callId.
 */
export class CallTimelineMessageService {
	private pendingCalls = new Map<string, PendingCall>();

	private client(): MatrixClient | null {
		return getMatrixClientService()?.getClient?.() || null;
	}

	async announceStarted(input: CallTimelineStartInput): Promise<void> {
		const client = this.client();
		if (!client) return;
		const startedAt = new Date().toISOString();
		const pending: PendingCall = { ...input, startedAt };
		this.pendingCalls.set(input.callId, pending);
		const actorUserId = client.getUserId?.() || undefined;
		const message: CallLifecycleMessage = {
			callId: input.callId,
			state: 'running',
			callType: input.isVideo ? 'video' : 'audio',
			roomRef: input.roomRef,
			callRoomId: input.callRoomId,
			startedAt,
			actorUserId,
			participants: []
		};
		try {
			const response = await client.sendMessage(
				input.roomRef,
				buildCallLifecycleContent(message) as any
			);
			pending.eventId = eventIdFromResponse(response);
		} catch {
			this.pendingCalls.delete(input.callId);
		}
	}

	async finish(
		input: CallTimelineStartInput,
		outcome: CallTimelineOutcome
	): Promise<void> {
		const client = this.client();
		if (!client) return;
		const pending = this.pendingCalls.get(input.callId);
		const original = pending || this.findOriginal(client, input);
		const endedAt = new Date().toISOString();
		const startedAt = original?.startedAt;
		const durationSeconds = startedAt
			? Math.max(
					0,
					Math.round(
						(new Date(endedAt).getTime() -
							new Date(startedAt).getTime()) /
							1000
					)
				)
			: undefined;
		const message: CallLifecycleMessage = {
			callId: input.callId,
			state: outcome,
			callType: input.isVideo ? 'video' : 'audio',
			roomRef: input.roomRef,
			callRoomId: input.callRoomId,
			startedAt,
			endedAt,
			durationSeconds,
			actorUserId: client.getUserId?.() || undefined,
			participants: []
		};
		try {
			await client.sendMessage(
				input.roomRef,
				buildCallLifecycleContent(message, original?.eventId) as any
			);
		} catch {
			// The call itself must not fail because its protocol entry could not be
			// written. Matrix will expose the transport failure independently.
		} finally {
			this.pendingCalls.delete(input.callId);
		}
	}

	private findOriginal(
		client: MatrixClient,
		input: CallTimelineStartInput
	): PendingCall | undefined {
		const getRoom = (
			client as MatrixClient & {
				getRoom?: MatrixClient['getRoom'];
			}
		).getRoom;
		if (typeof getRoom !== 'function') return undefined;
		const room = getRoom.call(client, input.roomRef);
		const ownUserId = client.getUserId?.();
		const event = room
			?.getLiveTimeline?.()
			.getEvents?.()
			.slice()
			.reverse()
			.find((candidate: MatrixEvent) => {
				const lifecycle = parseCallLifecycleMessage(
					candidate.getClearContent?.() || candidate.getContent?.()
				);
				return (
					lifecycle?.callId === input.callId &&
					lifecycle.state === 'running' &&
					candidate.getSender?.() === ownUserId
				);
			});
		if (!event) return undefined;
		const lifecycle = parseCallLifecycleMessage(
			event.getClearContent?.() || event.getContent?.()
		);
		return {
			...input,
			eventId: event.getId?.() || undefined,
			startedAt:
				lifecycle?.startedAt || new Date(event.getTs()).toISOString()
		};
	}
}

export const callTimelineMessageService = new CallTimelineMessageService();
