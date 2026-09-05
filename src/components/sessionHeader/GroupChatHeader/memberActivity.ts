/**
 * Pure helpers for the conversation header participant stack (#1193).
 *
 * - `getLastActivityByUserId` reads the room's live timeline once and maps
 *   each sender to the timestamp of their latest event.
 * - `sortMembersByActivity` orders members latest-active-first (Job 1).
 * - `computeVisibleAvatarCount` decides how many overlapping avatars fit in
 *   the available width before the tail collapses into a "+N" chip (Job 2).
 */

export type ActivityMap = Map<string, number>;

type TimelineEventLike = {
	getSender?: () => string | undefined;
	getTs?: () => number | undefined;
};

type RoomLike = {
	getLiveTimeline?: () =>
		| { getEvents?: () => TimelineEventLike[] }
		| undefined;
};

export type MemberLike = {
	userId: string;
	name?: string;
	events?: { member?: { getTs?: () => number | undefined } | null };
};

export const getLastActivityByUserId = (room: RoomLike | null | undefined) => {
	const activity: ActivityMap = new Map();
	const events = room?.getLiveTimeline?.()?.getEvents?.() || [];
	for (const event of events) {
		const sender = event?.getSender?.();
		const ts = event?.getTs?.();
		if (!sender || typeof ts !== 'number' || Number.isNaN(ts)) {
			continue;
		}
		if ((activity.get(sender) ?? -Infinity) < ts) {
			activity.set(sender, ts);
		}
	}
	return activity;
};

/** Membership-event timestamp (join time) used when a member never spoke. */
export const getMemberJoinTs = (member: MemberLike): number => {
	const ts = member?.events?.member?.getTs?.();
	return typeof ts === 'number' && !Number.isNaN(ts) ? ts : 0;
};

export const sortMembersByActivity = <T extends MemberLike>(
	members: readonly T[],
	activity: ActivityMap
): T[] =>
	[...members].sort((a, b) => {
		const tsA = activity.get(a.userId) ?? getMemberJoinTs(a);
		const tsB = activity.get(b.userId) ?? getMemberJoinTs(b);
		if (tsA !== tsB) {
			return tsB - tsA; // latest first
		}
		return (a.name || a.userId).localeCompare(b.name || b.userId);
	});

export interface AvatarStackMetrics {
	/** Rendered avatar diameter in px (`.sessionInfo__memberBubble`). */
	avatarSize: number;
	/** How far each following avatar overlaps the previous one, in px. */
	overlap: number;
	/** Width reserved for the "+N" chip, in px. */
	chipWidth: number;
	/** Figma #430: never show more than this many avatars, even with room. */
	maxVisible: number;
}

export const AVATAR_STACK_METRICS: AvatarStackMetrics = {
	avatarSize: 32,
	overlap: 10,
	chipWidth: 64,
	maxVisible: 4
};

const stackWidth = (
	visible: number,
	withChip: boolean,
	m: AvatarStackMetrics
): number => {
	const avatars =
		visible === 0
			? 0
			: m.avatarSize + (visible - 1) * (m.avatarSize - m.overlap);
	const chip = withChip ? m.chipWidth - (visible > 0 ? m.overlap : 0) : 0;
	return avatars + chip;
};

/**
 * Number of avatars to render for `total` members given `availableWidth`
 * px. Unknown width (no ResizeObserver yet, jsdom) → the Figma cap applies.
 * Returns 0 when only the "+N" chip fits, in which case N === total.
 */
export const computeVisibleAvatarCount = (
	total: number,
	availableWidth: number | null | undefined,
	metrics: AvatarStackMetrics = AVATAR_STACK_METRICS
): number => {
	if (!Number.isFinite(total) || total <= 0) {
		return 0;
	}
	const cap = Math.min(total, metrics.maxVisible);
	if (
		availableWidth == null ||
		!Number.isFinite(availableWidth) ||
		availableWidth <= 0
	) {
		return cap;
	}
	for (let visible = cap; visible > 0; visible -= 1) {
		if (stackWidth(visible, visible < total, metrics) <= availableWidth) {
			return visible;
		}
	}
	return 0;
};
