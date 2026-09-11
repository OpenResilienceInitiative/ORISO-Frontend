export const CALL_LIFECYCLE_MSGTYPE = 'org.oriso.call.lifecycle';

/** Matrix room messages allow application-specific msgtypes. */
export interface CallLifecycleContent extends Record<string, unknown> {
	body: string;
	msgtype: string;
}

export interface CallLifecycleParticipant {
	userId: string;
	displayName: string;
}

export interface CallLifecycleMessage {
	callId: string;
	roomRef: string;
	callRoomId: string;
	state: 'running' | 'ended' | 'missed';
	callType: 'audio' | 'video';
	participants: CallLifecycleParticipant[];
	invitedAt?: string;
	startedAt?: string;
	endedAt?: string;
	durationSeconds?: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	value !== null && typeof value === 'object' && !Array.isArray(value);
const isString = (value: unknown): value is string =>
	typeof value === 'string' && value.trim().length > 0;
const validTimestamp = (value: unknown) =>
	value === undefined ||
	(typeof value === 'string' && Number.isFinite(Date.parse(value)));

/** Only the explicit room-message type can become a call card. */
export function parseCallLifecycleMessage(
	content: unknown
): CallLifecycleMessage | null {
	if (!isRecord(content) || content.msgtype !== CALL_LIFECYCLE_MSGTYPE)
		return null;
	const payload = content['org.oriso.call'];
	if (!isRecord(payload)) return null;
	const { call_id, room_ref, call_room_id, state, call_type, participants } =
		payload;
	if (!isString(call_id) || !isString(room_ref) || !isString(call_room_id))
		return null;
	if (state !== 'running' && state !== 'ended' && state !== 'missed')
		return null;
	if (call_type !== 'audio' && call_type !== 'video') return null;
	if (
		!Array.isArray(participants) ||
		participants.some(
			(participant) =>
				!isRecord(participant) ||
				!isString(participant.userId) ||
				!isString(participant.displayName)
		)
	)
		return null;
	if (
		![payload.invited_at, payload.started_at, payload.ended_at].every(
			validTimestamp
		)
	)
		return null;
	const duration = payload.duration_seconds;
	if (
		duration !== undefined &&
		(typeof duration !== 'number' ||
			!Number.isFinite(duration) ||
			duration < 0)
	)
		return null;
	return {
		callId: call_id,
		roomRef: room_ref,
		callRoomId: call_room_id,
		state,
		callType: call_type,
		participants: participants.map((participant) => ({
			userId: participant.userId,
			displayName: participant.displayName
		})),
		invitedAt: payload.invited_at as string | undefined,
		startedAt: payload.started_at as string | undefined,
		endedAt: payload.ended_at as string | undefined,
		durationSeconds: duration as number | undefined
	};
}

export function buildCallLifecycleContent(
	message: CallLifecycleMessage,
	replaceEventId?: string
): CallLifecycleContent {
	const content = {
		'msgtype': CALL_LIFECYCLE_MSGTYPE,
		'body': `${message.callType} call ${message.state}`,
		'org.oriso.call': {
			call_id: message.callId,
			room_ref: message.roomRef,
			call_room_id: message.callRoomId,
			state: message.state,
			call_type: message.callType,
			participants: message.participants,
			invited_at: message.invitedAt,
			started_at: message.startedAt,
			ended_at: message.endedAt,
			duration_seconds: message.durationSeconds
		}
	};
	return replaceEventId
		? {
				...content,
				'body': `* ${content.body}`,
				'm.new_content': content,
				'm.relates_to': {
					rel_type: 'm.replace',
					event_id: replaceEventId
				}
			}
		: content;
}

interface LifecycleTimelineItem {
	_id: string;
	ts: Date | string | number;
	callLifecycle?: CallLifecycleMessage | null;
	callLifecycleRevisionTs?: number;
	u?: { _id: string };
	replaceTargetId?: string | null;
	editedCallLifecycle?: CallLifecycleMessage | null;
}

/** Validate Matrix replacement ownership before the generic text-edit pipeline. */
export function applyCallLifecycleEdits<T extends LifecycleTimelineItem>(
	items: T[]
): T[] {
	const originals = new Map(
		items
			.filter((item) => item.callLifecycle && !item.replaceTargetId)
			.map((item) => [item._id, item])
	);
	const resolved = new Map(originals);
	for (const item of [...items].sort(
		(a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime()
	)) {
		if (!item.replaceTargetId || !item.editedCallLifecycle) continue;
		const original = resolved.get(item.replaceTargetId);
		const before = original?.callLifecycle;
		const after = item.editedCallLifecycle;
		if (
			!original ||
			!before ||
			!original.u?._id ||
			original.u._id !== item.u?._id
		)
			continue;
		if (
			before.callId !== after.callId ||
			before.roomRef !== after.roomRef ||
			before.callRoomId !== after.callRoomId ||
			before.callType !== after.callType
		)
			continue;
		if (before.state !== 'running' && after.state === 'running') continue;
		const revision = new Date(item.ts).getTime();
		if (
			revision <
			(original.callLifecycleRevisionTs ??
				new Date(original.ts).getTime())
		)
			continue;
		resolved.set(original._id, {
			...original,
			callLifecycle: after,
			callLifecycleRevisionTs: revision
		});
	}
	return items
		.filter(
			(item) =>
				!item.replaceTargetId ||
				(!item.callLifecycle &&
					!item.editedCallLifecycle &&
					!originals.has(item.replaceTargetId))
		)
		.map((item) => resolved.get(item._id) ?? item);
}

/** Fold lifecycle revisions without changing the first durable card identity. */
export function collapseCallLifecycleMessages<T extends LifecycleTimelineItem>(
	items: T[]
): T[] {
	const output: T[] = [];
	const indexes = new Map<string, number>();
	for (const item of items) {
		const call = item.callLifecycle;
		if (!call) {
			output.push(item);
			continue;
		}
		const key = JSON.stringify([call.roomRef, call.callId]);
		const index = indexes.get(key);
		if (index === undefined) {
			indexes.set(key, output.length);
			output.push(item);
			continue;
		}
		const existing = output[index];
		// Duplicate roots must obey the same ownership and identity constraints
		// as replacements; a matching public call ID is not authorization.
		if (
			existing.u?._id !== item.u?._id ||
			existing.callLifecycle?.callRoomId !== call.callRoomId ||
			existing.callLifecycle?.callType !== call.callType
		)
			continue;
		if (
			existing.callLifecycle?.state !== 'running' &&
			call.state === 'running'
		)
			continue;
		const revision =
			item.callLifecycleRevisionTs ?? new Date(item.ts).getTime();
		const previousRevision =
			existing.callLifecycleRevisionTs ?? new Date(existing.ts).getTime();
		if (revision < previousRevision) continue;
		output[index] = {
			...item,
			_id: existing._id,
			ts: existing.ts,
			callLifecycleRevisionTs: revision
		};
	}
	return output;
}
