/** The stage splits the page from this width on (MUI `lg`). */
const STAGE_SPLIT_PX = 1200;
/**
 * One card size in every room, the live chat's (#1735; Frank, 2026-10-16:
 * "proportions must come from live chat"). From the theme's `sm` (520 px) up
 * 372 px, below it 300 px.
 */
const CARD_WIDTH = { xs: 300, sm: 372 };
const CARD_SM_PX = 520;

export interface WaitingRoomLayoutOptions {
	/**
	 * The room stands in `WaitingRoomFrame` with the shared bar. `false` only
	 * for a part shown on its own (the group's info gallery); cards are still
	 * checked.
	 */
	frame?: boolean;
	/** The room must show the card carousel (otherwise: if shown, right size). */
	cards?: boolean;
	/**
	 * The story renders a non-red primary colour: no stage effect pixel may be
	 * red-dominant (the dots used to be drawn in a fixed red, #1735).
	 */
	stageNotRed?: boolean;
	timeoutMs?: number;
}

/** True when the topmost element at the centre of `el` belongs to `el`. */
const reachable = (doc: Document, el: HTMLElement) => {
	const rect = el.getBoundingClientRect();
	const top = Math.max(rect.top, 0);
	const bottom = Math.min(rect.bottom, doc.defaultView!.innerHeight);
	const hit = doc.elementFromPoint(
		rect.left + rect.width / 2,
		(top + bottom) / 2
	);
	return !!hit && el.contains(hit);
};

const redDominantPixels = (canvas: HTMLCanvasElement) => {
	const context = canvas.getContext('2d');
	if (!context || !canvas.width || !canvas.height) return 0;
	const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
	let count = 0;
	for (let i = 0; i < data.length; i += 4) {
		const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
		if (a > 80 && r - b > 40 && r - g > 40) count += 1;
	}
	return count;
};

const drawnPixels = (canvas: HTMLCanvasElement) => {
	const context = canvas.getContext('2d');
	if (!context || !canvas.width || !canvas.height) return false;
	const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
	for (let i = 3; i < data.length; i += 4) if (data[i] > 40) return true;
	return false;
};

const checkCards = (
	canvasElement: HTMLElement,
	options: WaitingRoomLayoutOptions
): string | null => {
	const cards = [
		...canvasElement.querySelectorAll<HTMLElement>(
			'[data-cy^="handover-card-"]'
		)
	];
	if (!cards.length) {
		return options.cards ? 'the card carousel is missing' : null;
	}
	const viewport = canvasElement.ownerDocument.defaultView!.innerWidth;
	const expected = viewport >= CARD_SM_PX ? CARD_WIDTH.sm : CARD_WIDTH.xs;
	const wrong = cards.find(
		(card) => Math.round(card.getBoundingClientRect().width) !== expected
	);
	return wrong
		? `card is ${Math.round(wrong.getBoundingClientRect().width)}px wide, expected ${expected}px`
		: null;
};

const checkStageColour = (canvasElement: HTMLElement): string | null => {
	const canvases = [
		...canvasElement.ownerDocument.querySelectorAll<HTMLCanvasElement>(
			'.stageLayout__stage canvas'
		)
	];
	if (!canvases.length) return 'the stage draws no effect canvas';
	if (!canvases.some(drawnPixels))
		return 'the stage effect has not drawn yet';
	const red = canvases.reduce((sum, c) => sum + redDominantPixels(c), 0);
	return red ? `${red} stage pixels are red on a non-red brand` : null;
};

const checkFrame = (canvasElement: HTMLElement): string | null => {
	const doc = canvasElement.ownerDocument;
	const viewport = doc.defaultView!.innerWidth;
	const handover = doc.querySelector<HTMLElement>(
		'[data-cy="registration-handover"]'
	);
	if (handover && getComputedStyle(handover).position === 'fixed') {
		// The old overlay painted over the stage and the legal links.
		return 'the handover is a fixed overlay';
	}
	const footer = doc.querySelector<HTMLElement>(
		'[data-cy="registration-footer"]'
	);
	if (!footer) return 'the shared RegistrationFooter bar is missing';
	const bar = footer.getBoundingClientRect();
	const expectedWidth =
		viewport >= STAGE_SPLIT_PX ? viewport * 0.6 : viewport;
	if (Math.abs(bar.width - expectedWidth) > 2) {
		return `bar is ${bar.width}px wide, expected ${expectedWidth}px`;
	}
	if (Math.abs(bar.right - viewport) > 2) {
		return `bar ends at ${bar.right}px, not at the right edge ${viewport}px`;
	}
	if (getComputedStyle(footer).position !== 'fixed') {
		return 'bar is not fixed to the bottom edge';
	}
	const gate = footer.querySelector<HTMLElement>(
		'[data-cy-state], button[type="submit"]'
	);
	if (!gate) return 'no gate button inside the bar';
	// Paddings and at most one round exit (56px) beside it.
	const button = gate.getBoundingClientRect();
	if (button.width < bar.width - 140) {
		return `gate button is ${button.width}px in a ${bar.width}px bar`;
	}
	if (!gate.hasAttribute('disabled') && !reachable(doc, gate)) {
		return 'something covers the gate button';
	}
	if (viewport >= STAGE_SPLIT_PX) {
		const stage = doc.querySelector<HTMLElement>('.stage');
		if (!stage) return 'the red stage is missing beside the column';
		const panel = stage.getBoundingClientRect();
		if (panel.width < viewport * 0.3 || panel.left > 1) {
			return `stage stands at ${panel.left}px, ${panel.width}px wide`;
		}
		if (!reachable(doc, stage)) return 'something covers the red stage';
		const shownLegalRows = [
			...doc.querySelectorAll<HTMLElement>(
				'.stage__legalLinks, .stageLayout__legalLinks'
			)
		].filter((row) => row.getClientRects().length > 0);
		if (shownLegalRows.length !== 1) {
			return `legal links are shown ${shownLegalRows.length} times, expected once`;
		}
	}
	return null;
};

const check = (
	canvasElement: HTMLElement,
	options: WaitingRoomLayoutOptions
): string | null =>
	(options.frame === false ? null : checkFrame(canvasElement)) ??
	checkCards(canvasElement, options) ??
	(options.stageNotRed ? checkStageColour(canvasElement) : null);

/**
 * The layout every waiting room promises, checked in the browser. Each
 * waiting-room story runs it, so a merge that moves the bar, drops the stage
 * or shrinks the button fails a story instead of reaching Dev (#1219, #1735;
 * Frank, 2026-10-15: "nicht ein anderer Frontend-Merge wieder was
 * überschreibt"). One contract for all rooms; there is no second one.
 *
 * - The red stage stands beside the column on a desktop, uncovered.
 * - The bar is fixed to the bottom edge: the full width on a phone, the
 *   white column (60vw) on a desktop, ending at the right edge.
 * - The gate button spans the bar's row and nothing covers it.
 * - On a desktop the legal links stand once, on the stage.
 * - Cards, wherever shown, have the live chat's size.
 *
 * Plain DOM and plain errors, like `waitingClockStoryChecks.ts`, so this file
 * type-checks with the app and needs no `storybook/test`.
 */
export const expectWaitingRoomLayout = async (
	canvasElement: HTMLElement,
	options: WaitingRoomLayoutOptions = {}
) => {
	const until = Date.now() + (options.timeoutMs ?? 3000);
	let problem = check(canvasElement, options);
	while (problem && Date.now() < until) {
		await new Promise((resolve) => setTimeout(resolve, 50));
		problem = check(canvasElement, options);
	}
	if (problem) {
		throw new Error(`Waiting-room layout contract: ${problem}`);
	}
};
