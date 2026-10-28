import type { MessageItem } from '../message/MessageItemComponent';

export type TimelineEntry =
	| { kind: 'message'; message: MessageItem; index: number }
	| { kind: 'missing-key'; messages: MessageItem[]; index: number };

const hasDateDivider = (message: MessageItem): boolean =>
	Boolean(message.messageDate?.str || message.messageDate?.date);

/**
 * #1827: messages this device has no room key for are shown as ONE calm
 * notice per run instead of one row each. A run is broken by a readable
 * message, by a date divider (the notice carries its own) and by the optional
 * `breakBeforeIndex` (where the timeline inserts a supplement).
 */
export const groupMissingKeyMessages = (
	messages: MessageItem[],
	breakBeforeIndex = -1
): TimelineEntry[] => {
	const entries: TimelineEntry[] = [];
	messages.forEach((message, index) => {
		if (message.undecryptableReason !== 'missing-key') {
			entries.push({ kind: 'message', message, index });
			return;
		}
		const last = entries[entries.length - 1];
		if (
			last?.kind === 'missing-key' &&
			!hasDateDivider(message) &&
			index !== breakBeforeIndex
		) {
			last.messages.push(message);
			return;
		}
		entries.push({ kind: 'missing-key', messages: [message], index });
	});
	return entries;
};
