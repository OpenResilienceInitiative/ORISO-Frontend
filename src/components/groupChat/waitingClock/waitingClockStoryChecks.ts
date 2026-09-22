/**
 * Layout checks for the overdue "clock made of clocks", shared by the stories
 * of both surfaces that show it: the client entry page (`GroupWaitingRoom`)
 * and the counsellor's waiting room in the app (`JoinGroupChatView`).
 *
 * They exist because of #1499. On the client entry page at 1440 the clock
 * sizes itself to its column, the reserved width for the "+" was 28 px while
 * the glyph rendered 41.8 px, and the row went 9.8 px over an 800 px column.
 * The seconds group wrapped onto a second row inside a flip card that is one
 * group tall — so it spilled out of the card and painted over the "Das Warten
 * wird langsam etwas unangenehm …" caption underneath. One number is all
 * it takes to break this, and only a real layout can catch it: these run in
 * the browser-backed story tests, never in jsdom, where every box is 0x0.
 *
 * Plain DOM and plain errors on purpose — no `storybook/test` import, so the
 * file stays inside the app's own TypeScript project alongside the component.
 */

const CELLS_PER_DIGIT = 24;

const fail = (message: string): never => {
	throw new Error(`overdue clock: ${message}`);
};

/** Waits for the overdue row to be in the DOM (the clock ticks in a timer). */
const overdueRow = async (root: HTMLElement): Promise<HTMLElement> => {
	for (let attempt = 0; attempt < 50; attempt++) {
		const row = root.querySelector<HTMLElement>(
			'.waitingClock__timerOverdue'
		);
		if (row) {
			return row;
		}
		await new Promise((resolve) => {
			setTimeout(resolve, 20);
		});
	}
	return fail('no .waitingClock__timerOverdue rendered');
};

/** The two number groups of the overdue row, minutes first. */
const numberGroups = (row: HTMLElement) =>
	(Array.from(row.children) as HTMLElement[]).filter(
		(child) => !child.classList.contains('waitingClock__plus')
	);

/**
 * Minutes and seconds sit side by side, inside the column, and the clock stays
 * within the card that reserves its height.
 *
 * `digits` is what the minutes group must be drawing — two cells normally,
 * three from 100 minutes up.
 */
export const expectOverdueClockOnOneRow = async (
	root: HTMLElement,
	digits: 2 | 3 = 2
) => {
	const row = await overdueRow(root);
	const groups = numberGroups(row);
	if (groups.length !== 2) {
		fail(`expected 2 number groups, found ${groups.length}`);
	}

	const [minutes, seconds] = groups.map((group) =>
		group.getBoundingClientRect()
	);
	if (Math.abs(minutes.top - seconds.top) > 1) {
		fail(
			`minutes and seconds are on different rows (top ${minutes.top} vs ${seconds.top})`
		);
	}
	if (seconds.left < minutes.right - 1) {
		fail('the seconds group does not follow the minutes group');
	}

	// The minutes group really draws the number of digits it claims to.
	const cells = groups[0].querySelectorAll('.waitingClock__cell').length;
	if (cells !== digits * CELLS_PER_DIGIT) {
		fail(
			`minutes group has ${cells} mini-clocks, expected ${
				digits * CELLS_PER_DIGIT
			} for ${digits} digits`
		);
	}

	// Inside the column the clock measured itself against.
	const column = row.closest<HTMLElement>('[role="timer"]');
	if (column) {
		const rowRect = row.getBoundingClientRect();
		const columnRect = column.getBoundingClientRect();
		if (
			rowRect.left < columnRect.left - 1 ||
			rowRect.right > columnRect.right + 1
		) {
			fail(
				`the row (${rowRect.width} px) is wider than its column (${columnRect.width} px)`
			);
		}
	}

	// Inside the flip card, whose height is one group — this is the overflow
	// that painted the digits over the caption.
	const card = row.closest<HTMLElement>('.waitingClock__card');
	if (
		card &&
		row.getBoundingClientRect().bottom >
			card.getBoundingClientRect().bottom + 1
	) {
		fail('the row hangs out of the bottom of the flip card');
	}
};

const channel = (value: number) =>
	value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;

/** Relative luminance of a computed `rgb(...)` / `rgba(...)` colour. */
const luminance = (colour: string) => {
	const parts = colour.match(/[\d.]+/g);
	if (!parts || parts.length < 3) {
		return fail(`cannot read the colour "${colour}"`);
	}
	const [r, g, b] = parts.slice(0, 3).map((n) => channel(Number(n) / 255));
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrast = (a: string, b: string) => {
	const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (high + 0.05) / (low + 0.05);
};

/** Resolves a colour token through an element, so themes and fallbacks apply. */
const token = (element: HTMLElement, name: string) => {
	const probe = element.ownerDocument.createElement('span');
	probe.style.color = `var(${name})`;
	element.appendChild(probe);
	const value =
		element.ownerDocument.defaultView!.getComputedStyle(probe).color;
	probe.remove();
	return value;
};

/**
 * The clock hands stand out from the faces they are drawn on, whatever the
 * Träger's brand colour is. The hands are `--m3-on-primary-fixed-variant`, the
 * faces are a gradient from a surface (or the brand's pale tint) to the
 * lightest surface, so both ends of both gradients have to clear 3:1 (#1499).
 */
export const expectHandsVisible = async (root: HTMLElement, minimum = 3) => {
	const hand = root.querySelector<HTMLElement>('.waitingClock__hand');
	if (!hand) {
		return fail('no .waitingClock__hand rendered');
	}
	const view = root.ownerDocument.defaultView!;
	const ink = view.getComputedStyle(hand).backgroundColor;
	const faces = [
		'--m3-surface-container-high',
		'--m3-surface-container-lowest',
		'--m3-primary-fixed'
	];
	for (const face of faces) {
		const ratio = contrast(ink, token(root, face));
		if (ratio < minimum) {
			fail(
				`hands (${ink}) only reach ${ratio.toFixed(2)}:1 on ${face} — needs ${minimum}:1`
			);
		}
	}
};

/** Nothing of the clock is drawn on top of the caption below it. */
export const expectCaptionClear = async (root: HTMLElement) => {
	const row = await overdueRow(root);
	const caption = root.querySelector<HTMLElement>(
		'.waitingClock__overdueCaption'
	);
	if (!caption) {
		fail('no .waitingClock__overdueCaption rendered');
		return;
	}
	const captionTop = caption.getBoundingClientRect().top;
	const rowBottom = row.getBoundingClientRect().bottom;
	if (captionTop < rowBottom - 1) {
		fail(
			`the clock (bottom ${rowBottom}) overlaps the caption (top ${captionTop})`
		);
	}
};
