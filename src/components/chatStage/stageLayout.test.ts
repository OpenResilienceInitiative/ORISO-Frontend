import { describe, expect, it } from 'vitest';
import { resolveStageLayout, STAGE_LAYOUT } from './stageLayout';

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

	it('reports the card width it computed with (list + 2 × 24 px margin)', () => {
		const layout = resolveStageLayout({ ...desktop1280, panelOpen: true });
		expect(layout.cardWidth).toBe(
			1280 - STAGE_LAYOUT.RAIL_WIDTH - 2 * STAGE_LAYOUT.CARD_MARGIN
		);
		expect(layout.mainWidth + layout.panelWidth).toBe(layout.cardWidth);
	});
});
