import { normalizeHighlightColor } from './richtextHelpers';

/**
 * Composer HTML → transport markup.
 *
 * Highlight colours and block alignment cannot travel as HTML: downstream
 * markdown conversion drops `<mark>` styles and inline `text-align`, so both
 * are encoded as `[[hl:…]]` / `[[align:…]]` tokens instead. The inverse lives
 * in `transportMarkupToComposerHtml` (composer) and in the render pipeline of
 * `MessageItemComponent` (timeline) — change one and the other two need the
 * same change, which is what the round-trip test in
 * `composerTransportEncoding.test.ts` guards.
 *
 * Extracted from `messageSubmitInterfaceComponent` so the encoding can be
 * tested on its own; the behaviour is unchanged.
 */

/** `<mark …>x</mark>` → `[[hl:#rrggbb]]x[[/hl]]`. */
export const encodeHighlightColorsForTransport = (
	rawMessage: string
): string => {
	if (!rawMessage) {
		return rawMessage;
	}
	return rawMessage.replace(
		/<mark([^>]*)>([\s\S]*?)<\/mark>/gi,
		(_full, attrs: string, inner: string) => {
			const styleMatch = attrs.match(/style\s*=\s*["']([^"']*)["']/i);
			const dataColorMatch = attrs.match(
				/data-color\s*=\s*["']([^"']+)["']/i
			);
			const styleColorMatch = styleMatch?.[1]?.match(
				/background-color\s*:\s*([^;]+)/i
			);
			const color =
				normalizeHighlightColor(dataColorMatch?.[1] || '') ||
				normalizeHighlightColor(styleColorMatch?.[1] || '') ||
				normalizeHighlightColor(attrs || '');
			if (!color) {
				return `<mark>${inner}</mark>`;
			}
			// Use a backend-safe token format to avoid downstream conversions that drop color.
			return `[[hl:${color}]]${inner}[[/hl]]`;
		}
	);
};

/** `<p style="text-align: center">x</p>` → `[[align:center]]<p>x</p>[[/align]]`. */
export const encodeAlignmentForTransport = (rawMessage: string): string => {
	if (!rawMessage) {
		return rawMessage;
	}
	return rawMessage.replace(
		/<(p|h[1-6])([^>]*)>([\s\S]*?)<\/\1>/gi,
		(_full, tagName: string, attrs: string, inner: string) => {
			const styleAlignMatch = attrs.match(
				/text-align\s*:\s*(left|center|right)/i
			);
			const dataAlignMatch = attrs.match(
				/data-text-align\s*=\s*["'](left|center|right)["']/i
			);
			const align = (
				dataAlignMatch?.[1] ||
				styleAlignMatch?.[1] ||
				''
			).toLowerCase();
			if (!align) {
				return `<${tagName}${attrs}>${inner}</${tagName}>`;
			}
			return `[[align:${align}]]<${tagName}>${inner}</${tagName}>[[/align]]`;
		}
	);
};

/** The full outbound encoding, in the order the send path applies it. */
export const composerHtmlToTransportMarkup = (rawMessage: string): string =>
	encodeAlignmentForTransport(
		encodeHighlightColorsForTransport(rawMessage)
	).trim();
