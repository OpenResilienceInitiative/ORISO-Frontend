/**
 * One fluid card size for every waiting room ("So geht es weiter").
 *
 * The cards used to be a fixed 372 px from the `sm` breakpoint up. On a 2560
 * or 3840 px screen they filled only half of the white column and left its
 * lower half empty; on a 1366×768 laptop or at 150 % zoom they were cut off
 * behind the bar. Frank, 2026-11-13: the cards adapt to the visible area at
 * every zoom level so nothing is cut off — sized in rem/clamp(), never in
 * fixed px.
 *
 * The step cards stay a CAROUSEL with arrows and dots (#2179, #2198). They are
 * NOT sized so that all three fit side by side: that reading of Frank's
 * "nicht ewig viel rumscrollen" (#2246/#2247) was wrong — he meant the cut-off
 * cards. Product owner, 2026-11-20: restore the carousel, size the cards from
 * the HEIGHT that is free, keep the square motif, show at most about one and
 * a half cards. Do not turn this back into a static three-up grid without the
 * product owner.
 *
 * From `sm` up the width is a `clamp()` of the larger of
 *   - 509 px as a share of a 1440 px window (35.4 vw): one and a half cards
 *     across the white column there, with the motif 372 px high as in the
 *     state Frank approved (2026-11-20: the picture boxes wider, the height
 *     right); the same size on screen at 100, 150 or 200 % zoom, because
 *     zoom changes the CSS pixels, not the share; and
 *   - 2.6 cards across the carousel block, so the track always scrolls and
 *     the arrows and dots have something to do, also in the one-column layout
 *     a zoomed window falls into;
 * floor 12rem, ceiling 90rem. The HEIGHT adapts: the card is never taller
 * than the free height between the headline and the bar (a CSS variable the
 * carousel sets); where that is short, the motif gets lower, never the text,
 * as on phones.
 *
 * Title, text, badge and paddings inside a card are a share of the window
 * too (`fluid()`, `vw`), so they keep their size at any zoom and stay
 * readable at their floor.
 */

/** Phone: one card nearly fills the screen, the next one peeks in. */
export const CARD_WIDTH_XS_REM = 18.75;
/** From `sm`: the smallest card that still holds its title and text. */
export const CARD_WIDTH_SM_MIN_REM = 12;
/**
 * From `sm`: the largest card. High enough that a 3840 px window at 100 %
 * still gets the baseline's share (1357 px), so it looks like the 1440 one.
 */
export const CARD_WIDTH_SM_MAX_REM = 90;
/** Gap between cards from `sm` (1.25rem). */
const CARD_GAP_SM_REM = 1.25;
/** The card the design values (px) were drawn for: the live chat's (#1735). */
const DESIGN_CARD_PX = 372;
/** Inner lengths never fall below this share of their design value. */
const FLOOR_SHARE = 0.8;
/**
 * Desktop card width as a share of the WINDOW (`vw`): browser zoom then does
 * not change how big the card looks — at 150 % or 200 % the window has fewer
 * CSS pixels and the card the same share of them (Frank, 2026-11-20: "egal ob
 * der Zoomlevel 100 % ist oder 150 % oder 200 %"). The height adapts instead:
 * the card is never taller than the free height; its motif crops, as on phones.
 */
const CARD_WIDTH_SM_VW = +((509 / 1440) * 100).toFixed(3);
/** The window the desktop design values (px) were drawn for. */
const DESIGN_WINDOW_PX = 1440;
/**
 * Never more than this many cards across the block, so the track always
 * scrolls — also in the one-column layout a zoomed window falls into.
 */
const MAX_CARDS_ACROSS = 2.6;
/** The motif never shrinks below this strip; the text block keeps its size. */
export const MOTIF_MIN_HEIGHT_REM = 3;
/**
 * The card never gets shorter than this, even in a window too short for it
 * (200 % zoom on a laptop: tracked separately). Above it the card is exactly
 * the free height; the text block's reserved empty last line goes first.
 */
export const CARD_MIN_HEIGHT_REM = 7;
/** Set by the carousel on its block: the block's height and width in px. */
export const HANDOVER_BLOCK_HEIGHT_VAR = '--handover-block-h';
export const HANDOVER_BLOCK_WIDTH_VAR = '--handover-block-w';
const W = `var(${HANDOVER_BLOCK_WIDTH_VAR}, 50vw)`;

/** The dots row under the cards (24 px targets plus their gap). */
export const DOTS_ROW_REM = 2;

const fewAcross = `(${W} - ${2 * CARD_GAP_SM_REM}rem) / ${MAX_CARDS_ACROSS}`;

export const cardWidth = {
	xs: `${CARD_WIDTH_XS_REM}rem`,
	sm: `clamp(${CARD_WIDTH_SM_MIN_REM}rem, max(${CARD_WIDTH_SM_VW}vw, ${fewAcross}), ${CARD_WIDTH_SM_MAX_REM}rem)`
};

/** Tablets held upright (from `sm`, 520 px): sized by the long side. */
export const PORTRAIT_SM =
	'@media (min-width: 520px) and (orientation: portrait)';
export const cardWidthPortrait = `clamp(${CARD_WIDTH_SM_MIN_REM}rem, min(${CARD_WIDTH_SM_VW}vmax, (${W} - ${CARD_GAP_SM_REM}rem) / 1.5), ${CARD_WIDTH_SM_MAX_REM}rem)`;

/**
 * A length that is `designPx` on a 1440 px window and keeps its share of the
 * window (`vw`), so text and paddings look the same at any zoom; never below
 * 80 % of the design value and never above its share of the 90rem card (or
 * `maxRem`).
 */
export const fluid = (designPx: number, maxRem?: number) => {
	const minRem = +((designPx * FLOOR_SHARE) / 16).toFixed(4);
	const vw = +((designPx / DESIGN_WINDOW_PX) * 100).toFixed(3);
	const max =
		maxRem ??
		+((designPx / DESIGN_CARD_PX) * CARD_WIDTH_SM_MAX_REM).toFixed(4);
	return `clamp(${minRem}rem, ${vw}vw, ${max}rem)`;
};

/** Plain rem for a design value given in px (phones, below `sm`). */
export const rem = (designPx: number) => `${+(designPx / 16).toFixed(4)}rem`;

/**
 * The width `cardWidth.sm` resolves to, in px — the same formula, for the
 * layout contract. `blockWidthPx` is the carousel block's width (the CSS
 * variable the carousel sets), `viewportWidthPx` the window's (`vw`).
 */
export const expectedSmCardWidthPx = (
	blockWidthPx: number,
	viewportWidthPx: number,
	rootFontPx = 16,
	viewportHeightPx = 0
) => {
	const r = rootFontPx;
	if (viewportHeightPx > viewportWidthPx) {
		// Upright tablet: the long side sets the size, at most 1.5 across.
		const vmaxPx = (viewportHeightPx * CARD_WIDTH_SM_VW) / 100;
		const peekPx = (blockWidthPx - CARD_GAP_SM_REM * r) / 1.5;
		return Math.min(
			CARD_WIDTH_SM_MAX_REM * r,
			Math.max(CARD_WIDTH_SM_MIN_REM * r, Math.min(vmaxPx, peekPx))
		);
	}
	const fewAcrossPx =
		(blockWidthPx - 2 * CARD_GAP_SM_REM * r) / MAX_CARDS_ACROSS;
	const shareVwPx = (viewportWidthPx * CARD_WIDTH_SM_VW) / 100;
	return Math.min(
		CARD_WIDTH_SM_MAX_REM * r,
		Math.max(CARD_WIDTH_SM_MIN_REM * r, Math.max(shareVwPx, fewAcrossPx))
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
