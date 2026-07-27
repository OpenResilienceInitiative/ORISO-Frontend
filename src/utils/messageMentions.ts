/**
 * Intentional mentions (#435) — `m.mentions` pure helpers.
 *
 * Robust + E2EE-safe by construction: `extractMentionedUserIds` only reads
 * `data-mention-matrix-id`, an attribute the composer populates exclusively
 * from a *resolved* Matrix room-member id (never a display name, never a
 * guess at a homeserver localpart). A pill without that attribute (a
 * consultant not yet in the room, so no member id exists to resolve)
 * contributes nothing here — evaluated entirely client-side, no
 * display-name matching.
 */

// Matrix user id: @localpart:server_name (MSC1215 grammar, loosely checked —
// good enough to reject obviously-malformed values without a full parser).
const MATRIX_USER_ID_PATTERN = /^@[^:@\s]+:.+$/;

/** Reads every resolved mentioned user id out of composer HTML, deduped. */
export const extractMentionedUserIds = (html: string | undefined): string[] => {
	if (!html) {
		return [];
	}
	const seen = new Set<string>();
	const result: string[] = [];
	const pattern = /data-mention-matrix-id="([^"]*)"/g;
	let match: RegExpExecArray | null;
	while ((match = pattern.exec(html)) !== null) {
		const userId = match[1];
		if (!MATRIX_USER_ID_PATTERN.test(userId) || seen.has(userId)) {
			continue;
		}
		seen.add(userId);
		result.push(userId);
	}
	return result;
};

/** Reads the mentioned user ids off received event content, if any. */
export const getMentionedUserIdsFromContent = (content: unknown): string[] => {
	const mentions = (content as Record<string, any>)?.['m.mentions'];
	const userIds = mentions?.user_ids;
	return Array.isArray(userIds)
		? userIds.filter((id: unknown): id is string => typeof id === 'string')
		: [];
};

export interface MentionsContentFragment {
	'm.mentions'?: { user_ids: string[] };
}

/**
 * `m.mentions` content fragment to spread into the outgoing event content.
 * Empty object (nothing to merge) when there are no mentions, matching the
 * relations helpers' spread-friendly shape.
 */
export const buildMentionsContent = (
	userIds: string[] | undefined
): MentionsContentFragment => {
	if (!userIds || userIds.length === 0) {
		return {};
	}
	return { 'm.mentions': { user_ids: userIds } };
};
