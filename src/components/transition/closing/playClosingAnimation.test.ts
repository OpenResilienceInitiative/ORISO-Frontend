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
/** Every animation stays open until the test lets them all finish. */
const installLateAnimate = () => {
	const finishers: Array<() => void> = [];
	const animate = vi.fn(() => ({
		finished: new Promise<void>((resolve) => {
			finishers.push(resolve);
		})
	}));
	(Element.prototype as unknown as { animate: unknown }).animate = animate;
	(document.documentElement as unknown as { animate: unknown }).animate =
		animate;
	return {
		animate,
		finishAll: () => finishers.splice(0).forEach((finish) => finish())
	};
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
		vi.restoreAllMocks();
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

	/**
	 * A swap that is not instant (the live-chat room saves its consent and then
	 * replaces the whole page) keeps the screen covered until it is done.
	 */
	describe('when the room needs time to swap', () => {
		const held = () => {
			let release: () => void = () => undefined;
			let fail: (reason: Error) => void = () => undefined;
			const onCovered = vi.fn(
				() =>
					new Promise<void>((resolve, reject) => {
						release = resolve;
						fail = reject;
					})
			);
			return {
				onCovered,
				release: () => release(),
				fail: (reason: Error) => fail(reason)
			};
		};

		it('keeps the screen covered until the room has finished, then opens', async () => {
			installAnimate('at once');
			focalOnPage();
			const swap = held();
			const pending = playClosingAnimation({
				variant: 'curtain',
				focal: 'messageField',
				onCovered: swap.onCovered
			});

			await vi.advanceTimersByTimeAsync(1000);
			expect(
				document
					.querySelector(ROOT)
					?.getAttribute('data-closing-phase'),
				'still covered while the room swaps'
			).toBe('covered');

			swap.release();
			await vi.advanceTimersByTimeAsync(200);
			const result = await pending;
			expect(result.played).toBe(true);
			expect(document.querySelector(ROOT)).toBeNull();
		});

		it('waits for the room also when nothing can be animated', async () => {
			const swap = held();
			let settled = false;
			const pending = playClosingAnimation({
				variant: 'curtain',
				focal: 'messageField',
				reducedMotion: true,
				onCovered: swap.onCovered
			}).then((result) => {
				settled = true;
				return result;
			});

			await vi.advanceTimersByTimeAsync(500);
			expect(settled, 'not over before the room is').toBe(false);
			swap.release();
			expect((await pending).played).toBe(false);
		});

		it('never leaves the page covered when the room never finishes (the page is being replaced)', async () => {
			installAnimate('at once');
			const onCovered = vi.fn(() => new Promise<void>(() => undefined));
			const pending = playClosingAnimation({
				variant: 'slideReveal',
				focal: 'messageField',
				onCovered
			});

			await vi.advanceTimersByTimeAsync(
				transitionMotion.closing.capMs - 50
			);
			expect(document.querySelector(ROOT)).not.toBeNull();
			await vi.advanceTimersByTimeAsync(100);
			expect((await pending).played).toBe(true);
			expect(document.querySelector(ROOT)).toBeNull();
			expect(onCovered).toHaveBeenCalledTimes(1);
		});

		it('does not open onto layers that are gone when the room finishes after the cap', async () => {
			const animate = installAnimate('at once');
			focalOnPage();
			const swap = held();
			const pending = playClosingAnimation({
				variant: 'circleZoom',
				focal: 'messageField',
				onCovered: swap.onCovered
			});
			await vi.advanceTimersByTimeAsync(
				transitionMotion.closing.capMs + 50
			);
			await pending;
			const playedAtCap = animate.mock.calls.length;

			swap.release();
			await vi.advanceTimersByTimeAsync(3000);

			expect(animate.mock.calls.length).toBe(playedAtCap);
			expect(document.querySelector(ROOT)).toBeNull();
		});

		it('does not carry on when the cover finishes only after the cap, but the room is swapped once', async () => {
			const late = installLateAnimate();
			focalOnPage();
			const onCovered = vi.fn();
			const pending = playClosingAnimation({
				variant: 'curtain',
				focal: 'messageField',
				onCovered
			});
			await vi.advanceTimersByTimeAsync(
				transitionMotion.closing.capMs + 50
			);
			await pending;
			expect(onCovered, 'the cap swaps the room').toHaveBeenCalledTimes(
				1
			);
			const playedAtCap = late.animate.mock.calls.length;

			late.finishAll();
			await vi.advanceTimersByTimeAsync(3000);

			expect(late.animate.mock.calls.length).toBe(playedAtCap);
			expect(onCovered).toHaveBeenCalledTimes(1);
		});

		it('does not open onto layers that are gone when the tab was hidden while it looked for the destination', async () => {
			const animate = installAnimate('at once');
			const waiting: FrameRequestCallback[] = [];
			vi.spyOn(window, 'requestAnimationFrame').mockImplementation(
				(callback) => waiting.push(callback)
			);
			const pending = playClosingAnimation({
				variant: 'circleZoom',
				focal: 'messageField',
				onCovered: () => undefined
			});
			await vi.advanceTimersByTimeAsync(
				transitionMotion.closing.capMs + 50
			);
			await pending;
			expect(waiting.length, 'it was still looking').toBeGreaterThan(0);
			const playedAtCap = animate.mock.calls.length;

			// The tab comes back and the frames that were waiting run.
			waiting.splice(0).forEach((frame) => frame(0));
			await vi.advanceTimersByTimeAsync(3000);

			expect(animate.mock.calls.length).toBe(playedAtCap);
		});

		it('stops looking for the destination once the cap has removed the layers', async () => {
			installAnimate('at once');
			const swap = held();
			const frames = vi.spyOn(window, 'requestAnimationFrame');
			const pending = playClosingAnimation({
				variant: 'curtain',
				focal: 'messageField',
				onCovered: swap.onCovered
			});
			// The room takes long, so the cap falls into the wait for the destination.
			await vi.advanceTimersByTimeAsync(3000);
			swap.release();
			await vi.advanceTimersByTimeAsync(400);
			expect(frames.mock.calls.length, 'it was looking').toBeGreaterThan(
				0
			);

			await vi.advanceTimersByTimeAsync(
				transitionMotion.closing.capMs - 3400 + 50
			);
			await pending;
			const framesAtCap = frames.mock.calls.length;
			await vi.advanceTimersByTimeAsync(1500);

			expect(frames.mock.calls.length).toBe(framesAtCap);
		});

		it('leaves no unhandled rejection when the swap the cap forced fails', async () => {
			installLateAnimate();
			const unhandled: unknown[] = [];
			const hear = (reason: unknown) => unhandled.push(reason);
			process.on('unhandledRejection', hear);
			try {
				const pending = playClosingAnimation({
					variant: 'curtain',
					focal: 'messageField',
					onCovered: () => Promise.reject(new Error('too late'))
				});
				await vi.advanceTimersByTimeAsync(
					transitionMotion.closing.capMs + 50
				);
				await pending;
				await new Promise<void>((resolve) => setImmediate(resolve));
				expect(unhandled).toEqual([]);
			} finally {
				process.off('unhandledRejection', hear);
			}
		});

		it.each([
			['with the animation', false],
			['without it', true]
		])(
			'passes on a swap that fails and leaves nothing behind (%s)',
			async (_name, reducedMotion) => {
				installAnimate('at once');
				const swap = held();
				const outcome = playClosingAnimation({
					variant: 'curtain',
					focal: 'messageField',
					reducedMotion,
					onCovered: swap.onCovered
				}).then(
					() => null,
					(error: Error) => error
				);
				await vi.advanceTimersByTimeAsync(500);
				swap.fail(new Error('the room could not swap'));
				await vi.advanceTimersByTimeAsync(50);

				expect((await outcome)?.message).toBe(
					'the room could not swap'
				);
				expect(document.querySelector(ROOT)).toBeNull();
			}
		);
	});
});
