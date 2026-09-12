/**
 * Thread-panel-UX (#435) — pure summary computation extracted from
 * SessionItemComponent so it is unit-testable. Thread identity comes ONLY
 * from the native `m.thread` relation (ADR-017 hard cut): the message's
 * `threadRootEventId`. No legacy `[THREAD:]`-prefix fallback.
 *
 * T21: the summary also carries who replied last and what they wrote, so
 * the thread entry under the root message (and the channel menu) can show
 * "Author: text…" instead of a bare time.
 */

import { toMessagePreviewText } from './messagePreviewText';

export interface ThreadableMessage {
	_id: string;
	message: string;
	messageTime: string;
	threadRootEventId?: string | null;
	displayName?: string;
	username?: string;
}

export interface ThreadSummary {
	rootId: string;
	replyCount: number;
	lastReplyTs: number;
	rootPreview: string;
	/** Display name (else username) of the last reply's author; '' if unknown. */
	lastReplyAuthor: string;
	/** Plain-text preview of the last reply. */
	lastReplyPreview: string;
}

const authorOf = (message: ThreadableMessage): string =>
	(message.displayName || message.username || '').trim();

export const computeThreadSummaries = (
	messages: ThreadableMessage[]
): Map<string, ThreadSummary> => {
	const byId = new Map(messages.map((message) => [message._id, message]));
	const map = new Map<string, ThreadSummary>();

	messages.forEach((message) => {
		const rootId = message.threadRootEventId;
		if (!rootId) {
			return;
		}

		const rootMessage = byId.get(rootId);
		const rootPreview = rootMessage
			? toMessagePreviewText(rootMessage.message)
			: '';

		const existing = map.get(rootId);
		map.set(rootId, {
			rootId,
			replyCount: (existing?.replyCount || 0) + 1,
			lastReplyTs: new Date(message.messageTime).getTime(),
			rootPreview,
			lastReplyAuthor: authorOf(message),
			lastReplyPreview: toMessagePreviewText(message.message)
		});
	});

	return map;
};

/** Longest thread-entry preview (characters, ellipsis included). */
export const THREAD_ENTRY_PREVIEW_MAX = 80;

/**
 * "Autor: letzte Nachricht" on one line — the author alone when there is
 * no text, the text alone when the author is unknown, '' without both.
 */
export const formatThreadEntryPreview = (
	summary: Pick<ThreadSummary, 'lastReplyAuthor' | 'lastReplyPreview'>,
	max: number = THREAD_ENTRY_PREVIEW_MAX
): string => {
	const author = summary.lastReplyAuthor.trim();
	const text = summary.lastReplyPreview.replace(/\s+/g, ' ').trim();
	const line = author && text ? `${author}: ${text}` : author || text;
	if (line.length <= max) {
		return line;
	}
	return `${line.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
};
