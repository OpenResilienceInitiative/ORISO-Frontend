/**
 * Play-function steps for stories that use `HoverScrollArrows`.
 *
 * Plain DOM and plain errors on purpose: this file is type-checked with the
 * app (stories are not), so it does not import `storybook/test`.
 */

import { snapTargets } from './HoverScrollArrows';

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
	// `data-near` alone is not what the visitor sees. Wait until the strip
	// has really faded in under the desktop media rule, and until the
	// browser's own hit-testing lands on the arrow at its centre, i.e. a
	// click there reaches the button and not the card under it.
	const button = find(
		doc,
		`${dataCy}-${side === 'end' ? 'next' : 'previous'}`
	);
	assert(button, `no ${side} arrow button`);
	await waitUntil(() => {
		const strip = find(doc, `${dataCy}-${side}`)!;
		const style = doc.defaultView!.getComputedStyle(strip);
		assert(style.display !== 'none', `the ${side} arrow is hidden`);
		assert(style.opacity === '1', `the ${side} arrow has not faded in`);
		const box = button!.getBoundingClientRect();
		const hit = doc.elementFromPoint(
			box.left + box.width / 2,
			box.top + box.height / 2
		);
		assert(
			hit && button!.contains(hit),
			`the ${side} arrow is not reachable with the pointer`
		);
	});
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
	const [, secondTarget] = snapTargets(track);
	find(doc, `${dataCy}-next`)!.click();

	// The track settles on card 2's own snap position: exactly one step,
	// so a jump past card 2 fails here …
	await waitUntil(() => {
		assert(track.scrollLeft > 0, 'the track did not move');
		assert(
			Math.abs(track.scrollLeft - secondTarget) <= 1,
			`the track stopped at ${track.scrollLeft}, not at card 2 (${secondTarget})`
		);
	});
	// … and there is a way back.
	await waitUntil(() =>
		assert(find(doc, `${dataCy}-previous`), 'no left arrow after moving')
	);
};
