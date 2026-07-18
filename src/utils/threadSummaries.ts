/**
 * Thread-panel-UX (#435) — pure summary computation extracted from
 * SessionItemComponent so it is unit-testable. Thread identity comes ONLY
 * from the native `m.thread` relation (ADR-017 hard cut): the message's
 * `threadRootEventId`. No legacy `[THREAD:]`-prefix fallback.
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
		const rootId = message.threadRootEventId;
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
