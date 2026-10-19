// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { transitionMotion } from '../transitionMotion';
import { playClosingAnimation } from './playClosingAnimation';
import { CLOSING_VARIANTS } from './closingVariants';
import { CLOSING_HANDOVER_KEY } from './closingHandover';

const ROOT = '[data-closing-animation]';

/** jsdom has no Web Animations; a finished animation is all the engine needs. */
const installAnimate = (finish: 'at once' | 'never') => {
	const animate = vi.fn(() => ({
		finished:
			finish === 'at once'
				? Promise.resolve()
				: new Promise<void>(() => undefined),
		finish: vi.fn()
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
		}),
		finish: vi.fn()
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

/** A room that needs time to swap: `onCovered` stays open until released. */
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
		window.sessionStorage.clear();
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

	it('takes the pointer while it covers, so blind taps cannot reach the room underneath, and lets it through once it reveals', async () => {
		const late = installLateAnimate();
		focalOnPage();
		const swap = held();
		const pending = playClosingAnimation({
			variant: 'curtain',
			focal: 'messageField',
			onCovered: swap.onCovered
		});
		const root = document.querySelector<HTMLElement>(ROOT)!;
		const phase = () => root.getAttribute('data-closing-phase');

		expect(phase()).toBe('cover');
		expect(root.style.pointerEvents).toBe('auto');
		const layers = root.querySelectorAll<HTMLElement>(
			'[data-closing-layer]'
		);
		expect(layers.length).toBeGreaterThan(0);
		layers.forEach((layer) =>
			expect(layer.style.pointerEvents).toBe('none')
		);
		expect(root.getAttribute('aria-hidden')).toBe('true');

		late.finishAll();
		await vi.advanceTimersByTimeAsync(50);
		expect(phase()).toBe('covered');
		expect(
			root.style.pointerEvents,
			'still blocked while the room swaps and the screen is held red'
		).toBe('auto');

		swap.release();
		await vi.advanceTimersByTimeAsync(50);
		expect(phase()).toBe('reveal');
		expect(
			root.style.pointerEvents,
			'the destination can be used while it is revealed'
		).toBe('none');

		late.finishAll();
		await vi.advanceTimersByTimeAsync(200);
		await pending;
		expect(document.querySelector(ROOT)).toBeNull();
	});

	/**
	 * The overlay stops the pointer only. The room underneath must not be reachable
	 * by keyboard or assistive technology while the screen is held red either,
	 * or Tab and Enter could still press a control nobody can see.
	 */
	describe('the room underneath', () => {
		const app = () => document.getElementById('app')!;
		const mountApp = () => {
			const root = document.createElement('div');
			root.id = 'app';
			const button = document.createElement('button');
			button.id = 'gate';
			root.appendChild(button);
			document.body.appendChild(root);
			button.focus();
			return button;
		};

		it('cannot be reached while the screen covers, and is open again from the reveal on', async () => {
			const late = installLateAnimate();
			focalOnPage();
			const gate = mountApp();
			const swap = held();
			const pending = playClosingAnimation({
				variant: 'curtain',
				focal: 'messageField',
				onCovered: swap.onCovered
			});
			const overlay = document.querySelector<HTMLElement>(ROOT)!;

			expect(app().hasAttribute('inert')).toBe(true);
			expect(
				overlay.hasAttribute('inert'),
				'the overlay itself is not shut'
			).toBe(false);

			late.finishAll();
			await vi.advanceTimersByTimeAsync(50);
			expect(
				app().hasAttribute('inert'),
				'still shut while the screen is held red'
			).toBe(true);

			swap.release();
			await vi.advanceTimersByTimeAsync(50);
			expect(overlay.getAttribute('data-closing-phase')).toBe('reveal');
			expect(app().hasAttribute('inert')).toBe(false);
			expect(
				document.activeElement,
				'the keyboard is back where it was'
			).toBe(gate);

			late.finishAll();
			await vi.advanceTimersByTimeAsync(200);
			await pending;
		});

		it('is open again when the cap removes the overlay, and what was shut before stays shut', async () => {
			installAnimate('never');
			const gate = mountApp();
			const shutBefore = document.createElement('div');
			shutBefore.setAttribute('inert', '');
			document.body.appendChild(shutBefore);
			const pending = playClosingAnimation({
				variant: 'curtain',
				focal: 'messageField',
				onCovered: () => undefined
			});
			expect(app().hasAttribute('inert')).toBe(true);

			await vi.advanceTimersByTimeAsync(
				transitionMotion.closing.capMs + 10
			);
			await pending;
			expect(document.querySelector(ROOT)).toBeNull();
			expect(app().hasAttribute('inert')).toBe(false);
			expect(shutBefore.hasAttribute('inert')).toBe(true);
			expect(document.activeElement).toBe(gate);
		});

		/* A browser drops the focus of an element that is shut (jsdom does not). */
		it('hands the keyboard back to the button when the person stays', async () => {
			const late = installLateAnimate();
			const gate = mountApp();
			const pending = playClosingAnimation({
				variant: 'curtain',
				focal: 'messageField',
				onCovered: () => false
			});
			gate.blur();
			expect(document.activeElement).toBe(document.body);

			late.finishAll();
			await vi.advanceTimersByTimeAsync(50);
			expect(app().hasAttribute('inert')).toBe(false);
			expect(document.activeElement).toBe(gate);

			late.finishAll();
			await vi.advanceTimersByTimeAsync(200);
			await pending;
		});

		it('puts the keyboard into the field the person arrives in when the room was swapped', async () => {
			const late = installLateAnimate();
			const gate = mountApp();
			let editor!: HTMLElement;
			const pending = playClosingAnimation({
				variant: 'curtain',
				focal: 'messageField',
				onCovered: () => {
					// The room goes, the next one arrives inside the shut page.
					app().replaceChildren();
					const field = document.createElement('div');
					field.setAttribute('data-closing-focal', 'message-field');
					field.getBoundingClientRect = () =>
						({
							left: 10,
							top: 700,
							width: 300,
							height: 60
						}) as DOMRect;
					editor = document.createElement('div');
					editor.setAttribute('contenteditable', 'true');
					editor.tabIndex = 0;
					field.appendChild(editor);
					app().appendChild(field);
				}
			});
			gate.blur();

			late.finishAll();
			await vi.advanceTimersByTimeAsync(50);
			expect(app().hasAttribute('inert')).toBe(false);
			expect(gate.isConnected).toBe(false);
			expect(document.activeElement).toBe(editor);

			late.finishAll();
			await vi.advanceTimersByTimeAsync(200);
			await pending;
		});

		/* The composer skips its own autofocus up to 900 px: a focused field opens
		   the soft keyboard and shifts the header and the composer there. */
		it('leaves the arrival field alone on a narrow viewport, as the composer does', async () => {
			const width = Object.getOwnPropertyDescriptor(
				window,
				'innerWidth'
			)!;
			Object.defineProperty(window, 'innerWidth', {
				configurable: true,
				value: 390
			});
			try {
				const late = installLateAnimate();
				const gate = mountApp();
				let editor!: HTMLElement;
				const pending = playClosingAnimation({
					variant: 'curtain',
					focal: 'messageField',
					onCovered: () => {
						app().replaceChildren();
						const field = document.createElement('div');
						field.setAttribute(
							'data-closing-focal',
							'message-field'
						);
						field.getBoundingClientRect = () =>
							({
								left: 10,
								top: 700,
								width: 300,
								height: 60
							}) as DOMRect;
						editor = document.createElement('div');
						editor.setAttribute('contenteditable', 'true');
						editor.tabIndex = 0;
						field.appendChild(editor);
						app().appendChild(field);
					}
				});
				gate.blur();

				late.finishAll();
				await vi.advanceTimersByTimeAsync(50);
				expect(app().hasAttribute('inert')).toBe(false);
				expect(document.activeElement).not.toBe(editor);

				late.finishAll();
				await vi.advanceTimersByTimeAsync(200);
				await pending;
			} finally {
				Object.defineProperty(window, 'innerWidth', width);
			}
		});

		it('does not hand the keyboard to a button that is still shut, but to the field the person arrives in', async () => {
			const late = installLateAnimate();
			const gate = mountApp();
			const field = document.createElement('div');
			field.setAttribute('data-closing-focal', 'message-field');
			field.getBoundingClientRect = () =>
				({ left: 10, top: 700, width: 300, height: 60 }) as DOMRect;
			const editor = document.createElement('div');
			editor.setAttribute('contenteditable', 'true');
			editor.tabIndex = 0;
			field.appendChild(editor);
			document.body.appendChild(field);
			const pending = playClosingAnimation({
				variant: 'curtain',
				focal: 'messageField',
				onCovered: () => undefined
			});
			// jsdom cannot blur a button that is already disabled.
			gate.blur();
			gate.disabled = true;

			late.finishAll();
			await vi.advanceTimersByTimeAsync(50);
			expect(document.activeElement).toBe(editor);

			late.finishAll();
			await vi.advanceTimersByTimeAsync(200);
			await pending;
		});

		it('does not take the keyboard from something that already has it', async () => {
			const late = installLateAnimate();
			const gate = mountApp();
			const other = document.createElement('button');
			const pending = playClosingAnimation({
				variant: 'curtain',
				focal: 'messageField',
				onCovered: () => {
					document.body.appendChild(other);
					other.focus();
					return false;
				}
			});
			gate.blur();

			late.finishAll();
			await vi.advanceTimersByTimeAsync(50);
			expect(document.activeElement).toBe(other);

			late.finishAll();
			await vi.advanceTimersByTimeAsync(200);
			await pending;
		});

		it('is left alone when nothing is animated, since nothing covers it', async () => {
			mountApp();
			await playClosingAnimation({
				variant: 'curtain',
				focal: 'messageField',
				reducedMotion: true,
				onCovered: () => undefined
			});
			expect(app().hasAttribute('inert')).toBe(false);
		});
	});

	/**
	 * The pieces are sized in pixels when the press happens. A phone that turns
	 * while the screen is held covered must not show the room through the strip
	 * that has been added.
	 */
	describe('when the viewport changes', () => {
		const resizeTo = (width: number, height: number) => {
			const saved = {
				width: Object.getOwnPropertyDescriptor(window, 'innerWidth')!,
				height: Object.getOwnPropertyDescriptor(window, 'innerHeight')!
			};
			Object.defineProperty(window, 'innerWidth', {
				configurable: true,
				value: width
			});
			Object.defineProperty(window, 'innerHeight', {
				configurable: true,
				value: height
			});
			return () => {
				Object.defineProperty(window, 'innerWidth', saved.width);
				Object.defineProperty(window, 'innerHeight', saved.height);
			};
		};
		const front = () =>
			document.querySelector<HTMLElement>(
				'[data-closing-layer="slide-front"]'
			)!;
		const layerCount = () =>
			document.querySelectorAll('[data-closing-layer]').length;

		it('fits the pieces to the new size while the screen is held covered', async () => {
			const late = installLateAnimate();
			focalOnPage();
			const swap = held();
			const pending = playClosingAnimation({
				variant: 'slideReveal',
				focal: 'messageField',
				onCovered: swap.onCovered
			});
			const before = {
				width: front().style.width,
				height: front().style.height
			};
			const count = layerCount();
			late.finishAll();
			await vi.advanceTimersByTimeAsync(50);
			expect(
				document.querySelector(ROOT)!.getAttribute('data-closing-phase')
			).toBe('covered');

			const restore = resizeTo(1366, 640);
			try {
				const made = late.animate.mock.results.length;
				window.dispatchEvent(new Event('resize'));
				expect(front().style.width).toBe('1366px');
				expect(front().style.height).toBe('640px');
				expect(front().style.width).not.toBe(before.width);
				expect(layerCount(), 'rebuilt, not added to').toBe(count);
				const rebuilt = late.animate.mock.results.slice(made);
				expect(rebuilt.length).toBeGreaterThan(0);
				rebuilt.forEach((result) =>
					expect(
						(result.value as { finish: () => void }).finish,
						'the new pieces start where the cover ended, not at its beginning'
					).toHaveBeenCalled()
				);

				swap.release();
				late.finishAll();
				await vi.advanceTimersByTimeAsync(300);
				late.finishAll();
				await vi.advanceTimersByTimeAsync(300);
				await pending;
			} finally {
				restore();
			}
		});

		it('fits them when the size changed while the cover was still closing', async () => {
			const late = installLateAnimate();
			focalOnPage();
			const swap = held();
			const pending = playClosingAnimation({
				variant: 'slideReveal',
				focal: 'messageField',
				onCovered: swap.onCovered
			});
			const restore = resizeTo(900, 1200);
			try {
				// Mid-cover nothing is rebuilt; it is checked once the screen is covered.
				window.dispatchEvent(new Event('resize'));
				expect(front().style.width).toBe('1024px');

				late.finishAll();
				await vi.advanceTimersByTimeAsync(50);
				expect(front().style.width).toBe('900px');
				expect(front().style.height).toBe('1200px');

				swap.release();
				late.finishAll();
				await vi.advanceTimersByTimeAsync(300);
				late.finishAll();
				await vi.advanceTimersByTimeAsync(300);
				await pending;
			} finally {
				restore();
			}
		});

		it.each([
			['only the height', 1024, 1000],
			['only the width', 800, 768]
		])(
			"fits them when %s changes (a phone's address bar, a window dragged narrower)",
			async (_which, width, height) => {
				const late = installLateAnimate();
				focalOnPage();
				const swap = held();
				const pending = playClosingAnimation({
					variant: 'slideReveal',
					focal: 'messageField',
					onCovered: swap.onCovered
				});
				late.finishAll();
				await vi.advanceTimersByTimeAsync(50);

				const restore = resizeTo(width, height);
				try {
					window.dispatchEvent(new Event('resize'));
					expect(front().style.width).toBe(`${width}px`);
					expect(front().style.height).toBe(`${height}px`);

					swap.release();
					late.finishAll();
					await vi.advanceTimersByTimeAsync(300);
					late.finishAll();
					await vi.advanceTimersByTimeAsync(300);
					await pending;
				} finally {
					restore();
				}
			}
		);

		it('leaves the pieces alone once the reveal has started', async () => {
			const late = installLateAnimate();
			focalOnPage();
			const swap = held();
			const pending = playClosingAnimation({
				variant: 'slideReveal',
				focal: 'messageField',
				onCovered: swap.onCovered
			});
			late.finishAll();
			await vi.advanceTimersByTimeAsync(50);
			swap.release();
			await vi.advanceTimersByTimeAsync(50);
			expect(
				document.querySelector(ROOT)!.getAttribute('data-closing-phase')
			).toBe('reveal');

			const restore = resizeTo(1366, 640);
			try {
				window.dispatchEvent(new Event('resize'));
				expect(front().style.width).toBe('1024px');
				late.finishAll();
				await vi.advanceTimersByTimeAsync(300);
				await pending;
			} finally {
				restore();
			}
		});

		it('stops listening when it is over', async () => {
			installAnimate('at once');
			focalOnPage();
			const remove = vi.spyOn(window, 'removeEventListener');
			const pending = playClosingAnimation({
				variant: 'curtain',
				focal: 'messageField',
				onCovered: () => undefined
			});
			await vi.advanceTimersByTimeAsync(2000);
			await pending;
			expect(remove).toHaveBeenCalledWith('resize', expect.any(Function));
			remove.mockRestore();
		});
	});

	it('is removed by the cap even when it still blocks the pointer', async () => {
		installAnimate('never');
		const pending = playClosingAnimation({
			variant: 'curtain',
			focal: 'messageField',
			onCovered: () => undefined
		});
		expect(
			document.querySelector<HTMLElement>(ROOT)!.style.pointerEvents
		).toBe('auto');
		await vi.advanceTimersByTimeAsync(transitionMotion.closing.capMs + 10);
		await pending;
		expect(document.querySelector(ROOT)).toBeNull();
	});

	/**
	 * A swap that was refused or failed leaves the person where they are, so
	 * there is no destination to look for: waiting for one would keep the
	 * screen red for the whole focal wait, with the pointer blocked.
	 */
	describe.each([
		['a promise of false', () => Promise.resolve(false)],
		['false', () => false as const]
	])('when the room says the person stays (%s)', (_name, onCovered) => {
		it('does not wait for a destination and gives the room back quickly', async () => {
			installAnimate('at once');
			const pending = playClosingAnimation({
				variant: 'curtain',
				focal: 'messageField',
				onCovered
			});
			await vi.advanceTimersByTimeAsync(300);

			const result = await pending;
			expect(result.played).toBe(true);
			expect(document.querySelector(ROOT)).toBeNull();
		});
	});

	it('still waits for the destination when the swap says nothing about it', async () => {
		installAnimate('at once');
		const pending = playClosingAnimation({
			variant: 'curtain',
			focal: 'messageField',
			onCovered: () => Promise.resolve()
		});
		let over = false;
		void pending.then(() => {
			over = true;
		});
		await vi.advanceTimersByTimeAsync(300);
		expect(over, 'looking for the message field').toBe(false);
		await vi.advanceTimersByTimeAsync(
			transitionMotion.closing.focalWaitMs + 200
		);
		expect((await pending).played).toBe(true);
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

	/**
	 * A room that replaces the whole page (the live-chat room) never sees the
	 * reveal in its own document. The cover is handed to the next document, which
	 * plays the reveal (`resumeClosingAnimation`).
	 */
	describe('when the page is replaced under the cover', () => {
		const note = () => {
			const raw = window.sessionStorage.getItem(CLOSING_HANDOVER_KEY);
			return raw ? JSON.parse(raw) : null;
		};
		const never = () => new Promise<void>(() => undefined);
		const leave = () => window.dispatchEvent(new Event('pagehide'));
		// Let every animation of the test run into the cap, so none leaves its
		// listener on the window for the next test.
		afterEach(async () => {
			await vi.advanceTimersByTimeAsync(
				transitionMotion.closing.capMs + 100
			);
		});

		it.each(CLOSING_VARIANTS)(
			'%s: leaves a note for the next document, with the design and where it ends',
			async (variant) => {
				installAnimate('at once');
				void playClosingAnimation({
					variant,
					focal: 'call',
					origin: { x: 256, y: 384 },
					onCovered: never
				});
				await vi.advanceTimersByTimeAsync(200);
				expect(
					document
						.querySelector(ROOT)
						?.getAttribute('data-closing-phase')
				).toBe('covered');

				leave();

				expect(note()).toEqual({
					variant,
					focal: 'call',
					origin: {
						x: 256 / window.innerWidth,
						y: 384 / window.innerHeight
					},
					at: Date.now()
				});
			}
		);

		it('clamps the spot that was pressed to the screen, so the next document can always open from it', async () => {
			installAnimate('at once');
			void playClosingAnimation({
				variant: 'circleZoom',
				focal: 'messageField',
				origin: { x: -50, y: window.innerHeight * 3 },
				onCovered: never
			});
			await vi.advanceTimersByTimeAsync(200);

			leave();

			expect(note().origin).toEqual({ x: 0, y: 1 });
		});

		it("carries the tenant's colours, which the next document does not have yet", async () => {
			installAnimate('at once');
			const root = document.documentElement;
			root.style.setProperty('--m3-primary', '#0050a0');
			root.style.setProperty('--m3-primary-hover', '#00305f');
			try {
				void playClosingAnimation({
					variant: 'curtain',
					focal: 'messageField',
					onCovered: never
				});
				await vi.advanceTimersByTimeAsync(200);

				leave();

				expect(note().colors).toEqual({
					primary: '#0050a0',
					primaryDark: '#00305f'
				});
			} finally {
				root.style.removeProperty('--m3-primary');
				root.style.removeProperty('--m3-primary-hover');
			}
		});

		it.each(['--m3-primary', '--m3-primary-hover'])(
			'carries the colours only as a pair: %s alone is not enough',
			async (only) => {
				installAnimate('at once');
				const root = document.documentElement;
				root.style.setProperty(only, '#0050a0');
				try {
					void playClosingAnimation({
						variant: 'curtain',
						focal: 'messageField',
						onCovered: never
					});
					await vi.advanceTimersByTimeAsync(200);

					leave();

					expect(note()).not.toHaveProperty('colors');
				} finally {
					root.style.removeProperty(only);
				}
			}
		);

		it('carries no colours when the tenant has none: the platform colours apply on the other side', async () => {
			installAnimate('at once');
			void playClosingAnimation({
				variant: 'curtain',
				focal: 'messageField',
				onCovered: never
			});
			await vi.advanceTimersByTimeAsync(200);

			leave();

			expect(note()).not.toBeNull();
			expect(note()).not.toHaveProperty('colors');
		});

		it('leaves no note when the page goes before the screen is covered', async () => {
			installAnimate('never');
			void playClosingAnimation({
				variant: 'curtain',
				focal: 'messageField',
				onCovered: never
			});
			await vi.advanceTimersByTimeAsync(200);

			leave();

			expect(note()).toBeNull();
		});

		it('leaves no note once the reveal has begun: the room has arrived', async () => {
			// The cover finishes, the reveal never does.
			let calls = 0;
			(Element.prototype as unknown as { animate: unknown }).animate =
				vi.fn(() => ({
					finished:
						calls++ < 1
							? Promise.resolve()
							: new Promise<void>(() => undefined)
				}));
			(
				document.documentElement as unknown as { animate: unknown }
			).animate = Element.prototype.animate;
			focalOnPage();
			void playClosingAnimation({
				variant: 'circleZoom',
				focal: 'messageField',
				onCovered: () => undefined
			});
			await vi.advanceTimersByTimeAsync(200);
			expect(
				document.querySelector(ROOT)?.getAttribute('data-closing-phase')
			).toBe('reveal');

			leave();

			expect(note()).toBeNull();
		});

		it('leaves no note once the cap has taken the layers away', async () => {
			installAnimate('at once');
			const pending = playClosingAnimation({
				variant: 'slideReveal',
				focal: 'messageField',
				onCovered: never
			});
			await vi.advanceTimersByTimeAsync(
				transitionMotion.closing.capMs + 50
			);
			await pending;
			expect(document.querySelector(ROOT)).toBeNull();

			leave();

			expect(note()).toBeNull();
		});

		it('stops listening for the page to go once the animation is over', async () => {
			installAnimate('at once');
			focalOnPage();
			const added = vi.spyOn(window, 'addEventListener');
			const removed = vi.spyOn(window, 'removeEventListener');
			const pending = playClosingAnimation({
				variant: 'curtain',
				focal: 'messageField',
				onCovered: () => undefined
			});
			await vi.advanceTimersByTimeAsync(200);
			await pending;

			const listener = added.mock.calls.find(
				([type]) => type === 'pagehide'
			)?.[1];
			expect(listener, 'it listened while it played').toBeDefined();
			expect(removed).toHaveBeenCalledWith('pagehide', listener);
		});

		it('leaves no note when something else took the layers off the page', async () => {
			installAnimate('at once');
			void playClosingAnimation({
				variant: 'curtain',
				focal: 'messageField',
				onCovered: never
			});
			await vi.advanceTimersByTimeAsync(200);
			document.querySelector(ROOT)?.remove();

			leave();

			expect(note()).toBeNull();
		});

		it('leaves no note once the animation is over', async () => {
			installAnimate('at once');
			focalOnPage();
			const pending = playClosingAnimation({
				variant: 'curtain',
				focal: 'messageField',
				onCovered: () => undefined
			});
			await vi.advanceTimersByTimeAsync(200);
			await pending;

			leave();

			expect(note()).toBeNull();
		});

		it('leaves no note when nothing was drawn (reduced motion)', async () => {
			installAnimate('at once');
			void playClosingAnimation({
				variant: 'curtain',
				focal: 'messageField',
				reducedMotion: true,
				onCovered: never
			});
			await vi.advanceTimersByTimeAsync(200);

			leave();

			expect(note()).toBeNull();
		});

		it('leaves no note in a browser that cannot animate', async () => {
			removeAnimate();
			void playClosingAnimation({
				variant: 'curtain',
				focal: 'messageField',
				onCovered: never
			});
			await vi.advanceTimersByTimeAsync(200);

			leave();

			expect(note()).toBeNull();
		});
	});
});
