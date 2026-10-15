/** The stage splits the page from this width on (MUI `lg`). */
const STAGE_SPLIT_PX = 1200;

const check = (canvasElement: HTMLElement): string | null => {
	const doc = canvasElement.ownerDocument;
	const viewport = doc.defaultView!.innerWidth;
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
	if (viewport >= STAGE_SPLIT_PX) {
		const stage = doc.querySelector<HTMLElement>('.stage');
		if (!stage) return 'the red stage is missing beside the column';
		const panel = stage.getBoundingClientRect();
		if (panel.width < viewport * 0.3 || panel.left > 1) {
			return `stage stands at ${panel.left}px, ${panel.width}px wide`;
		}
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
 * - On a desktop the legal links stand once, on the stage.
 *
 * Plain DOM and plain errors, like `waitingClockStoryChecks.ts`, so this file
 * type-checks with the app and needs no `storybook/test`.
 */
export const expectWaitingRoomLayout = async (
	canvasElement: HTMLElement,
	timeoutMs = 3000
) => {
	const until = Date.now() + timeoutMs;
	let problem = check(canvasElement);
	while (problem && Date.now() < until) {
		await new Promise((resolve) => setTimeout(resolve, 50));
		problem = check(canvasElement);
	}
	if (problem) {
		throw new Error(`Waiting-room layout contract: ${problem}`);
	}
};
