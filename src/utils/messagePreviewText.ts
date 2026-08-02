/**
 * One-line plain-text previews for transport-stored messages.
 * Strips ORISO protocol prefixes, [[align:]] / [[hl:]] tokens, and HTML tags.
 */

import { parseMessagePrefixes } from '../components/message/messageConstants';

const decodeNumericEntity = (
	match: string,
	codePoint: string,
	radix: number
): string => {
	const parsed = Number.parseInt(codePoint, radix);
	return Number.isFinite(parsed) &&
		parsed >= 0 &&
		parsed <= 0x10ffff &&
		!(parsed >= 0xd800 && parsed <= 0xdfff)
		? String.fromCodePoint(parsed)
		: match;
};

const decodeHtmlEntities = (value: string): string =>
	value
		.replace(/&amp;/gi, '&')
		.replace(/&lt;/gi, '<')
		.replace(/&gt;/gi, '>')
		.replace(/&quot;/gi, '"')
		.replace(/&#39;|&apos;/gi, "'")
		.replace(/&#(\d+);/g, (match, codePoint: string) =>
			decodeNumericEntity(match, codePoint, 10)
		)
		.replace(/&#x([\da-f]+);/gi, (match, codePoint: string) =>
			decodeNumericEntity(match, codePoint, 16)
		);

const unwrapTransportTokens = (value: string): string => {
	let text = value;

	// Keep inner text from highlight / align wrappers (double-bracket + legacy).
	text = text.replace(
		/\[\[hl:[^\]]+\]\]([\s\S]*?)\[\[\/hl\]\]|\[hl:[^\]]+\]([\s\S]*?)\[\/hl\]/gi,
		(_match, doubleInner: string, legacyInner: string) =>
			doubleInner ?? legacyInner ?? ''
	);

	text = text.replace(
		/\[\[align:(?:left|center|right)\]\]([\s\S]*?)\[\[\/align\]\]/gi,
		(_match, inner: string) => inner ?? ''
	);

	// Drop any leftover transport tokens that are not valid preview content.
	text = text.replace(/\[\[[^\]]*\]\]/g, '');

	return text;
};

const htmlToPlainText = (value: string): string => {
	const normalizedValue = value
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<\/(p|div|li|h[1-6]|blockquote|pre)>/gi, '\n')
		.replace(/&nbsp;/gi, ' ')
		.replace(/&#160;/gi, ' ')
		.replace(/\u00a0/g, ' ')
		.replace(/\u200b/g, '');

	if (!normalizedValue.trim()) {
		return '';
	}

	let plainText: string;
	if (typeof document !== 'undefined' && document.createElement) {
		const container = document.createElement('div');
		container.innerHTML = normalizedValue;
		plainText = container.textContent || '';
	} else {
		plainText = decodeHtmlEntities(
			normalizedValue.replace(/<[^>]+>/g, ' ')
		);
	}

	return plainText.replace(/\u00a0/g, ' ').replace(/\u200b/g, '');
};

/**
 * Convert a stored message body into a one-line human-readable preview.
 */
export const toMessagePreviewText = (rawMessage?: string | null): string => {
	const { cleanedMessage } = parseMessagePrefixes(rawMessage);
	if (!cleanedMessage.trim()) {
		return '';
	}

	const withoutTokens = unwrapTransportTokens(cleanedMessage);
	const plain = htmlToPlainText(withoutTokens);

	return plain.replace(/\s+/g, ' ').trim();
};
