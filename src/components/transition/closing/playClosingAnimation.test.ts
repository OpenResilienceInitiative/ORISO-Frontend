// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { transitionMotion } from '../transitionMotion';
import { playClosingAnimation } from './playClosingAnimation';
import { CLOSING_VARIANTS } from './closingVariants';

const ROOT = '[data-closing-animation]';

/** jsdom has no Web Animations; a finished animation is all the engine needs. */
const installAnimate = (finish: 'at once' | 'never') => {
	const animate = vi.fn(() => ({
		finished:
			finish === 'at once'
				? Promise.resolve()
				: new Promise<void>(() => undefined)
	}));
	(Element.prototype as unknown as { animate: unknown }).animate = animate;
	(document.documentElement as unknown as { animate: unknown }).animate =
		animate;
	return animate;
};
const removeAnimate = () => {
	delete (Element.prototype as unknown as { animate?: unknown }).animate;
	delete (document.documentElement as unknown as { animate?: unknown })
		.animate;
};

const focalOnPage = () => {
	const field = document.createElement('div');
	field.setAttribute('data-closing-focal', 'message-field');
	field.getBoundingClientRect = () =>
		({ left: 10, top: 700, width: 300, height: 60 }) as DOMRect;
	document.body.appendChild(field);
};

/**
 * ORISO-Frontend#1737. Whatever the browser or the person allows, the room is
 * swapped exactly once and nothing is left over the page.
 */
describe('playClosingAnimation', () => {
	beforeEach(() => {
		vi.useFakeTimers({
			toFake: [
				'setTimeout',
				'clearTimeout',
				'Date',
				'requestAnimationFrame'
			]
		});
	});
	afterEach(() => {
		vi.useRealTimers();
		removeAnimate();
		document.body.innerHTML = '';
	});

	it('skips the animation for reduced motion and swaps the room at once', async () => {
		const animate = installAnimate('at once');
		const onCovered = vi.fn();
		const result = await playClosingAnimation({
			variant: 'curtain',
			focal: 'messageField',
			reducedMotion: true,
			onCovered
		});
		expect(result.played).toBe(false);
		expect(onCovered).toHaveBeenCalledTimes(1);
		expect(animate).not.toHaveBeenCalled();
		expect(document.querySelector(ROOT)).toBeNull();
	});

	it('skips the animation in a browser that cannot animate, and the person still arrives', async () => {
		removeAnimate();
		const onCovered = vi.fn();
		const result = await playClosingAnimation({
			variant: 'slideReveal',
			focal: 'messageField',
			onCovered
		});
		expect(result.played).toBe(false);
		expect(onCovered).toHaveBeenCalledTimes(1);
		expect(document.querySelector(ROOT)).toBeNull();
	});

	it.each(CLOSING_VARIANTS)(
		'%s: swaps once, in the middle, and leaves nothing behind',
		async (variant) => {
			installAnimate('at once');
			focalOnPage();
			const seen: string[] = [];
			const onCovered = vi.fn(() => {
				seen.push(
					`covered:${document.querySelector(ROOT)?.getAttribute('data-closing-phase')}`
				);
			});
			const pending = playClosingAnimation({
				variant,
				focal: 'messageField',
				onCovered
			});
			expect(
				document
					.querySelector(ROOT)
					?.getAttribute('data-closing-animation')
			).toBe(variant);
			await vi.advanceTimersByTimeAsync(200);
			const result = await pending;

			expect(result.played).toBe(true);
			expect(onCovered).toHaveBeenCalledTimes(1);
			expect(seen).toEqual(['covered:covered']);
			expect(document.querySelector(ROOT)).toBeNull();
		}
	);

	it('never takes a pointer: the root and every layer let it through', async () => {
		installAnimate('never');
		const pending = playClosingAnimation({
			variant: 'curtain',
			focal: 'messageField',
			onCovered: () => undefined
		});
		const root = document.querySelector<HTMLElement>(ROOT)!;
		expect(root.style.pointerEvents).toBe('none');
		const layers = root.querySelectorAll<HTMLElement>(
			'[data-closing-layer]'
		);
		expect(layers.length).toBeGreaterThan(0);
		layers.forEach((layer) =>
			expect(layer.style.pointerEvents).toBe('none')
		);
		expect(root.getAttribute('aria-hidden')).toBe('true');
		await vi.advanceTimersByTimeAsync(transitionMotion.closing.capMs + 10);
		await pending;
	});

	it('removes the layers and still swaps once when an animation never reports back', async () => {
		installAnimate('never');
		const onCovered = vi.fn();
		const pending = playClosingAnimation({
			variant: 'circleZoom',
			focal: 'messageField',
			onCovered
		});
		await vi.advanceTimersByTimeAsync(transitionMotion.closing.capMs - 50);
		expect(
			document.querySelector(ROOT),
			'still playing just before the cap'
		).not.toBeNull();
		await vi.advanceTimersByTimeAsync(100);
		await pending;

		expect(
			document.querySelector(ROOT),
			'nothing covers the page after the cap'
		).toBeNull();
		expect(onCovered).toHaveBeenCalledTimes(1);
	});
});
