import { expect, waitFor } from 'storybook/test';

/** MUI `sm` and the app's stage breakpoint; the waiting-room module owns both. */
const CARD_WIDTH = { xs: 300, sm: 372 };
const SM_UP = '(min-width: 600px)';
const STAGE_UP = '(min-width: 1200px)';

const pixelsOf = (canvas: HTMLCanvasElement) =>
	canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height)
		.data;

const hasDrawnPixels = (canvas: HTMLCanvasElement) => {
	const data = pixelsOf(canvas);
	for (let i = 3; i < data.length; i += 4) {
		if (data[i] > 40) {
			return true;
		}
	}
	return false;
};

/** Pixels that are clearly drawn and clearly red, whatever the glow. */
const redDominantPixels = (canvas: HTMLCanvasElement) => {
	const data = pixelsOf(canvas);
	let count = 0;
	for (let i = 0; i < data.length; i += 4) {
		const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
		if (a > 80 && r - b > 40 && r - g > 40) {
			count += 1;
		}
	}
	return count;
};

export interface WaitingRoomContractOptions {
	/** The room stands in the split layout (brand stage beside the column). */
	stage?: boolean;
	/**
	 * The story renders a non-red primary colour: no stage effect pixel may be
	 * red-dominant (the dots used to be drawn in a fixed red).
	 */
	notRed?: boolean;
	/** The gate button, when the room is in a state where it is open. */
	gate?: () => HTMLElement | null;
}

/**
 * What every waiting room must show, asserted once for all of them
 * (ORISO-Frontend#1735): the same card size, the brand stage from the stage
 * breakpoint up, and a gate button that a pointer actually reaches. Each room's
 * story calls this from its `play`, so a room that drifts fails here.
 */
export const verifyWaitingRoomContract = async (
	canvasElement: HTMLElement,
	options: WaitingRoomContractOptions = {}
) => {
	const win = canvasElement.ownerDocument.defaultView!;
	const cards = await waitFor(() => {
		const found = [
			...canvasElement.querySelectorAll<HTMLElement>(
				'[data-cy^="handover-card-"]'
			)
		];
		expect(found.length).toBeGreaterThan(0);
		return found;
	});

	const expectedWidth = win.matchMedia(SM_UP).matches
		? CARD_WIDTH.sm
		: CARD_WIDTH.xs;
	for (const card of cards) {
		expect(Math.round(card.getBoundingClientRect().width)).toBe(
			expectedWidth
		);
	}

	if (options.stage) {
		if (win.matchMedia(STAGE_UP).matches) {
			const stage = canvasElement.querySelector<HTMLElement>(
				'.stageLayout__stage'
			);
			expect(stage).not.toBeNull();
			expect(stage!.getBoundingClientRect().width).toBeGreaterThan(300);
		} else {
			expect(
				canvasElement.querySelector('.stageMobileHero')
			).not.toBeNull();
		}
	}

	if (options.notRed) {
		const canvases = [
			...canvasElement.querySelectorAll<HTMLCanvasElement>(
				'.stageLayout__stage canvas'
			)
		];
		expect(canvases.length).toBeGreaterThan(0);
		await waitFor(() => {
			expect(canvases.some(hasDrawnPixels)).toBe(true);
		});
		for (const canvas of canvases) {
			expect(redDominantPixels(canvas)).toBe(0);
		}
	}

	if (options.gate) {
		const gate = options.gate();
		expect(gate).not.toBeNull();
		expect(gate!.hasAttribute('disabled')).toBe(false);
		gate!.scrollIntoView({ block: 'nearest' });
		const rect = gate!.getBoundingClientRect();
		const hit = canvasElement.ownerDocument.elementFromPoint(
			rect.left + rect.width / 2,
			rect.top + rect.height / 2
		);
		// A covering layer would be the topmost element here, not the button.
		expect(hit && gate!.contains(hit)).toBe(true);
	}
};
