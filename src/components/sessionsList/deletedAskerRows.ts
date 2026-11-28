import type { DeletedAskerSession } from '../../api/apiGetDeletedAskerSessions';
import type {
	ListItemInterface,
	TopicsDataInterface
} from '../../globalState/interfaces';

/**
 * A card "Gelöschte:r Ratsuchende:r" in the counsellor's
 * conversation list (ORISO-Frontend#1159). It stands where the deleted chat
 * used to be, so the counsellor can tell a deletion from a technical problem.
 * It carries no personal data.
 */
export interface DeletedAskerRow {
	key: string;
	formerSessionId: number;
	/** Epoch milliseconds: where the row sorts among the conversations. */
	timestamp: number;
	/** Shown in the archive tab: already moved there by the counsellor. */
	archived?: boolean;
	/**
	 * The topic of the former chat where it is still known, so the card keeps
	 * its chip like every conversation (Frank, 2026-11-25).
	 */
	topic?: string;
}

/** A chat whose advice seeker is marked for deletion but not yet deleted. */
export interface MarkedForDeletionSession {
	sessionId: number;
	lastInteraction: number;
	/** Topic name of the chat, when the topic list knows it. */
	topic?: string;
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
	markedForDeletion.forEach(({ sessionId, lastInteraction, topic }) => {
		const row: DeletedAskerRow = {
			key: `deleted-asker:${sessionId}`,
			formerSessionId: sessionId,
			timestamp: lastInteraction
		};
		if (topic) row.topic = topic;
		rows.set(sessionId, row);
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

/** The deleted cards slotted between the conversations. */
export interface DeletedAskerPlacement {
	before: DeletedAskerRow[][];
	trailing: DeletedAskerRow[];
}

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
): DeletedAskerPlacement => {
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

/** Where a card sits in the grouped list: flush with its neighbours. */
export interface ListGroupEdges {
	isGroupStart: boolean;
	isGroupEnd: boolean;
	isBeforeActive: boolean;
	isAfterActive: boolean;
}

/** Group edges for every conversation, and for each deleted card by key. */
export interface ListGroupEdgeMap {
	sessions: ListGroupEdges[];
	rows: Map<string, ListGroupEdges>;
}

/**
 * The grouped list is one outline, broken only around the active card
 * (Frank, 2026-11-25: "der Scroller ordentlich, nicht zerhackt"). Deleted
 * cards stand between the conversations, so the group edges are worked out
 * over both kinds in the order they are drawn: a conversation right below a
 * deleted card is no longer the start of a group, and the last conversation
 * is not the end while deleted cards follow it.
 */
export const listGroupEdges = (
	placement: DeletedAskerPlacement,
	sessionActive: boolean[],
	isRowActive: (row: DeletedAskerRow) => boolean
): ListGroupEdgeMap => {
	const slots: { key: string; active: boolean; session?: number }[] = [];
	sessionActive.forEach((active, index) => {
		(placement.before[index] ?? []).forEach((row) =>
			slots.push({ key: row.key, active: isRowActive(row) })
		);
		slots.push({ key: `session:${index}`, active, session: index });
	});
	placement.trailing.forEach((row) =>
		slots.push({ key: row.key, active: isRowActive(row) })
	);
	const sessions: ListGroupEdges[] = sessionActive.map(() => ({
		isGroupStart: true,
		isGroupEnd: true,
		isBeforeActive: false,
		isAfterActive: false
	}));
	const rows = new Map<string, ListGroupEdges>();
	slots.forEach((slot, index) => {
		const previous = slots[index - 1];
		const next = slots[index + 1];
		const edges: ListGroupEdges = {
			isGroupStart: !previous || previous.active,
			isGroupEnd: !next || next.active,
			isBeforeActive: !!next?.active,
			isAfterActive: !!previous?.active
		};
		if (slot.session === undefined) rows.set(slot.key, edges);
		else sessions[slot.session] = edges;
	});
	return { sessions, rows };
};

/**
 * The topic name of a chat whose advice seeker is marked for deletion: the
 * name the session carries, else the one from the topic list. Undefined when
 * neither knows it, so the card says "gelöscht" instead.
 */
export const deletedAskerTopicName = (
	raw: ListItemInterface,
	topics?: TopicsDataInterface[] | null
): string | undefined => {
	const topic = raw?.session?.topic;
	if (topic?.name) return topic.name;
	const id = topic?.id ?? raw?.session?.mainTopicId;
	if (id === undefined || id === null) return undefined;
	return topics?.find((candidate) => candidate.id === id)?.name || undefined;
};
