import { expect, waitFor } from 'storybook/test';

/** The stage splits the page from this width on (MUI `lg`). */
const STAGE_SPLIT_PX = 1200;

/**
 * The layout every waiting room promises, checked in the browser. Each
 * waiting-room story runs it, so a merge that moves the bar, drops the stage
 * or shrinks the button fails a story instead of reaching Dev (#1219; Frank,
 * 2026-10-15: "nicht ein anderer Frontend-Merge wieder was überschreibt").
 *
 * - The red stage stands beside the column on a desktop.
 * - The bar is fixed to the bottom edge: the full width on a phone, the
 *   white column (60vw) on a desktop, ending at the right edge.
 * - The gate button spans the bar's row, not a corner of it.
 */
export const expectWaitingRoomLayout = async (canvasElement: HTMLElement) => {
	const doc = canvasElement.ownerDocument;
	const viewport = doc.defaultView!.innerWidth;

	await waitFor(() => {
		const footer = doc.querySelector<HTMLElement>(
			'[data-cy="registration-footer"]'
		);
		expect(footer, 'the shared RegistrationFooter bar').not.toBeNull();
		const bar = footer!.getBoundingClientRect();
		const expectedWidth =
			viewport >= STAGE_SPLIT_PX ? viewport * 0.6 : viewport;
		expect(Math.abs(bar.width - expectedWidth)).toBeLessThanOrEqual(2);
		expect(Math.abs(bar.right - viewport)).toBeLessThanOrEqual(2);
		expect(getComputedStyle(footer!).position).toBe('fixed');

		const gate = footer!.querySelector<HTMLElement>(
			'[data-cy-state], button[type="submit"]'
		);
		expect(gate, 'a gate button inside the bar').not.toBeNull();
		const button = gate!.getBoundingClientRect();
		// Paddings and at most one round exit (56px) beside it.
		expect(button.width).toBeGreaterThanOrEqual(bar.width - 140);

		if (viewport >= STAGE_SPLIT_PX) {
			const stage = doc.querySelector<HTMLElement>('.stage');
			expect(stage, 'the red stage beside the column').not.toBeNull();
			const panel = stage!.getBoundingClientRect();
			expect(panel.width).toBeGreaterThan(viewport * 0.3);
			expect(panel.left).toBeLessThanOrEqual(1);
		}
	});
};
