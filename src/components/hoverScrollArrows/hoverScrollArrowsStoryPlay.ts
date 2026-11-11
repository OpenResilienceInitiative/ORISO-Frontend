/**
 * Play-function steps for stories that use `HoverScrollArrows`.
 *
 * Plain DOM and plain errors on purpose: this file is type-checked with the
 * app (stories are not), so it does not import `storybook/test`.
 */

type Side = 'start' | 'end';

const find = (doc: Document, dataCy: string) =>
	doc.querySelector<HTMLElement>(`[data-cy="${dataCy}"]`);

/** Retries `check` until it stops throwing, like `waitFor`. */
const waitUntil = async <T>(check: () => T, timeoutMs = 3000): Promise<T> => {
	const deadline = performance.now() + timeoutMs;
	for (;;) {
		try {
			return check();
		} catch (error) {
			if (performance.now() > deadline) throw error;
			await new Promise((resolve) => setTimeout(resolve, 50));
		}
	}
};

const assert = (condition: unknown, message: string) => {
	if (!condition) throw new Error(message);
};

/**
 * Moves the mouse next to one edge of a `HoverScrollArrows` wrapper, the way
 * a visitor would, and waits until that edge's arrow has faded in.
 */
export const revealHoverArrow = async (
	canvasElement: HTMLElement,
	side: Side,
	dataCy = 'hover-scroll-arrows'
) => {
	const doc = canvasElement.ownerDocument;
	const wrapper = await waitUntil(() => {
		const el = find(doc, dataCy);
		assert(el, `no [data-cy="${dataCy}"]`);
		return el!;
	});
	const rect = wrapper.getBoundingClientRect();
	wrapper.dispatchEvent(
		new PointerEvent('pointermove', {
			bubbles: true,
			pointerType: 'mouse',
			clientX: side === 'end' ? rect.right - 24 : rect.left + 24,
			clientY: rect.top + rect.height / 2
		})
	);
	await waitUntil(() =>
		assert(
			find(doc, `${dataCy}-${side}`)?.dataset.near === 'true',
			`the ${side} arrow did not appear on hover`
		)
	);
};

/**
 * The behaviour Frank asked for (2026-11-11), on a real layout: at the start
 * there is no left arrow; hovering the right edge shows the right arrow; a
 * click moves one card, after which the left arrow exists too.
 */
export const expectArrowStepsOneCard = async (
	canvasElement: HTMLElement,
	trackDataCy: string,
	dataCy = 'hover-scroll-arrows'
) => {
	const doc = canvasElement.ownerDocument;
	const track = await waitUntil(() => {
		const el = find(doc, trackDataCy);
		assert(el, `no [data-cy="${trackDataCy}"]`);
		assert(el!.scrollWidth > el!.clientWidth, 'the track does not scroll');
		return el!;
	});
	track.scrollTo({ left: 0, behavior: 'auto' });
	await waitUntil(() => {
		assert(track.scrollLeft === 0, 'the track is not at the start');
		assert(
			!find(doc, `${dataCy}-previous`),
			'a left arrow is shown at the start'
		);
	});

	await revealHoverArrow(canvasElement, 'end', dataCy);
	const second = track.children[1] as HTMLElement;
	find(doc, `${dataCy}-next`)!.click();

	// Card 2 is now the card in the middle of the track (or, where cards
	// snap to their start, at the track's left edge) …
	await waitUntil(() => {
		const trackRect = track.getBoundingClientRect();
		const centre = trackRect.left + trackRect.width / 2;
		const card = second.getBoundingClientRect();
		assert(track.scrollLeft > 0, 'the track did not move');
		assert(
			(card.left <= centre && card.right >= centre) ||
				Math.abs(card.left - trackRect.left) <= 1,
			'card 2 is not the card in view'
		);
	});
	// … and there is a way back.
	await waitUntil(() =>
		assert(find(doc, `${dataCy}-previous`), 'no left arrow after moving')
	);
};
