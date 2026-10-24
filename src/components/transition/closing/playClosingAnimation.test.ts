// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { orisoInputColors } from '../../form/orisoInputDesign';
import { transitionMotion } from '../transitionMotion';
import { playClosingAnimation } from './playClosingAnimation';

const ROOT = '[data-closing-animation]';
const primary = orisoInputColors.primary;

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
	});

	it('skips the animation for reduced motion and swaps the room at once', async () => {
		const animate = installAnimate('at once');
		const onCovered = vi.fn();
		const result = await playClosingAnimation({
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
			focal: 'messageField',
			onCovered
		});
		expect(result.played).toBe(false);
		expect(onCovered).toHaveBeenCalledTimes(1);
		expect(document.querySelector(ROOT)).toBeNull();
	});

	it('swaps once, in the middle, and leaves nothing behind', async () => {
		installAnimate('at once');
		focalOnPage();
		const seen: string[] = [];
		const onCovered = vi.fn(() => {
			seen.push(
				`covered:${document.querySelector(ROOT)?.getAttribute('data-closing-phase')}`
			);
		});
		const pending = playClosingAnimation({
			focal: 'messageField',
			onCovered
		});
		expect(
			document.querySelector(ROOT)?.getAttribute('data-closing-animation')
		).toBe('wave-reveal');
		await vi.advanceTimersByTimeAsync(200);
		const result = await pending;

		expect(result.played).toBe(true);
		expect(onCovered).toHaveBeenCalledTimes(1);
		expect(seen).toEqual(['covered:covered']);
		expect(document.querySelector(ROOT)).toBeNull();
	});

	it('takes the pointer while it covers, so blind taps cannot reach the room underneath, and lets it through once it reveals', async () => {
		const late = installLateAnimate();
		focalOnPage();
		const swap = held();
		const pending = playClosingAnimation({
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
	 * One timeline (`transitionMotion.closing`): cover and reveal take the same
	 * time in every room. A piece that starts late would have to end with the
	 * others, not after them.
	 */
	describe('one timeline', () => {
		type Call = [Keyframe[], KeyframeAnimationOptions];
		const endsFrom = (
			animate: { mock: { calls: unknown[] } },
			from: number
		) =>
			(animate.mock.calls.slice(from) as Call[]).map(
				([, options]) =>
					Number(options.delay ?? 0) + Number(options.duration)
			);

		it('the cover takes the shared cover time and the reveal the shared reveal time, to the last piece', async () => {
			const late = installLateAnimate();
			focalOnPage();
			const pending = playClosingAnimation({
				focal: 'messageField',
				onCovered: () => undefined
			});
			const { coverMs, revealMs } = transitionMotion.closing;
			const cover = endsFrom(late.animate, 0);
			expect(cover.length).toBeGreaterThan(0);
			expect(Math.max(...cover), 'cover').toBe(coverMs);

			const made = late.animate.mock.calls.length;
			late.finishAll();
			await vi.advanceTimersByTimeAsync(300);
			expect(
				document.querySelector(ROOT)!.getAttribute('data-closing-phase')
			).toBe('reveal');
			const reveal = endsFrom(late.animate, made);
			expect(reveal.length).toBeGreaterThan(0);
			expect(Math.max(...reveal), 'reveal').toBe(revealMs);

			late.finishAll();
			await vi.advanceTimersByTimeAsync(300);
			await pending;
		});
	});

	/**
	 * One design, one direction (Frank, 2026-10-20: the curtain and the slide are
	 * out; one big calm S-wave sweeps upward on every screen). One red sheet comes
	 * up from below and leaves at the top, so the cover and the reveal read as one
	 * wipe. Its two ends are waves, drawn once and moved with transforms only, so
	 * it stays light. Geometry at 1024 x 768 (what jsdom reports): the wave is
	 * 1178 px long (1.15 x the width) and 123 px deep (the smaller of 14% of that
	 * and 16% of the height), so an edge is 2 x 123 + 2 px tall and the sheet
	 * travels 768 + 246 + 2 = 1016 px.
	 */
	describe('the wave reveal', () => {
		type Call = [Keyframe[], KeyframeAnimationOptions];
		const callsOf = (animate: { mock: { calls: unknown[] } }) =>
			animate.mock.calls as Call[];
		const callsOn = (
			animate: { mock: { calls: unknown[]; contexts: unknown[] } },
			element: Element
		) =>
			callsOf(animate).filter(
				(_call, index) => animate.mock.contexts[index] === element
			);

		const play = async () => {
			const late = installLateAnimate();
			focalOnPage();
			const pending = playClosingAnimation({
				focal: 'messageField',
				onCovered: () => undefined
			});
			const overlay = document.querySelector(ROOT)!;
			const sheet = overlay.querySelector<HTMLElement>(
				'[data-closing-layer]'
			)!;
			const edge = (which: 'leading' | 'trailing') =>
				overlay.querySelector<HTMLElement>(
					`[data-closing-edge="${which}"]`
				)!;
			const pieces = {
				overlay,
				sheet,
				body: sheet.querySelector<HTMLElement>('[data-closing-body]')!,
				leading: edge('leading'),
				trailing: edge('trailing'),
				markup: overlay.outerHTML
			};
			late.finishAll();
			await vi.advanceTimersByTimeAsync(300);
			late.finishAll();
			await vi.advanceTimersByTimeAsync(300);
			await pending;
			return { late, ...pieces };
		};

		it('the sheet comes up from below and leaves at the top', async () => {
			const { late, sheet } = await play();
			const own = callsOn(late.animate, sheet);
			// Once on the way in, once on the way out.
			expect(own).toHaveLength(2);
			const [cover, reveal] = own.map(([keyframes]) => keyframes);
			expect(cover[0].transform, 'starts below the screen').toBe(
				'translateY(1016px)'
			);
			expect(cover[cover.length - 1].transform, 'covers').toBe('none');
			expect(reveal[0].transform, 'is covering').toBe('none');
			expect(
				reveal[reveal.length - 1].transform,
				'leaves above the screen'
			).toBe('translateY(-1016px)');
		});

		it('is one layer: a solid body with a wave at each end, and nothing else', async () => {
			const { overlay, sheet, body, leading, trailing } = await play();
			expect(
				overlay.querySelectorAll('[data-closing-layer]')
			).toHaveLength(1);
			expect(sheet.dataset.closingLayer).toBe('wave');
			expect([...sheet.children]).toEqual([body, leading, trailing]);
			// The body fills the screen exactly.
			expect(body.style.left).toBe('0px');
			expect(body.style.top).toBe('0px');
			expect(body.style.width).toBe('1024px');
			expect(body.style.height).toBe('768px');
			// The leading wave hangs above the body, the trailing one below it;
			// each overlaps the body by 2 px so no seam can show.
			expect(leading.style.top).toBe('-246px');
			expect(trailing.style.top).toBe('766px');
			[leading, trailing].forEach((edge) => {
				expect(edge.style.left).toBe('0px');
				expect(edge.style.width).toBe('1436px');
				expect(edge.style.height).toBe('248px');
			});
		});

		it('has waves one S deep: the line swings the whole depth and starts and ends on the body', async () => {
			const { leading, trailing } = await play();
			// The curve's own points are the last pair of every `C` segment.
			const lineOf = (edge: HTMLElement) =>
				(edge.querySelector('path')!.getAttribute('d') ?? '')
					.split('C')
					.slice(1)
					.map((segment) =>
						segment
							.split('V')[0]
							.trim()
							.split(/\s+/)
							.map(Number)
							.slice(-2)
					);
			[leading, trailing].forEach((edge) => {
				const d = edge.querySelector('path')!.getAttribute('d')!;
				expect(d.endsWith('Z'), 'a closed shape').toBe(true);
				const ys = lineOf(edge).map(([, y]) => y);
				expect(
					ys.length,
					'a handful of curve segments'
				).toBeGreaterThan(8);
				expect(ys.length).toBeLessThan(40);
				const [low, high] = [Math.min(...ys), Math.max(...ys)];
				const lowest = edge === leading ? 0 : 2;
				const highest = edge === leading ? 246 : 248;
				expect(low).toBeGreaterThanOrEqual(lowest - 0.5);
				expect(high).toBeLessThanOrEqual(highest + 0.5);
				expect(
					high - low,
					'the wave is one full depth (2 x 123 px) deep'
				).toBeGreaterThan(240);
			});
			// Solid below the leading line, solid above the trailing one.
			expect(
				leading
					.querySelector('path')!
					.getAttribute('d')!
					.startsWith('M0 248')
			).toBe(true);
			expect(
				trailing
					.querySelector('path')!
					.getAttribute('d')!
					.startsWith('M0 0')
			).toBe(true);
		});

		it('follows an exact sine: the middle of every curve lies within half a pixel of it', async () => {
			const { leading, trailing } = await play();
			const length = 1178;
			const depth = 123;
			[
				{ edge: leading, top: 0 },
				{ edge: trailing, top: 2 }
			].forEach(({ edge, top }) => {
				const sine = (x: number) =>
					top + depth * (1 - Math.sin((2 * Math.PI * x) / length));
				const d = edge.querySelector('path')!.getAttribute('d')!;
				const start = d.match(/L(\S+) (\S+)/)!;
				let from = [Number(start[1]), Number(start[2])];
				const curves = d
					.split('C')
					.slice(1)
					.map((curve) =>
						curve.split('V')[0].trim().split(/\s+/).map(Number)
					);
				expect(curves.length).toBeGreaterThan(8);
				curves.forEach(([x1, y1, x2, y2, x3, y3]) => {
					// The point of a cubic curve halfway along it.
					const x = (from[0] + 3 * x1 + 3 * x2 + x3) / 8;
					const y = (from[1] + 3 * y1 + 3 * y2 + y3) / 8;
					expect(Math.abs(y - sine(x))).toBeLessThan(0.5);
					from = [x3, y3];
				});
			});
		});

		it('drifts the wave sideways while it is on screen: the leading one on the way in, the trailing one on the way out', async () => {
			const { late, leading, trailing } = await play();
			const { coverMs, revealMs } = transitionMotion.closing;
			const lead = callsOn(late.animate, leading);
			const trail = callsOn(late.animate, trailing);
			expect(lead).toHaveLength(1);
			expect(trail).toHaveLength(1);
			expect(lead[0][0].map((frame) => frame.transform)).toEqual([
				'translateX(0px)',
				'translateX(-412px)'
			]);
			expect(trail[0][0].map((frame) => frame.transform)).toEqual([
				'translateX(0px)',
				'translateX(-412px)'
			]);
			expect(lead[0][1].duration).toBe(coverMs);
			expect(trail[0][1].duration).toBe(revealMs);
			// A wave that drifts at a steady pace, so the edge flows.
			expect(lead[0][1].easing).toBe('linear');
			expect(trail[0][1].easing).toBe('linear');
		});

		it('moves nothing after another piece: every animation starts at once', async () => {
			const { late } = await play();
			callsOf(late.animate).forEach(([, options]) =>
				expect(Number(options.delay ?? 0)).toBe(0)
			);
		});

		it("is the Träger's primary colour everywhere, and no other shade is drawn", async () => {
			const { body, leading, trailing, markup } = await play();
			// The body and both waves are drawn in the token itself, so the
			// sheet is one colour with no seam wherever they meet.
			expect(body.style.background).toBe(primary);
			[leading, trailing].forEach((edge) =>
				expect(edge.querySelector('path')!.getAttribute('style')).toBe(
					`fill:${primary}`
				)
			);
			// A shade that is not derived from the primary would be a colour of
			// its own once a Träger changes theirs.
			expect(markup).not.toContain('--m3-primary-hover');
			expect(markup).not.toContain('gradient');
			expect(markup).not.toContain('opacity');
			expect(markup.replaceAll(primary, '')).not.toMatch(
				/#[0-9a-f]{3,8}/i
			);
		});

		it('moves only transform, the property a browser animates on the graphics card', async () => {
			const { late } = await play();
			const properties = new Set(
				callsOf(late.animate).flatMap(([keyframes]) =>
					keyframes.flatMap((frame) => Object.keys(frame))
				)
			);
			properties.delete('offset');
			properties.delete('easing');
			expect([...properties]).toEqual(['transform']);
		});
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

		/* The marker sits on a wrapper, and the formatting toolbar stands before the
		   editor in the document: the first focusable thing is a button. */
		it.each([
			[
				'a contenteditable editor',
				() => {
					const editor = document.createElement('div');
					editor.setAttribute('contenteditable', 'true');
					editor.tabIndex = 0;
					return editor;
				}
			],
			['a textarea', () => document.createElement('textarea')],
			[
				'a textbox',
				() => {
					const editor = document.createElement('div');
					editor.setAttribute('role', 'textbox');
					editor.tabIndex = 0;
					return editor;
				}
			]
		])(
			'puts the keyboard into %s, not into a toolbar button that stands before it',
			async (_kind, makeEditor) => {
				const late = installLateAnimate();
				const gate = mountApp();
				let editor!: HTMLElement;
				let bold!: HTMLElement;
				const pending = playClosingAnimation({
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
						bold = document.createElement('button');
						editor = makeEditor();
						field.append(
							bold,
							document.createElement('button'),
							editor
						);
						app().appendChild(field);
					}
				});
				gate.blur();

				late.finishAll();
				await vi.advanceTimersByTimeAsync(50);
				expect(document.activeElement).not.toBe(bold);
				expect(document.activeElement).toBe(editor);

				late.finishAll();
				await vi.advanceTimersByTimeAsync(200);
				await pending;
			}
		);

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
		const piece = (selector: string) =>
			document.querySelector<HTMLElement>(
				`[data-closing-layer] ${selector}`
			)!;
		const shape = () => ({
			bodyWidth: piece('[data-closing-body]').style.width,
			bodyHeight: piece('[data-closing-body]').style.height,
			leadingTop: piece('[data-closing-edge="leading"]').style.top,
			trailingTop: piece('[data-closing-edge="trailing"]').style.top,
			edgeWidth: piece('[data-closing-edge="leading"]').style.width
		});
		/* 1366 x 640: the wave is 1571 px long and 102 px deep (16% of the height),
		   so the edges hang 204 px above and 204 - 2 px below the body. */
		const FITTED = {
			bodyWidth: '1366px',
			bodyHeight: '640px',
			leadingTop: '-204px',
			trailingTop: '638px',
			edgeWidth: '1916px'
		} as const;
		const layerCount = () =>
			document.querySelectorAll('[data-closing-layer]').length;

		it('fits the pieces to the new size while the screen is held covered', async () => {
			const late = installLateAnimate();
			focalOnPage();
			const swap = held();
			const pending = playClosingAnimation({
				focal: 'messageField',
				onCovered: swap.onCovered
			});
			const before = shape();
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
				expect(shape()).toEqual(FITTED);
				expect(shape()).not.toEqual(before);
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
				focal: 'messageField',
				onCovered: swap.onCovered
			});
			const restore = resizeTo(900, 1200);
			try {
				// Mid-cover nothing is rebuilt; it is checked once the screen is covered.
				window.dispatchEvent(new Event('resize'));
				expect(shape().bodyWidth).toBe('1024px');

				late.finishAll();
				await vi.advanceTimersByTimeAsync(50);
				expect(shape()).toEqual({
					bodyWidth: '900px',
					bodyHeight: '1200px',
					leadingTop: '-290px',
					trailingTop: '1198px',
					edgeWidth: '1262px'
				});

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
			[
				'only the height',
				1024,
				1000,
				{
					bodyWidth: '1024px',
					bodyHeight: '1000px',
					leadingTop: '-320px',
					trailingTop: '998px',
					edgeWidth: '1436px'
				}
			],
			[
				'only the width',
				800,
				768,
				{
					bodyWidth: '800px',
					bodyHeight: '768px',
					leadingTop: '-246px',
					trailingTop: '766px',
					edgeWidth: '1122px'
				}
			]
		])(
			"fits them when %s changes (a phone's address bar, a window dragged narrower)",
			async (_which, width, height, expected) => {
				const late = installLateAnimate();
				focalOnPage();
				const swap = held();
				const pending = playClosingAnimation({
					focal: 'messageField',
					onCovered: swap.onCovered
				});
				late.finishAll();
				await vi.advanceTimersByTimeAsync(50);

				const restore = resizeTo(width, height);
				try {
					window.dispatchEvent(new Event('resize'));
					expect(shape()).toEqual(expected);

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
				expect(shape().bodyWidth).toBe('1024px');
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
