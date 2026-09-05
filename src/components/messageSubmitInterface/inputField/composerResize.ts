/**
 * Pure composer-resize math. Frank/Figma rule (node 18:1989): the input
 * field may be dragged up to at most two thirds of the viewport height and
 * always spans the chat window width — width is never part of the resize.
 */

export const COMPOSER_MAX_VIEWPORT_FRACTION = 2 / 3;
export const COMPOSER_MOBILE_BREAKPOINT = 899;

// T10 (05.09.): on the phone the composer opens as ONE line and grows while
// typing (auto-grow below). 66 px toolbar strip to the editor top + one
// 20 px line (D1: 14 px × 1.4) + 10 px bottom inset + 2 × 2 px card border
// = 100 px — no dock under the card, no spare line under the placeholder
// (stage v3 review). Desktop keeps its Figma baseline …
const MIN_HEIGHT_MOBILE = 100;
const MIN_HEIGHT_DESKTOP = 196;
// … except in dual mode (T35, side panel open): both composers rest at ONE
// line and grow while typing, like the phone. 1 px border + 16 px dock +
// 66 px toolbar strip = 84 px to the editor, one 20 px line, then 18 px
// editor inset + 16 px dock + 1 px border (+ rounding) = 36 px → 138 px.
const MIN_HEIGHT_COMPACT_DESKTOP = 138;
// T40 (Frank, round 6): in dual mode the composer has NO outer frame any
// more — the field sits directly in the 16 px dock (`flushCorner`). 1 px
// field border + 66 px toolbar strip + one 20 px line + 18 px editor inset
// + 1 px border = 106 px. Flush implies the one-line rule.
const MIN_HEIGHT_FLUSH_DESKTOP = 106;

const STEP_SMALL = 24;
const STEP_LARGE = 48;

export interface ComposerHeightBounds {
	minHeight: number;
	maxHeight: number;
}

export const COMPOSER_AUTO_GROW_MAX_LINES = 14;

export const calculateAutoComposerHeight = ({
	contentHeight,
	lineHeight,
	composerChromeHeight,
	bounds
}: {
	contentHeight: number;
	lineHeight: number;
	composerChromeHeight: number;
	bounds: ComposerHeightBounds;
}): number => {
	const safeLineHeight = Math.max(1, lineHeight);
	const maxContentHeight = safeLineHeight * COMPOSER_AUTO_GROW_MAX_LINES;
	const desiredHeight =
		composerChromeHeight + Math.min(contentHeight, maxContentHeight);
	return clampComposerHeight(
		Math.max(bounds.minHeight, desiredHeight),
		bounds
	);
};

export const getEffectiveComposerHeight = (
	manualHeight: number | null,
	autoHeight: number | null,
	minHeight: number
): number | null => {
	if (manualHeight !== null) {
		return Math.max(manualHeight, autoHeight || minHeight);
	}
	if (!autoHeight || autoHeight <= minHeight) {
		return null;
	}
	return autoHeight;
};

export const getComposerHeightBounds = ({
	viewportWidth,
	viewportHeight,
	compact = false,
	flush = false
}: {
	viewportWidth: number;
	viewportHeight: number;
	/** T35: one line at rest on the desktop too (dual mode). */
	compact?: boolean;
	/** T40: dual mode without the outer frame — one line, 32 px less inset. */
	flush?: boolean;
}): ComposerHeightBounds => {
	const minHeight =
		viewportWidth <= COMPOSER_MOBILE_BREAKPOINT
			? MIN_HEIGHT_MOBILE
			: flush
				? MIN_HEIGHT_FLUSH_DESKTOP
				: compact
					? MIN_HEIGHT_COMPACT_DESKTOP
					: MIN_HEIGHT_DESKTOP;
	const maxHeight = Math.max(
		minHeight,
		Math.round(viewportHeight * COMPOSER_MAX_VIEWPORT_FRACTION)
	);
	return { minHeight, maxHeight };
};

export const clampComposerHeight = (
	height: number,
	{ minHeight, maxHeight }: ComposerHeightBounds
): number => Math.round(Math.min(Math.max(height, minHeight), maxHeight));

export const stepComposerHeight = (
	currentHeight: number,
	{ key, shiftKey }: { key: string; shiftKey: boolean },
	bounds: ComposerHeightBounds
): number | null => {
	const step = shiftKey ? STEP_LARGE : STEP_SMALL;
	switch (key) {
		case 'ArrowUp':
			return clampComposerHeight(currentHeight + step, bounds);
		case 'ArrowDown':
			return clampComposerHeight(currentHeight - step, bounds);
		case 'Home':
			return bounds.minHeight;
		case 'End':
			return bounds.maxHeight;
		default:
			return null;
	}
};
