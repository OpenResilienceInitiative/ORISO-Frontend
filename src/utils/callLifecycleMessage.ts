export const CALL_LIFECYCLE_MSGTYPE = 'org.oriso.call.lifecycle';

export type CallLifecycleState = 'scheduled' | 'running' | 'ended' | 'missed';

export type CallLifecycleType = 'audio' | 'video';

export interface CallLifecycleParticipant {
	userId: string;
	username: string;
	displayName: string;
}

export interface CallLifecycleMessage {
	callId: string;
	state: CallLifecycleState;
	callType: CallLifecycleType;
	roomRef?: string;
	callRoomId?: string;
	invitedAt?: string;
	startedAt?: string;
	endedAt?: string;
	scheduledFor?: string;
	durationSeconds?: number;
	actorUserId?: string;
	participants: CallLifecycleParticipant[];
	participantCount?: number;
}

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
	Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const asString = (value: unknown): string | undefined =>
	typeof value === 'string' && value.trim() ? value : undefined;

const asFiniteNumber = (value: unknown): number | undefined =>
	typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const parseParticipant = (value: unknown): CallLifecycleParticipant | null => {
	if (typeof value === 'string' && value) {
		const username = value.split(':')[0].replace(/^@/, '') || value;
		return { userId: value, username, displayName: username };
	}
	if (!isRecord(value)) return null;
	const userId =
		asString(value.userId) ?? asString(value.user_id) ?? asString(value.id);
	if (!userId) return null;
	const username =
		asString(value.username) ??
		userId.split(':')[0].replace(/^@/, '') ??
		userId;
	return {
		userId,
		username,
		displayName:
			asString(value.displayName) ??
			asString(value.display_name) ??
			username
	};
};

const parseState = (value: unknown): CallLifecycleState | null => {
	if (value === 'invited' || value === 'started' || value === 'running') {
		return 'running';
	}
	if (value === 'scheduled' || value === 'ended' || value === 'missed') {
		return value;
	}
	return null;
};

/**
 * Parse the encrypted Matrix room-message payload used by the call timeline.
 * Snake_case is the wire format; camelCase is accepted so the same model can
 * consume UserService notification params without an adapter full of casts.
 */
export const parseCallLifecycleMessage = (
	content: unknown
): CallLifecycleMessage | null => {
	if (!isRecord(content)) return null;
	const payload = isRecord(content['org.oriso.call'])
		? content['org.oriso.call']
		: content;
	const msgtype = asString(content.msgtype);
	if (
		content !== payload &&
		msgtype !== undefined &&
		msgtype !== CALL_LIFECYCLE_MSGTYPE
	) {
		return null;
	}

	const callId = asString(payload.callId) ?? asString(payload.call_id);
	const state = parseState(payload.state);
	if (!callId || !state) return null;

	const explicitType =
		asString(payload.callType) ?? asString(payload.call_type);
	const callType: CallLifecycleType =
		explicitType === 'audio' || payload.isVideo === false
			? 'audio'
			: 'video';
	const rawParticipants = Array.isArray(payload.participants)
		? payload.participants
		: [];
	const participants = rawParticipants
		.map(parseParticipant)
		.filter(
			(participant): participant is CallLifecycleParticipant =>
				participant !== null
		);

	return {
		callId,
		state,
		callType,
		roomRef: asString(payload.roomRef) ?? asString(payload.room_ref),
		callRoomId:
			asString(payload.callRoomId) ?? asString(payload.call_room_id),
		invitedAt: asString(payload.invitedAt) ?? asString(payload.invited_at),
		startedAt: asString(payload.startedAt) ?? asString(payload.started_at),
		endedAt: asString(payload.endedAt) ?? asString(payload.ended_at),
		scheduledFor:
			asString(payload.scheduledFor) ?? asString(payload.scheduled_for),
		durationSeconds:
			asFiniteNumber(payload.durationSeconds) ??
			asFiniteNumber(payload.duration_seconds),
		actorUserId:
			asString(payload.actorUserId) ?? asString(payload.actor_user_id),
		participants,
		participantCount:
			asFiniteNumber(payload.participantCount) ??
			asFiniteNumber(payload.participant_count)
	};
};

export const buildCallLifecycleContent = (
	message: CallLifecycleMessage,
	replaceEventId?: string
): Record<string, unknown> => {
	const payload = {
		call_id: message.callId,
		state: message.state,
		call_type: message.callType,
		room_ref: message.roomRef,
		call_room_id: message.callRoomId,
		invited_at: message.invitedAt,
		started_at: message.startedAt,
		ended_at: message.endedAt,
		scheduled_for: message.scheduledFor,
		duration_seconds: message.durationSeconds,
		actor_user_id: message.actorUserId,
		participants: message.participants,
		participant_count:
			message.participantCount ?? message.participants.length
	};
	const nextContent: Record<string, unknown> = {
		'msgtype': CALL_LIFECYCLE_MSGTYPE,
		'body': `${message.callType} call ${message.state}`,
		'org.oriso.call': payload
	};
	if (!replaceEventId) return nextContent;
	return {
		...nextContent,
		'body': `* ${nextContent.body}`,
		'm.new_content': nextContent,
		'm.relates_to': {
			rel_type: 'm.replace',
			event_id: replaceEventId
		}
	};
};

export interface CallLifecycleTimelineItem {
	_id: string;
	ts: Date | string | number;
	callLifecycle?: CallLifecycleMessage | null;
	replaceTargetId?: string | null;
	editedCallLifecycle?: CallLifecycleMessage | null;
	[key: string]: unknown;
}

/**
 * Keep one durable room-timeline item per call. Normal ownership uses
 * m.replace. A second participant may publish a missed resolution while the
 * original sender is offline; the callId fallback still collapses that pair.
 */
export const collapseCallLifecycleMessages = <
	T extends CallLifecycleTimelineItem
>(
	items: T[]
): T[] => {
	const byCallId = new Map<string, { index: number; item: T }>();
	const output: T[] = [];

	for (const item of items) {
		if (!item.callLifecycle) {
			output.push(item);
			continue;
		}
		const existing = byCallId.get(item.callLifecycle.callId);
		if (!existing) {
			byCallId.set(item.callLifecycle.callId, {
				index: output.length,
				item
			});
			output.push(item);
			continue;
		}
		const existingTime = new Date(existing.item.ts).getTime();
		const candidateTime = new Date(item.ts).getTime();
		if (candidateTime >= existingTime) {
			output[existing.index] = {
				...item,
				_id: existing.item._id,
				ts: existing.item.ts
			};
			byCallId.set(item.callLifecycle.callId, {
				index: existing.index,
				item
			});
		}
	}

	return output;
};
