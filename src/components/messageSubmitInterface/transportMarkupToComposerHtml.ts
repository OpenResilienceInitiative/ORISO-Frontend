import { parseMessagePrefixes } from '../message/messageConstants';
import { normalizeHighlightColor } from './richtextHelpers';

const escapeHtml = (value: string): string =>
	value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');

const applyAlignToInnerHtml = (inner: string, align: string): string => {
	const trimmed = inner.trim();
	if (!trimmed) {
		return '';
	}

	if (/<(p|h[1-6]|div|blockquote|li)\b/i.test(trimmed)) {
		return trimmed.replace(
			/<(p|h[1-6]|div|blockquote)(\b[^>]*)>/gi,
			(_full, tag: string, attrs: string) => {
				let nextAttrs = attrs || '';
				if (/style\s*=/i.test(nextAttrs)) {
					nextAttrs = nextAttrs.replace(
						/style\s*=\s*(["'])(.*?)\1/i,
						(_m, quote: string, style: string) => {
							const cleaned = style
								.replace(/text-align\s*:\s*[^;]+;?/gi, '')
								.trim();
							const merged = cleaned
								? `${cleaned}; text-align: ${align}`
								: `text-align: ${align}`;
							return `style=${quote}${merged}${quote}`;
						}
					);
				} else {
					nextAttrs += ` style="text-align: ${align}"`;
				}
				if (!/data-text-align\s*=/i.test(nextAttrs)) {
					nextAttrs += ` data-text-align="${align}"`;
				}
				return `<${tag}${nextAttrs}>`;
			}
		);
	}

	return `<p style="text-align: ${align}" data-text-align="${align}">${escapeHtml(
		trimmed
	).replace(/\n/g, '<br>')}</p>`;
};

/**
 * Convert stored message transport markup into TipTap-ready HTML.
 * Strips ORISO prefixes and rehydrates [[align:]] / [[hl:]] tokens.
 */
export const transportMarkupToComposerHtml = (
	rawMessage?: string | null
): string => {
	const { cleanedMessage } = parseMessagePrefixes(rawMessage);
	if (!cleanedMessage.trim()) {
		return '';
	}

	let html = cleanedMessage;

	html = html.replace(
		/\[\[hl:([^\]]+)\]\]([\s\S]*?)\[\[\/hl\]\]|\[hl:([^\]]+)\]([\s\S]*?)\[\/hl\]/gi,
		(
			_match,
			doubleColor: string,
			doubleInner: string,
			legacyColor: string,
			legacyInner: string
		) => {
			const colorRaw = doubleColor || legacyColor;
			const inner = doubleInner ?? legacyInner ?? '';
			const color = normalizeHighlightColor(colorRaw);
			if (!color) {
				return `<mark>${inner}</mark>`;
			}
			return `<mark data-color="${color}" style="background-color: ${color}">${inner}</mark>`;
		}
	);

	html = html.replace(
		/\[\[align:(left|center|right)\]\]([\s\S]*?)\[\[\/align\]\]/gi,
		(_match, alignRaw: string, inner: string) =>
			applyAlignToInnerHtml(inner, alignRaw.toLowerCase())
	);

	// Drop any leftover transport tokens that are not valid editor content.
	html = html.replace(/\[\[[^\]]*\]\]/g, '');

	const trimmed = html.trim();
	if (!trimmed) {
		return '';
	}

	if (!/<[a-z][\s\S]*>/i.test(trimmed)) {
		return `<p>${escapeHtml(trimmed).replace(/\n/g, '<br>')}</p>`;
	}

	return trimmed;
};
