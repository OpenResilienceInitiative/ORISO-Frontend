/**
 * Stage-level layout rule for `list | main | secondary` (inventory §3.4).
 *
 * Today the split lives *inside* the detail column, so at 1280 px a 420 px
 * list plus a 380 px panel leave ~430 px for the chat. Frank asked to see
 * the alternative: when a side panel opens, the list column snaps to the
 * icon rail so main and panel both keep at least `MIN_PANE_WIDTH`.
 *
 * Pure: the story (and later the stage) hands in the widths, this decides.
 */

export const STAGE_LAYOUT = {
	/** `useResponsive().fromL` — below this the stage is single-pane. */
	DESKTOP_MIN_WIDTH: 900,
	/** Icon-only session list (`sessionsList__wrapper--iconOnly` min-width). */
	RAIL_WIDTH: 80,
	/** `.session` desktop margin on each side. */
	CARD_MARGIN: 24,
	/** Both chat panes keep at least this much. */
	MIN_PANE_WIDTH: 520
} as const;

export type StageMode = 'split' | 'single';
export type StageListMode = 'expanded' | 'rail' | 'hidden';

export interface StageLayoutInput {
	viewportWidth: number;
	/** Persisted list column width (397–500 expanded, 80 rail). */
	listWidth: number;
	/** Requested side panel width. */
	panelWidth: number;
	panelOpen: boolean;
}

export interface StageLayout {
	mode: StageMode;
	listMode: StageListMode;
	listWidth: number;
	/** Width of the chat card (list and margins subtracted). */
	cardWidth: number;
	mainWidth: number;
	/** 0 when the panel is closed. */
	panelWidth: number;
}

const cardWidthFor = (viewportWidth: number, listWidth: number) =>
	Math.max(0, viewportWidth - listWidth - 2 * STAGE_LAYOUT.CARD_MARGIN);

const fitPanel = (cardWidth: number, requested: number) => {
	const { MIN_PANE_WIDTH } = STAGE_LAYOUT;
	// Panel never below the floor, never wider than the main pane.
	const panel = Math.min(
		Math.max(requested, MIN_PANE_WIDTH),
		Math.floor(cardWidth / 2)
	);
	return { panel, main: cardWidth - panel };
};

export const resolveStageLayout = ({
	viewportWidth,
	listWidth,
	panelWidth,
	panelOpen
}: StageLayoutInput): StageLayout => {
	const { DESKTOP_MIN_WIDTH, RAIL_WIDTH, MIN_PANE_WIDTH } = STAGE_LAYOUT;

	if (viewportWidth < DESKTOP_MIN_WIDTH) {
		return {
			mode: 'single',
			listMode: 'hidden',
			listWidth: 0,
			cardWidth: viewportWidth,
			mainWidth: viewportWidth,
			panelWidth: panelOpen ? viewportWidth : 0
		};
	}

	if (!panelOpen) {
		const cardWidth = cardWidthFor(viewportWidth, listWidth);
		return {
			mode: 'split',
			listMode: listWidth <= RAIL_WIDTH ? 'rail' : 'expanded',
			listWidth,
			cardWidth,
			mainWidth: cardWidth,
			panelWidth: 0
		};
	}

	const expandedCard = cardWidthFor(viewportWidth, listWidth);
	const expanded = fitPanel(expandedCard, panelWidth);
	if (expanded.main >= MIN_PANE_WIDTH && expanded.panel >= MIN_PANE_WIDTH) {
		return {
			mode: 'split',
			listMode: listWidth <= RAIL_WIDTH ? 'rail' : 'expanded',
			listWidth,
			cardWidth: expandedCard,
			mainWidth: expanded.main,
			panelWidth: expanded.panel
		};
	}

	const railCard = cardWidthFor(viewportWidth, RAIL_WIDTH);
	const rail = fitPanel(railCard, panelWidth);
	return {
		mode: 'split',
		listMode: 'rail',
		listWidth: RAIL_WIDTH,
		cardWidth: railCard,
		mainWidth: rail.main,
		panelWidth: rail.panel
	};
};
