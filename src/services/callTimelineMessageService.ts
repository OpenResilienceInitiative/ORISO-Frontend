import type { MatrixClient, MatrixEvent } from 'matrix-js-sdk';
import { MatrixRTCSession } from 'matrix-js-sdk/lib/matrixrtc/MatrixRTCSession';
import { getMatrixClientService } from './matrixClientRegistry';
import {
	buildCallLifecycleContent,
	CallLifecycleParticipant,
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
	participants: CallLifecycleParticipant[];
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
	private writeQueues = new Map<string, Promise<void>>();
	private terminalCallIds = new Set<string>();

	private client(): MatrixClient | null {
		return getMatrixClientService()?.getClient?.() || null;
	}

	private enqueueWrite(
		callId: string,
		task: () => Promise<void>
	): Promise<void> {
		const previous = this.writeQueues.get(callId) ?? Promise.resolve();
		const next = previous.then(task, task);
		this.writeQueues.set(
			callId,
			next.then(
				() => undefined,
				() => undefined
			)
		);
		return next;
	}

	async announceStarted(input: CallTimelineStartInput): Promise<void> {
		const client = this.client();
		if (!client) return;
		const startedAt = new Date().toISOString();
		const participants = this.matrixRtcParticipants(
			client,
			input.callRoomId
		);
		const pending: PendingCall = { ...input, startedAt, participants };
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
			participants,
			participantCount: participants.length
		};
		try {
			await this.enqueueWrite(input.callId, async () => {
				if (this.terminalCallIds.has(input.callId)) {
					return;
				}
				const response = await client.sendMessage(
					input.roomRef,
					buildCallLifecycleContent(message) as any
				);
				pending.eventId = eventIdFromResponse(response);
			});
			await this.refreshParticipants(input.callRoomId);
		} catch {
			this.pendingCalls.delete(input.callId);
		}
	}

	/**
	 * Refresh running entries from MatrixRTC state only. General Matrix room
	 * membership is deliberately excluded because being allowed into the chat is
	 * not evidence that somebody attended its call.
	 */
	async refreshParticipants(callRoomId: string): Promise<void> {
		const client = this.client();
		if (!client) return;
		const snapshot = this.matrixRtcParticipants(client, callRoomId);
		const matching = Array.from(this.pendingCalls.values()).filter(
			(pending) => pending.callRoomId === callRoomId
		);
		await Promise.all(
			matching.map((pending) =>
				this.enqueueWrite(pending.callId, async () => {
					if (this.terminalCallIds.has(pending.callId)) {
						return;
					}
					const merged = this.mergeParticipants(
						pending.participants,
						snapshot
					);
					if (
						JSON.stringify(merged) ===
						JSON.stringify(pending.participants)
					) {
						return;
					}
					pending.participants = merged;
					if (!pending.eventId) return;
					const message: CallLifecycleMessage = {
						callId: pending.callId,
						state: 'running',
						callType: pending.isVideo ? 'video' : 'audio',
						roomRef: pending.roomRef,
						callRoomId: pending.callRoomId,
						startedAt: pending.startedAt,
						actorUserId: client.getUserId?.() || undefined,
						participants: pending.participants,
						participantCount: pending.participants.length
					};
					try {
						await client.sendMessage(
							pending.roomRef,
							buildCallLifecycleContent(
								message,
								pending.eventId
							) as any
						);
					} catch {
						// Participant telemetry must never interrupt the media call.
					}
				})
			)
		);
	}

	async finish(
		input: CallTimelineStartInput,
		outcome: CallTimelineOutcome
	): Promise<void> {
		const client = this.client();
		if (!client) return;
		const pending = this.pendingCalls.get(input.callId);
		const original = pending || this.findOriginal(client, input);
		const participants = this.mergeParticipants(
			original?.participants || [],
			this.matrixRtcParticipants(client, input.callRoomId)
		);
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
			participants,
			participantCount: participants.length
		};
		this.terminalCallIds.add(input.callId);
		try {
			await this.enqueueWrite(input.callId, async () => {
				await client.sendMessage(
					input.roomRef,
					buildCallLifecycleContent(message, original?.eventId) as any
				);
			});
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
				lifecycle?.startedAt || new Date(event.getTs()).toISOString(),
			participants: lifecycle?.participants || []
		};
	}

	private matrixRtcParticipants(
		client: MatrixClient,
		callRoomId: string
	): CallLifecycleParticipant[] {
		try {
			const room = client.getRoom?.(callRoomId);
			if (!room) return [];
			const memberships = MatrixRTCSession.sessionMembershipsForRoom(
				room,
				{
					id: '',
					application: 'm.call'
				}
			);
			const uniqueSenders = Array.from(
				new Set(
					memberships
						.map((membership) => membership.sender)
						.filter((sender): sender is string => Boolean(sender))
				)
			);
			return uniqueSenders.map((userId) => {
				const username =
					userId.split(':')[0].replace(/^@/, '') || userId;
				return {
					userId,
					username,
					displayName:
						client.getUser?.(userId)?.displayName || username
				};
			});
		} catch {
			return [];
		}
	}

	private mergeParticipants(
		current: CallLifecycleParticipant[],
		next: CallLifecycleParticipant[]
	): CallLifecycleParticipant[] {
		const byUserId = new Map(
			current.map((participant) => [participant.userId, participant])
		);
		next.forEach((participant) =>
			byUserId.set(participant.userId, participant)
		);
		return Array.from(byUserId.values());
	}
}

export const callTimelineMessageService = new CallTimelineMessageService();
