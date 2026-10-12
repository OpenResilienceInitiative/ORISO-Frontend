/** Breathing room so a revealed chip does not sit flush against the edge. */
export const CHIP_REVEAL_GUTTER = 12;

/**
 * Target `scrollLeft` that brings the span [chipLeft, chipRight] (in the
 * scroller's content coordinates) fully into a viewport of `viewportWidth`;
 * `null` when it already is.
 */
export const chipRevealScrollLeft = (
	scrollLeft: number,
	viewportWidth: number,
	chipLeft: number,
	chipRight: number,
	gutter = CHIP_REVEAL_GUTTER
): number | null => {
	// A chip too wide for both gutters would be clipped by them: shrink the
	// gutter to what fits instead.
	const space = Math.max(0, (viewportWidth - (chipRight - chipLeft)) / 2);
	const g = Math.min(gutter, space);
	if (chipLeft - g < scrollLeft) return Math.max(0, chipLeft - g);
	if (chipRight + g > scrollLeft + viewportWidth)
		return chipRight + g - viewportWidth;
	return null;
};

const ACTIVE_CHIP_SELECTOR =
	'.sessionsListToolbar__chip--active, [aria-pressed="true"], [aria-current="page"]';

export const findActiveChips = (scroller: HTMLElement) =>
	Array.from(scroller.querySelectorAll<HTMLElement>(ACTIVE_CHIP_SELECTOR));

/** Scrolls the row horizontally (never the page) until `chip` is fully visible. */
export const revealChip = (scroller: HTMLElement, chip: HTMLElement) => {
	const box = scroller.getBoundingClientRect();
	const rect = chip.getBoundingClientRect();
	const left = rect.left - box.left + scroller.scrollLeft;
	const target = chipRevealScrollLeft(
		scroller.scrollLeft,
		scroller.clientWidth,
		left,
		left + rect.width
	);
	// The scroller's CSS `scroll-behavior: smooth` animates this.
	if (target !== null) scroller.scrollLeft = target;
};
