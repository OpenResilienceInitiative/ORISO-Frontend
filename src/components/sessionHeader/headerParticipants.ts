/**
 * Pure helpers behind the session header's participant stack (T4,
 * FE#1193): who is in the room and when each person last wrote.
 *
 * The header subscribes to the Matrix client for the *active* room only and
 * keeps "last activity" incrementally — one seed scan of the live timeline
 * on open, then one `bumpLastActivity` per incoming event (stage v3 review:
 * no full timeline rescan per event in every room).
 */
import type { StackParticipant } from '../message/participantStack';

export interface TimelineEventLike {
	getSender?: () => string | undefined;
	sender?: { userId?: string };
	getTs?: () => number | undefined;
	localTimestamp?: number;
}

export interface RoomMemberLike {
	userId: string;
	name?: string;
}

export interface RoomLike {
	roomId?: string;
}

const senderOf = (event: TimelineEventLike | undefined) =>
	event?.getSender?.() ?? event?.sender?.userId;

const timestampOf = (event: TimelineEventLike | undefined) => {
	const ts = event?.getTs?.() ?? event?.localTimestamp;
	return Number.isFinite(ts) ? (ts as number) : undefined;
};

/** Newest timestamp per sender — one pass over the live timeline. */
export const seedLastActivity = (
	events: TimelineEventLike[]
): Map<string, number> => {
	const lastActivity = new Map<string, number>();
	events.forEach((event) => bumpLastActivity(lastActivity, event));
	return lastActivity;
};

/** Records `event` for its sender; `true` when the map actually changed. */
export const bumpLastActivity = (
	lastActivity: Map<string, number>,
	event: TimelineEventLike | undefined
): boolean => {
	const sender = senderOf(event);
	const ts = timestampOf(event);
	if (!sender || ts === undefined) {
		return false;
	}
	const known = lastActivity.get(sender);
	if (known !== undefined && known >= ts) {
		return false;
	}
	lastActivity.set(sender, ts);
	return true;
};

/** Only the active room feeds the header — events without a room are ignored. */
export const isEventForRoom = (
	roomId: string,
	room: RoomLike | null | undefined
): boolean => Boolean(room?.roomId) && room?.roomId === roomId;

export const toStackParticipants = (
	members: RoomMemberLike[],
	lastActivity: Map<string, number>,
	{
		askerMatrixUserId,
		askerDisplayName,
		isSystemUser
	}: {
		askerMatrixUserId?: string;
		/** #1209: the asker is named exactly like the header title. */
		askerDisplayName?: string | null;
		isSystemUser: (userId: string) => boolean;
	}
): StackParticipant[] =>
	members
		.filter((member) => member?.userId && !isSystemUser(member.userId))
		.map((member) => {
			const isAsker = member.userId === askerMatrixUserId;
			return {
				userId: member.userId,
				username: member.userId,
				displayName:
					(isAsker ? askerDisplayName : undefined) ||
					member.name ||
					member.userId,
				isAsker,
				lastActivity: lastActivity.get(member.userId)
			};
		});
