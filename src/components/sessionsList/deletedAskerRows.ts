import type { DeletedAskerSession } from '../../api/apiGetDeletedAskerSessions';

/**
 * A grey, non-clickable row "Gelöschte:r Ratsuchende:r" in the counsellor's
 * conversation list (ORISO-Frontend#1159). It stands where the deleted chat
 * used to be, so the counsellor can tell a deletion from a technical problem.
 * It carries no personal data.
 */
export interface DeletedAskerRow {
	key: string;
	formerSessionId: number;
	/** Epoch milliseconds: where the row sorts among the conversations. */
	timestamp: number;
}

/** A chat whose advice seeker is marked for deletion but not yet deleted. */
export interface MarkedForDeletionSession {
	sessionId: number;
	lastInteraction: number;
}

/**
 * One row per former session, newest first. Two sources: placeholders the
 * backend keeps after the hard deletion, and chats still in the list whose
 * advice seeker is marked for deletion (the list hides those). A session that
 * is still shown as a real conversation never gets a placeholder as well.
 */
export const buildDeletedAskerRows = (
	placeholders: DeletedAskerSession[],
	markedForDeletion: MarkedForDeletionSession[],
	shownSessionIds: ReadonlySet<number>
): DeletedAskerRow[] => {
	const rows = new Map<number, DeletedAskerRow>();
	markedForDeletion.forEach(({ sessionId, lastInteraction }) => {
		rows.set(sessionId, {
			key: `deleted-asker:${sessionId}`,
			formerSessionId: sessionId,
			timestamp: lastInteraction
		});
	});
	placeholders.forEach(({ formerSessionId, deletedAt }) => {
		if (rows.has(formerSessionId)) return;
		rows.set(formerSessionId, {
			key: `deleted-asker:${formerSessionId}`,
			formerSessionId,
			timestamp: Date.parse(deletedAt)
		});
	});
	return [...rows.values()]
		.filter(
			(row) =>
				Number.isFinite(row.timestamp) &&
				!shownSessionIds.has(row.formerSessionId)
		)
		.sort((left, right) => right.timestamp - left.timestamp);
};

/**
 * Slots the rows between the conversations, which are sorted newest first.
 * `before[i]` holds the rows shown right above conversation `i`; `trailing`
 * holds the rows older than every loaded conversation. Those are only shown
 * once no further page can load, so a row never jumps ahead of conversations
 * that are simply not loaded yet.
 */
export const placeDeletedAskerRows = (
	conversationTimestamps: number[],
	rows: DeletedAskerRow[],
	hasMorePages: boolean
): { before: DeletedAskerRow[][]; trailing: DeletedAskerRow[] } => {
	const before: DeletedAskerRow[][] = conversationTimestamps.map(() => []);
	let next = 0;
	conversationTimestamps.forEach((timestamp, index) => {
		while (next < rows.length && rows[next].timestamp >= timestamp) {
			before[index].push(rows[next]);
			next += 1;
		}
	});
	return { before, trailing: hasMorePages ? [] : rows.slice(next) };
};
