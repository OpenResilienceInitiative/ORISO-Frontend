/**
 * How a room header behaves when its pane gets narrow.
 *
 * Frank, 09.09.2026 (finding *1): "Ich kann diesen Slider nicht genug bewegen
 * nach links und nach rechts. … Aktuell ist das mindestens 487 px, das kann
 * auf beiden Seiten gerne bis zu 320 px breit sein. Achte dabei darauf, dass
 * alles korrekt wrapped, dass kein Overflow entsteht."
 *
 * The divider now reaches 320 px on either side
 * (`STAGE_LAYOUT.MIN_PANE_DRAG_WIDTH`), and that is far below anything the
 * header row was built for. Measured on the running stage (1280 × 820, story
 * (d) "Thread and supervision open at once"), the main chat header spends a
 * fixed 136 px on the type pill + avatar stack and 134 px on the menu with
 * the two inline call buttons, so the title column is `pane − 302` px:
 *
 *   pane   840  680  560  520  480  440  400  360  328
 *   title  532  372  292  212  172  132   92   52   20   ← px left for the name
 *   clip     0    0    0    0    9   49   89  129  161   ← px cut off the name
 *
 * D8 (Frank, 05.09.2026) already decided the remedy for exactly this squeeze
 * on the phone: the call buttons leave the row and become rows of the kebab
 * menu, and the avatar stack folds into one avatar + "+N" (T4), "so the
 * title keeps ≥ 40 % of the row". That share breaks at 482 px — one pixel
 * either side of where the name starts being cut — so the same switch now
 * happens by PANE width, not only by viewport width.
 *
 * Deliberately a pane measurement and not `useResponsive()`: at 1280 px the
 * viewport says "desktop" while the pane behind the divider can be 320 px.
 * Deliberately the pane width and not the title width: switching on the
 * title would widen the title, which would switch back — an oscillation.
 *
 * No React, no DOM. `SessionHeaderComponent` and `PanelHeader` only render
 * what this returns.
 */
import {
	STACK_MAX_VISIBLE,
	STACK_MAX_VISIBLE_PHONE
} from '../message/participantStack';

/**
 * Below this pane width a room header goes compact. Derived from the sweep
 * above: with the calls inline the title falls under D8's 40 % share at
 * 482 px and the name starts to be clipped at 480 px.
 */
export const HEADER_COMPACT_WIDTH = 480;

/** D8's rule: the title never gets less than this share of the header row. */
export const HEADER_TITLE_MIN_SHARE = 0.4;

export interface RoomHeaderDensityInput {
	/**
	 * Measured width of the pane the header lives in. `null` (or 0) before
	 * the first measurement — the header then stays as it is rather than
	 * flashing the compact form on mount.
	 */
	width: number | null | undefined;
	/** Viewport phone (`useResponsive().untilM`) — compact whatever it measures. */
	phone?: boolean;
}

export interface RoomHeaderDensity {
	/** The pane is too narrow for the roomy header. */
	compact: boolean;
	/** Audio/video belong in the kebab / overflow menu, not in the row (D8). */
	callsInMenu: boolean;
	/** Avatars the stack may show before it folds into "+N" (T4). */
	stackMaxVisible: number;
}

export const resolveRoomHeaderDensity = ({
	width,
	phone = false
}: RoomHeaderDensityInput): RoomHeaderDensity => {
	const measured = Number.isFinite(width as number) ? (width as number) : 0;
	const compact = phone || (measured > 0 && measured < HEADER_COMPACT_WIDTH);
	return {
		compact,
		callsInMenu: compact,
		stackMaxVisible: compact ? STACK_MAX_VISIBLE_PHONE : STACK_MAX_VISIBLE
	};
};

/**
 * What is left of the header row for the name, as a share of the row — the
 * number D8 keeps at or above `HEADER_TITLE_MIN_SHARE`. Stories measure the
 * real boxes with it instead of re-deriving the arithmetic.
 */
export const titleShareOf = ({
	rowWidth,
	chromeWidth
}: {
	rowWidth: number;
	chromeWidth: number;
}): number => (rowWidth > 0 ? (rowWidth - chromeWidth) / rowWidth : 0);
