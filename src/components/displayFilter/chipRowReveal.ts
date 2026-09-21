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
	if (chipLeft - gutter < scrollLeft) return Math.max(0, chipLeft - gutter);
	if (chipRight + gutter > scrollLeft + viewportWidth)
		return chipRight + gutter - viewportWidth;
	return null;
};

const ACTIVE_CHIP_SELECTOR =
	'.sessionsListToolbar__chip--active, [aria-pressed="true"], [aria-current="page"]';

export const findActiveChip = (scroller: HTMLElement) =>
	scroller.querySelector<HTMLElement>(ACTIVE_CHIP_SELECTOR);

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
