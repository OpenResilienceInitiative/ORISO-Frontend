/**
 * Thread-panel-UX (#435) — pure summary computation extracted from
 * SessionItemComponent so it is unit-testable. Same relation-first,
 * legacy-[THREAD:]-prefix-fallback read as the rest of the relations work.
 */

import { parseMessagePrefixes } from '../components/message/messageConstants';

export interface ThreadableMessage {
	_id: string;
	message: string;
	messageTime: string;
	threadRootEventId?: string | null;
}

export interface ThreadSummary {
	rootId: string;
	replyCount: number;
	lastReplyTs: number;
	rootPreview: string;
}

export const computeThreadSummaries = (
	messages: ThreadableMessage[]
): Map<string, ThreadSummary> => {
	const byId = new Map(messages.map((message) => [message._id, message]));
	const map = new Map<string, ThreadSummary>();

	messages.forEach((message) => {
		const parsed = parseMessagePrefixes(message.message);
		const rootId = message.threadRootEventId || parsed.threadRootId;
		if (!rootId) {
			return;
		}

		const rootMessage = byId.get(rootId);
		const rootPreview = rootMessage
			? parseMessagePrefixes(rootMessage.message).cleanedMessage
			: '';

		const existing = map.get(rootId);
		map.set(rootId, {
			rootId,
			replyCount: (existing?.replyCount || 0) + 1,
			lastReplyTs: new Date(message.messageTime).getTime(),
			rootPreview
		});
	});

	return map;
};
