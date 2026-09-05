/**
 * Pure composer-resize math. Frank/Figma rule (node 18:1989): the input
 * field may be dragged up to at most two thirds of the viewport height and
 * always spans the chat window width — width is never part of the resize.
 */

export const COMPOSER_MAX_VIEWPORT_FRACTION = 2 / 3;
export const COMPOSER_MOBILE_BREAKPOINT = 899;

// T10 (05.09.): on the phone the composer opens as ONE line and grows while
// typing (auto-grow below). 66 px toolbar strip to the editor top + one
// 20 px line + 18 px bottom inset + the card's 16 px dock = 120 px. Desktop
// keeps its Figma baseline.
const MIN_HEIGHT_MOBILE = 120;
const MIN_HEIGHT_DESKTOP = 196;

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
	viewportHeight
}: {
	viewportWidth: number;
	viewportHeight: number;
}): ComposerHeightBounds => {
	const minHeight =
		viewportWidth <= COMPOSER_MOBILE_BREAKPOINT
			? MIN_HEIGHT_MOBILE
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
