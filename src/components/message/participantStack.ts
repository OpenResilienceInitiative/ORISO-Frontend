/**
 * Pure rules behind the participant avatar stack of a chat room header
 * (Figma "Room Header All" → "Avatar Group", ORISO-Frontend#1193).
 *
 * - latest activity first, the advice seeker wins a tie, then caller order;
 * - duplicates (same Matrix id) collapse into one entry;
 * - beyond `maxVisible` avatars the tail folds into a "+N" counter.
 *
 * No React, no DOM — `ParticipantAvatarStack` only renders what this returns.
 */

export interface StackParticipant {
	userId: string;
	username?: string;
	/** Resolved display name (#1209: askers = the anonymous user id). */
	displayName: string;
	firstName?: string;
	lastName?: string;
	/** Advice seeker → animal avatar; everyone else → monogram / photo. */
	isAsker?: boolean;
	/** Timestamp (ms) of the participant's last message, if known. */
	lastActivity?: number;
}

export interface ParticipantStack {
	visible: StackParticipant[];
	/** Count folded into the "+N" chip; 0 when everyone fits. */
	overflow: number;
}

/** Figma #430: a room header shows at most four avatars before "+N". */
export const STACK_MAX_VISIBLE = 4;

const activityOf = (participant: StackParticipant) =>
	Number.isFinite(participant.lastActivity)
		? (participant.lastActivity as number)
		: Number.NEGATIVE_INFINITY;

export const resolveParticipantStack = (
	participants: StackParticipant[],
	maxVisible: number = STACK_MAX_VISIBLE
): ParticipantStack => {
	const seen = new Set<string>();
	const unique = participants.filter((participant) => {
		if (!participant.userId || seen.has(participant.userId)) {
			return false;
		}
		seen.add(participant.userId);
		return true;
	});

	const ordered = unique
		.map((participant, index) => ({ participant, index }))
		.sort((a, b) => {
			const activityA = activityOf(a.participant);
			const activityB = activityOf(b.participant);
			if (activityA !== activityB) {
				return activityB > activityA ? 1 : -1;
			}
			const byAsker =
				Number(Boolean(b.participant.isAsker)) -
				Number(Boolean(a.participant.isAsker));
			if (byAsker !== 0) {
				return byAsker;
			}
			return a.index - b.index;
		})
		.map(({ participant }) => participant);

	const limit = Math.max(0, Math.floor(maxVisible));
	if (ordered.length <= limit) {
		return { visible: ordered, overflow: 0 };
	}
	return {
		visible: ordered.slice(0, limit),
		overflow: ordered.length - limit
	};
};
