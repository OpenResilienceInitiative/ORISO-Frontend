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
	/**
	 * Everybody who was in this call at some point. Cumulative: nobody is
	 * ever removed, which is what makes it the right thing for an ended
	 * card to show and the wrong thing for a running one.
	 */
	participants: CallLifecycleParticipant[];
	/**
	 * Who is in the call RIGHT NOW. Replaced on every membership change, so
	 * somebody who leaves disappears from it.
	 *
	 * This is the field "ich sehe, dass die anderen drin sind" needs, and it
	 * is deliberately separate from `participants` rather than a correction
	 * to it. Both are true and they answer different questions: an ended
	 * card wants the history, a running one wants the room. Collapsing them
	 * into one list loses whichever answer the other state needed.
	 *
	 * Optional, because a card written before this existed does not carry it,
	 * and because an ended call has no present.
	 */
	present?: CallLifecycleParticipant[];
	/**
	 * Who started the call.
	 *
	 * The one field from #1361 that carries information nothing else does:
	 * `participants` says who was there and `present` who is there, but
	 * neither says who picked up the phone. Optional, because cards written
	 * before this exist and because a call reconstructed from the backend may
	 * not know.
	 *
	 * #1361's `participant_count` is deliberately NOT here. It duplicates
	 * `participants.length`, and a count that can disagree with the list it
	 * counts is worse than no count.
	 */
	actorUserId?: string;
	/**
	 * Whether this call is a group call, as the side that STARTED it decided.
	 *
	 * Carried rather than re-derived, because the two derivations disagree
	 * exactly where it matters. `startSupervisionCall` counts the side room's
	 * participants; the rejoin path had only the client-facing session's
	 * `isGroup`, which is false for a supervision call inside a 1:1 session.
	 * A call rejoined as non-group is ended for everybody when one person
	 * leaves — `endCall` publishes a remote hangup and finalises the
	 * lifecycle — while the other supervisors are still in it.
	 *
	 * Optional, because cards written before this exist. A reader without it
	 * falls back to what it used to do.
	 */
	isGroup?: boolean;
	invitedAt?: string;
	startedAt?: string;
	endedAt?: string;
	durationSeconds?: number;
}

/** Match the complete identity of one durable call lifecycle. */
export function hasSameCallLifecycleIdentity(
	left: CallLifecycleMessage,
	right: CallLifecycleMessage
): boolean {
	return (
		left.callId === right.callId &&
		left.roomRef === right.roomRef &&
		left.callRoomId === right.callRoomId &&
		left.callType === right.callType
	);
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
	const {
		call_id,
		room_ref,
		call_room_id,
		state,
		call_type,
		participants,
		present,
		actor_user_id: actorUserId,
		is_group: isGroup
	} = payload;
	if (!isString(call_id) || !isString(room_ref) || !isString(call_room_id))
		return null;
	if (state !== 'running' && state !== 'ended' && state !== 'missed')
		return null;
	if (call_type !== 'audio' && call_type !== 'video') return null;
	const isParticipantList = (value: unknown) =>
		Array.isArray(value) &&
		value.every(
			(participant) =>
				isRecord(participant) &&
				isString(participant.userId) &&
				isString(participant.displayName)
		);
	if (!isParticipantList(participants)) return null;
	// Absent is fine — a card written before `present` existed, or an ended
	// call. Present but malformed is not: it would reach a card as a list of
	// people who are not there.
	if (present !== undefined && !isParticipantList(present)) return null;
	// Absent is fine; present but not a user id is not. It reaches a card as
	// a name, and a card is a thing people read and believe.
	if (actorUserId !== undefined && !isString(actorUserId)) return null;
	// Absent is fine; present but not a boolean is not. It decides whether
	// leaving ends the call for everybody else.
	if (isGroup !== undefined && typeof isGroup !== 'boolean') return null;
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
		participants: (participants as CallLifecycleParticipant[]).map(
			(participant) => ({
				userId: participant.userId,
				displayName: participant.displayName
			})
		),
		...(present === undefined
			? {}
			: {
					present: (present as CallLifecycleParticipant[]).map(
						(participant) => ({
							userId: participant.userId,
							displayName: participant.displayName
						})
					)
				}),
		...(actorUserId === undefined
			? {}
			: { actorUserId: actorUserId as string }),
		...(isGroup === undefined ? {} : { isGroup: isGroup as boolean }),
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
			present: message.present,
			actor_user_id: message.actorUserId,
			is_group: message.isGroup,
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
		if (!hasSameCallLifecycleIdentity(before, after)) continue;
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
			!existing.callLifecycle ||
			!hasSameCallLifecycleIdentity(existing.callLifecycle, call)
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
