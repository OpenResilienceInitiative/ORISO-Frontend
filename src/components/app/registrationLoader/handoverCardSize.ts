/**
 * One fluid card size for every waiting room ("So geht es weiter").
 *
 * The cards used to be a fixed 372 px from the `sm` breakpoint up. On a 2560
 * or 3840 px screen they filled only half of the white column and left its
 * lower half empty; on a 1366×768 laptop or at 150 % zoom they were cut off
 * behind the bar. Frank, 2026-11-13: the cards adapt to the visible area at
 * every zoom level — all three fit into the picture without scrolling, the
 * text may get smaller — sized in rem/clamp(), never in fixed px.
 *
 * From `sm` up the width is a `clamp()`:
 * - preferred: the smaller of
 *   - three cards side by side in the carousel's own width (`cqi`; the
 *     carousel block is an inline-size container), and
 *   - the width at which the card still ends above the bar: the window height
 *     (`dvh`) minus the headline above and the dots, the note and the bar
 *     below, divided by the card's height-per-width;
 * - floor: 12rem, below which a card cannot hold its text;
 * - ceiling: 45rem, so a 4K screen gets big cards, not posters.
 *
 * Everything inside a card is sized in `cqi` of the card itself (each card is
 * an inline-size container), so title, text, badge and paddings shrink and
 * grow with the card; `fluid()` keeps the text readable at its floor.
 */

/** Phone: one card nearly fills the screen, the next one peeks in. */
export const CARD_WIDTH_XS_REM = 18.75;
/** From `sm`: the smallest card that still holds its title and text. */
export const CARD_WIDTH_SM_MIN_REM = 12;
/** From `sm`: the largest card on a very large screen. */
export const CARD_WIDTH_SM_MAX_REM = 45;
/** The card the design values (px) were drawn for: the live chat's (#1735). */
const DESIGN_CARD_PX = 372;
/** Gap between cards from `sm` (1.25rem), two per row of three. */
const CARD_GAP_SM_REM = 1.25;
/** Inner lengths never fall below this share of their design value. */
const FLOOR_SHARE = 0.8;
/**
 * The text block under the square motif: at the design size 150 px of a
 * 372 px card (factor 1.4 in all), at its floor 7.5rem whatever the width.
 */
const HEIGHT_PER_WIDTH = 1.4;
const TEXT_BLOCK_FLOOR_REM = 7.5;
/**
 * Window height the card may not use: kicker and headline above it
 * (12.5rem), the dots (2rem), the encryption note and the fixed bar (10.5rem).
 */
const RESERVED_HEIGHT_REM = 25;

const fitsHeight = `min((100dvh - ${RESERVED_HEIGHT_REM}rem) / ${HEIGHT_PER_WIDTH}, 100dvh - ${
	RESERVED_HEIGHT_REM + TEXT_BLOCK_FLOOR_REM
}rem)`;
const threeAcross = `(100cqi - ${2 * CARD_GAP_SM_REM}rem) / 3`;

export const cardWidth = {
	xs: `${CARD_WIDTH_XS_REM}rem`,
	sm: `clamp(${CARD_WIDTH_SM_MIN_REM}rem, min(${threeAcross}, ${fitsHeight}), ${CARD_WIDTH_SM_MAX_REM}rem)`
};

/**
 * A length that is `designPx` on the design card and scales with the card:
 * `cqi` of the card, never below 80 % of the design value and never above
 * its share of the 45rem card (or `maxRem`).
 */
export const fluid = (designPx: number, maxRem?: number) => {
	const minRem = +((designPx * FLOOR_SHARE) / 16).toFixed(4);
	const cqi = +((designPx / DESIGN_CARD_PX) * 100).toFixed(3);
	const max =
		maxRem ??
		+((designPx / DESIGN_CARD_PX) * CARD_WIDTH_SM_MAX_REM).toFixed(4);
	return `clamp(${minRem}rem, ${cqi}cqi, ${max}rem)`;
};

/** Plain rem for a design value given in px (phones, below `sm`). */
export const rem = (designPx: number) => `${+(designPx / 16).toFixed(4)}rem`;

/**
 * The width `cardWidth.sm` resolves to, in px — the same formula, for the
 * layout contract. `containerPx` is the carousel block's width (its `cqi`),
 * `viewportHeightPx` the window height (`dvh`).
 */
export const expectedSmCardWidthPx = (
	containerPx: number,
	viewportHeightPx: number,
	rootFontPx = 16
) => {
	const r = rootFontPx;
	const threeAcrossPx = (containerPx - 2 * CARD_GAP_SM_REM * r) / 3;
	const fitsHeightPx = Math.min(
		(viewportHeightPx - RESERVED_HEIGHT_REM * r) / HEIGHT_PER_WIDTH,
		viewportHeightPx - (RESERVED_HEIGHT_REM + TEXT_BLOCK_FLOOR_REM) * r
	);
	return Math.min(
		CARD_WIDTH_SM_MAX_REM * r,
		Math.max(
			CARD_WIDTH_SM_MIN_REM * r,
			Math.min(threeAcrossPx, fitsHeightPx)
		)
	);
};

/** Root font size in px, for the layout contract that measures in px. */
const rootPx = (doc: Document) =>
	parseFloat(getComputedStyle(doc.documentElement).fontSize) || 16;

/**
 * The width range a card may have in a window, in px — what the contract
 * checks. Below `sm` the card is exactly the phone width.
 */
export const rootFontPx = (doc: Document) => rootPx(doc);

export const expectedCardWidthRange = (
	doc: Document,
	viewportWidth: number,
	smBreakpointPx: number
): { min: number; max: number } => {
	const px = rootPx(doc);
	if (viewportWidth < smBreakpointPx) {
		const w = CARD_WIDTH_XS_REM * px;
		return { min: w, max: w };
	}
	return {
		min: CARD_WIDTH_SM_MIN_REM * px,
		max: CARD_WIDTH_SM_MAX_REM * px
	};
};
