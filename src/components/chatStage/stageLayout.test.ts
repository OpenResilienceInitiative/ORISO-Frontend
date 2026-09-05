import { describe, expect, it } from 'vitest';
import {
	clampPanelWidth,
	PANEL_WIDTH_STORAGE_KEY,
	readPanelWidth,
	resolveStageLayout,
	STAGE_LAYOUT,
	writePanelWidth
} from './stageLayout';

// 1280 wide, list expanded at 420, side panel 380: the chat card would be
// 1280 - 420 - 48 (card margins) = 812 wide, leaving 432 px for the main
// chat next to a 380 px panel — below the 520 px floor Frank asked for.
const desktop1280 = { viewportWidth: 1280, listWidth: 420, panelWidth: 380 };

describe('resolveStageLayout (list column snaps to the icon rail)', () => {
	it('keeps the expanded list when no side panel is open', () => {
		const layout = resolveStageLayout({ ...desktop1280, panelOpen: false });
		expect(layout.mode).toBe('split');
		expect(layout.listMode).toBe('expanded');
		expect(layout.listWidth).toBe(420);
		expect(layout.panelWidth).toBe(0);
	});

	it('keeps the expanded list when both panes still get their minimum', () => {
		const layout = resolveStageLayout({
			viewportWidth: 1600,
			listWidth: 397,
			panelWidth: 380,
			panelOpen: true
		});
		// 1600 - 397 - 48 = 1155 card: the panel grows to the 520 floor first,
		// the main chat keeps 635 — no need to touch the list.
		expect(layout.listMode).toBe('expanded');
		expect(layout.panelWidth).toBe(STAGE_LAYOUT.MIN_PANE_WIDTH);
		expect(layout.mainWidth).toBeGreaterThanOrEqual(
			STAGE_LAYOUT.MIN_PANE_WIDTH
		);
	});

	it('snaps the list to the icon rail when the main chat would drop below 520 px', () => {
		const layout = resolveStageLayout({ ...desktop1280, panelOpen: true });
		expect(layout.listMode).toBe('rail');
		expect(layout.listWidth).toBe(STAGE_LAYOUT.RAIL_WIDTH);
		expect(layout.mainWidth).toBeGreaterThanOrEqual(
			STAGE_LAYOUT.MIN_PANE_WIDTH
		);
		expect(layout.panelWidth).toBeGreaterThanOrEqual(
			STAGE_LAYOUT.MIN_PANE_WIDTH
		);
	});

	it('never lets the panel take more than half of the card', () => {
		const layout = resolveStageLayout({
			viewportWidth: 1440,
			listWidth: 80,
			panelWidth: 900,
			panelOpen: true
		});
		expect(layout.panelWidth).toBeLessThanOrEqual(layout.mainWidth);
	});

	it('is single-pane on the phone regardless of widths', () => {
		const layout = resolveStageLayout({
			viewportWidth: 390,
			listWidth: 420,
			panelWidth: 380,
			panelOpen: true
		});
		expect(layout.mode).toBe('single');
		expect(layout.listMode).toBe('hidden');
	});

	it('reports the card width it computed with (list + 12 px left + 24 px right margin, T34)', () => {
		const layout = resolveStageLayout({ ...desktop1280, panelOpen: true });
		// T34: the card starts LIST_CARD_GAP after the list cards, which end
		// LIST_INNER_GUTTER before the column edge — so the left margin is
		// the difference; the right margin stays CARD_MARGIN.
		expect(layout.cardWidth).toBe(
			1280 -
				STAGE_LAYOUT.RAIL_WIDTH -
				(STAGE_LAYOUT.LIST_CARD_GAP - STAGE_LAYOUT.LIST_INNER_GUTTER) -
				STAGE_LAYOUT.CARD_MARGIN
		);
		expect(STAGE_LAYOUT.LIST_CARD_GAP).toBe(24);
		expect(STAGE_LAYOUT.LIST_INNER_GUTTER).toBe(12);
		expect(layout.mainWidth + layout.panelWidth).toBe(layout.cardWidth);
	});
});

describe('clampPanelWidth (T2: drag between main pane and side panel)', () => {
	// 1280 with the list on the rail: 1280 - 80 - 48 = 1152 px card.
	const card = 1152;

	it('keeps the panel at the 520 px floor', () => {
		expect(clampPanelWidth(300, card)).toBe(STAGE_LAYOUT.MIN_PANE_WIDTH);
	});

	it('leaves the main pane its 520 px', () => {
		expect(clampPanelWidth(900, card)).toBe(
			card - STAGE_LAYOUT.MIN_PANE_WIDTH
		);
	});

	it('passes a width inside the band through, rounded', () => {
		expect(clampPanelWidth(600.4, card)).toBe(600);
	});

	it('splits a card too narrow for two minimum panes in half', () => {
		expect(clampPanelWidth(700, 900)).toBe(450);
	});

	it('treats a non-finite request as the floor', () => {
		expect(clampPanelWidth(NaN, card)).toBe(STAGE_LAYOUT.MIN_PANE_WIDTH);
	});
});

describe('panel width persistence', () => {
	const memory = () => {
		const store = new Map<string, string>();
		return {
			getItem: (key: string) => store.get(key) ?? null,
			setItem: (key: string, value: string) => {
				store.set(key, value);
			}
		};
	};

	it('falls back when nothing is stored or the value is garbage', () => {
		const storage = memory();
		expect(readPanelWidth(400, storage)).toBe(400);
		storage.setItem(PANEL_WIDTH_STORAGE_KEY, 'wide');
		expect(readPanelWidth(400, storage)).toBe(400);
		expect(readPanelWidth(400, null)).toBe(400);
	});

	it('round-trips a dragged width as whole pixels', () => {
		const storage = memory();
		writePanelWidth(533.6, storage);
		expect(readPanelWidth(400, storage)).toBe(534);
	});

	it('ignores widths that cannot be a pane', () => {
		const storage = memory();
		writePanelWidth(0, storage);
		writePanelWidth(NaN, storage);
		expect(readPanelWidth(400, storage)).toBe(400);
	});
});
