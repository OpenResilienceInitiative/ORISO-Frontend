export interface MentionCandidate {
	/** Stable id (consultantId) — becomes the mention node id. */
	id: string;
	displayName: string;
	username: string;
	/** Resolved Matrix user id, if the consultant is matched to a room member. */
	matrixUserId?: string;
	/** True when the consultant is a member of the current chat room. */
	isInRoom: boolean;
}

const normalize = (value: string): string =>
	value
		.toLowerCase()
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '');

/**
 * Filters agency consultants for the @-mention popup. Diacritics-insensitive
 * substring match on display name and username; excludes the author; sorts
 * in-room members first so the most relevant mentions are on top. Members not
 * in the current chat are still shown (flagged via isInRoom) so a consultant
 * can be pulled into the conversation.
 */
export const filterMentionCandidates = (
	candidates: MentionCandidate[],
	query: string,
	selfId?: string
): MentionCandidate[] => {
	const normalizedQuery = normalize(query.trim());
	return candidates
		.filter((candidate) => candidate.id !== selfId)
		.filter((candidate) => {
			if (!normalizedQuery) {
				return true;
			}
			return (
				normalize(candidate.displayName).includes(normalizedQuery) ||
				normalize(candidate.username).includes(normalizedQuery)
			);
		})
		.sort((a, b) => {
			if (a.isInRoom !== b.isInRoom) {
				return a.isInRoom ? -1 : 1;
			}
			return a.displayName.localeCompare(b.displayName);
		});
};
