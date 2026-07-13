/**
 * Relations foundation (#435) — Matrix message relations, pure helpers.
 *
 * Reply is modeled as the spec's `m.relates_to`/`m.in_reply_to` relation on
 * the event content (NOT a bespoke mechanism): robust, E2EE-safe (evaluated
 * client-side after decryption) and the same mechanic threads (`m.thread`),
 * editing (`m.replace`) and reactions (`m.annotation`) build on.
 *
 * SDK-free and React-free on purpose: unit-testable in node, usable from the
 * transport (content building) and the timeline formatter (reading).
 */

export interface TextMessageContentOptions {
	/** Event id of the message being replied to (rich reply). */
	replyToEventId?: string | null;
}

/** Build `m.room.message` content, attaching a reply relation when given. */
export const buildTextMessageContent = (
	message: string,
	options?: TextMessageContentOptions
): Record<string, unknown> => {
	const content: Record<string, unknown> = {
		msgtype: 'm.text',
		body: message
	};
	if (options?.replyToEventId) {
		content['m.relates_to'] = {
			'm.in_reply_to': { event_id: options.replyToEventId }
		};
	}
	return content;
};

/**
 * Read the replied-to event id from event content. Handles both pure replies
 * and MSC3440 thread events that carry an `m.in_reply_to` fallback alongside
 * `rel_type: m.thread`. Returns null for anything else.
 */
export const getReplyToEventId = (content: unknown): string | null => {
	const relatesTo = (content as Record<string, any>)?.['m.relates_to'];
	const eventId = relatesTo?.['m.in_reply_to']?.event_id;
	return typeof eventId === 'string' && eventId ? eventId : null;
};

/**
 * Strip the legacy rich-reply fallback (leading `> `-quoted block followed by
 * a blank line) that Element-family clients prepend to reply bodies. Our own
 * clients render the quote from the relation instead, so the fallback would
 * duplicate it.
 */
export const stripReplyFallback = (body: string | undefined): string => {
	if (!body) {
		return '';
	}
	if (!body.startsWith('> ')) {
		return body;
	}
	const separator = body.indexOf('\n\n');
	if (separator === -1) {
		return body;
	}
	// Every line before the blank separator must be part of the quote block.
	const quoted = body.slice(0, separator).split('\n');
	if (!quoted.every((line) => line.startsWith('>'))) {
		return body;
	}
	return body.slice(separator + 2);
};
