export interface PlacementBox {
	left: number;
	top: number;
	right: number;
	bottom: number;
}

/**
 * Where the practice banner rests until someone moves it: docked at the
 * bottom of the list column, left-aligned with the list cards (85 px
 * navigation rail + 12 px card gutter). Every step of both practice tours
 * points above or to the right of that corner.
 *
 * The width keeps it left of the accept button when a side panel folds the
 * list into its 80 px rail at 1280 px (button from x 357).
 */
export const PRACTICE_BANNER_RESTING = {
	left: 97,
	bottom: 16,
	width: 248
} as const;

/** The resting box in a viewport, for a banner of the given height. */
export const practiceBannerRestingBox = (
	viewport: { width: number; height: number },
	height: number
): PlacementBox => ({
	left: PRACTICE_BANNER_RESTING.left,
	top: viewport.height - PRACTICE_BANNER_RESTING.bottom - height,
	right: PRACTICE_BANNER_RESTING.left + PRACTICE_BANNER_RESTING.width,
	bottom: viewport.height - PRACTICE_BANNER_RESTING.bottom
});
