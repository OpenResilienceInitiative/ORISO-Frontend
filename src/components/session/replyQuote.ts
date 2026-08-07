/**
 * Quote / edit payloads handed from the timeline to the composer (#435, #978).
 *
 * Stored messages are transport markup: an ORISO prefix ([VISIBLE_TO:…]),
 * optional [[align:…]] / [[hl:…]] tokens and HTML. Neither the plain-text quote
 * preview nor the rich-text editor understands those tokens, so every hand-off
 * has to go through a converter — passing the raw body through a naive
 * `replace(/<[^>]*>/g, '')` left the tokens visible to the user (#978) and, for
 * edits, re-wrapped them into nested tokens on send.
 */

import { toMessagePreviewText } from '../../utils/messagePreviewText';
import { transportMarkupToComposerHtml } from '../messageSubmitInterface/transportMarkupToComposerHtml';

/** Longest quote preview rendered inside a message bubble. */
export const REPLY_QUOTE_PREVIEW_MAX_LENGTH = 200;

type QuotableMessage = {
	_id?: string;
	message?: string | null;
	displayName?: string | null;
	username?: string | null;
};

export type ReplyQuoteContext = {
	eventId: string;
	author: string;
	text: string;
};

export type EditContext = {
	eventId: string;
	text: string;
};

const resolveAuthor = (message: QuotableMessage): string =>
	message.displayName || message.username || '';

/** Composer reply context ("Antwort an …") — plain text, never markup. */
export const buildReplyQuoteContext = (
	message: QuotableMessage
): ReplyQuoteContext => ({
	eventId: message._id || '',
	author: resolveAuthor(message),
	text: toMessagePreviewText(message.message)
});

/** In-bubble quote of the replied-to message — plain text, length-capped. */
export const buildReplyQuotePreview = (
	message: QuotableMessage
): Omit<ReplyQuoteContext, 'eventId'> => ({
	author: resolveAuthor(message),
	text: toMessagePreviewText(message.message).slice(
		0,
		REPLY_QUOTE_PREVIEW_MAX_LENGTH
	)
});

/** Edit context — editor HTML, so formatting survives the round trip. */
export const buildEditContext = (message: QuotableMessage): EditContext => ({
	eventId: message._id || '',
	text: transportMarkupToComposerHtml(message.message)
});
