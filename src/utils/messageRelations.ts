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
	/** MSC3440: root event id when the message belongs to a thread. */
	threadRootId?: string | null;
}

/**
 * Build `m.room.message` content, attaching relations when given.
 *
 * - reply only            → `m.in_reply_to`
 * - thread only           → `rel_type: m.thread` + falling-back reply to the
 *                            root (spec-compliant rendering on non-thread
 *                            clients)
 * - reply inside a thread → `rel_type: m.thread` + real reply
 *                            (`is_falling_back: false`) to the replied event
 */
export const buildTextMessageContent = (
	message: string,
	options?: TextMessageContentOptions
): Record<string, unknown> => {
	const content: Record<string, unknown> = {
		msgtype: 'm.text',
		body: message
	};
	if (options?.threadRootId) {
		content['m.relates_to'] = {
			'rel_type': 'm.thread',
			'event_id': options.threadRootId,
			'is_falling_back': !options.replyToEventId,
			'm.in_reply_to': {
				event_id: options.replyToEventId || options.threadRootId
			}
		};
	} else if (options?.replyToEventId) {
		content['m.relates_to'] = {
			'm.in_reply_to': { event_id: options.replyToEventId }
		};
	}
	return content;
};

/** Read the MSC3440 thread root from event content, null when not a thread. */
export const getThreadRootId = (content: unknown): string | null => {
	const relatesTo = (content as Record<string, any>)?.['m.relates_to'];
	if (relatesTo?.rel_type !== 'm.thread') {
		return null;
	}
	const eventId = relatesTo?.event_id;
	return typeof eventId === 'string' && eventId ? eventId : null;
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
 * Build `m.room.message` edit content: `rel_type: m.replace` targeting the
 * original event, with the real replacement in `m.new_content` and a
 * `* `-prefixed fallback body for clients that don't render edits.
 */
export const buildEditContent = (
	newMessage: string,
	targetEventId: string
): Record<string, unknown> => ({
	'msgtype': 'm.text',
	'body': `* ${newMessage}`,
	'm.new_content': { msgtype: 'm.text', body: newMessage },
	'm.relates_to': { rel_type: 'm.replace', event_id: targetEventId }
});

/** Read the edited event id from an `m.replace` relation, null otherwise. */
export const getReplaceTargetId = (content: unknown): string | null => {
	const relatesTo = (content as Record<string, any>)?.['m.relates_to'];
	if (relatesTo?.rel_type !== 'm.replace') {
		return null;
	}
	const eventId = relatesTo?.event_id;
	return typeof eventId === 'string' && eventId ? eventId : null;
};

/** Read the replacement body from `m.new_content`, null when absent. */
export const getEditedBody = (content: unknown): string | null => {
	const newContent = (content as Record<string, any>)?.['m.new_content'];
	const body = newContent?.body;
	return typeof body === 'string' && body ? body : null;
};

/** Build `m.reaction` content: `rel_type: m.annotation` on the target event. */
export const buildReactionContent = (
	targetEventId: string,
	key: string
): Record<string, unknown> => ({
	'm.relates_to': {
		rel_type: 'm.annotation',
		event_id: targetEventId,
		key: key
	}
});

export interface ReactionTarget {
	eventId: string;
	key: string;
}

/** Read the annotated event id and reaction key from `m.reaction` content. */
export const getReactionTarget = (content: unknown): ReactionTarget | null => {
	const relatesTo = (content as Record<string, any>)?.['m.relates_to'];
	if (relatesTo?.rel_type !== 'm.annotation') {
		return null;
	}
	const eventId = relatesTo?.event_id;
	const key = relatesTo?.key;
	if (typeof eventId !== 'string' || !eventId) {
		return null;
	}
	if (typeof key !== 'string' || !key) {
		return null;
	}
	return { eventId, key };
};

export interface ReactionEvent {
	eventId: string;
	senderId: string;
	content: unknown;
}

export interface AggregatedReaction {
	key: string;
	count: number;
	senderIds: string[];
	/** Event id of the current user's own reaction, for un-reacting (redact). */
	ownEventId: string | null;
}

/**
 * Group reactions targeting `targetEventId` by emoji key. Order follows
 * first-seen key (stable across re-renders as long as event order is
 * stable), sender order is insertion order.
 */
export const aggregateReactions = (
	reactions: ReactionEvent[],
	targetEventId: string,
	ownUserId: string
): AggregatedReaction[] => {
	const byKey = new Map<string, AggregatedReaction>();

	for (const reaction of reactions) {
		const target = getReactionTarget(reaction.content);
		if (!target || target.eventId !== targetEventId) {
			continue;
		}

		let aggregated = byKey.get(target.key);
		if (!aggregated) {
			aggregated = {
				key: target.key,
				count: 0,
				senderIds: [],
				ownEventId: null
			};
			byKey.set(target.key, aggregated);
		}

		aggregated.count += 1;
		aggregated.senderIds.push(reaction.senderId);
		if (reaction.senderId === ownUserId) {
			aggregated.ownEventId = reaction.eventId;
		}
	}

	return Array.from(byKey.values());
};

export interface EditableMessage {
	_id: string;
	ts: Date | string | number;
	msg?: string;
	replaceTargetId?: string | null;
	editedBody?: string | null;
	[key: string]: unknown;
}

/**
 * Fold `m.replace` edit events into their original message: drops the edit
 * events from the list (they are not messages of their own) and overwrites
 * the original's body with the latest edit (by timestamp), marking it
 * `isEdited`. Edits targeting an id not present in `messages` (edit of an
 * event outside the loaded window) are dropped along with the edit event.
 */
export const applyMessageEdits = <T extends EditableMessage>(
	messages: T[]
): T[] => {
	const editsByTarget = new Map<string, { body: string; ts: number }>();
	for (const message of messages) {
		if (
			!message.replaceTargetId ||
			typeof message.editedBody !== 'string'
		) {
			continue;
		}
		const ts = new Date(message.ts as any).getTime();
		const existing = editsByTarget.get(message.replaceTargetId);
		if (!existing || ts >= existing.ts) {
			editsByTarget.set(message.replaceTargetId, {
				body: message.editedBody,
				ts
			});
		}
	}

	return messages
		.filter((message) => !message.replaceTargetId)
		.map((message) => {
			const edit = editsByTarget.get(message._id);
			if (!edit) {
				return message;
			}
			return { ...message, msg: edit.body, isEdited: true };
		});
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
