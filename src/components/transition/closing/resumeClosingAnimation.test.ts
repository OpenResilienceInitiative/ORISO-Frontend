// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { transitionMotion } from '../transitionMotion';
import { resumeClosingAnimation } from './playClosingAnimation';
import {
	CLOSING_HANDOVER_KEY,
	ClosingHandover,
	leaveClosingHandover
} from './closingHandover';

const ROOT = '[data-closing-animation]';

interface Call {
	layer: string | undefined;
	phase: string;
	keyframes: Keyframe[];
	finish: ReturnType<typeof vi.fn>;
}

/**
 * jsdom has no Web Animations. What matters is which animations were started
 * in which phase, whether the cover was put at its end state at once
 * (`finish`), and whether the reveal reports back.
 */
const installAnimate = (reveal: 'at once' | 'never' = 'at once') => {
	const calls: Call[] = [];
	const animate = vi.fn(function (this: HTMLElement, keyframes: Keyframe[]) {
		// Looked up from the animated element: the cover may be off the page by now.
		const phase =
			this.closest<HTMLElement>(ROOT)?.dataset.closingPhase ?? '';
		const finish = vi.fn();
		calls.push({
			layer: this.dataset?.closingLayer,
			phase,
			keyframes,
			finish
		});
		return {
			finish,
			finished:
				phase !== 'reveal' || reveal === 'at once'
					? Promise.resolve()
					: new Promise<void>(() => undefined)
		};
	});
	(Element.prototype as unknown as { animate: unknown }).animate = animate;
	(document.documentElement as unknown as { animate: unknown }).animate =
		animate;
	return {
		calls,
		cover: () => calls.filter((call) => call.phase !== 'reveal'),
		reveal: () => calls.filter((call) => call.phase === 'reveal')
	};
};
const removeAnimate = () => {
	delete (Element.prototype as unknown as { animate?: unknown }).animate;
	delete (document.documentElement as unknown as { animate?: unknown })
		.animate;
};

const field = (name: 'message-field' | 'call' = 'message-field') => {
	const element = document.createElement('div');
	element.setAttribute('data-closing-focal', name);
	element.getBoundingClientRect = () =>
		({ left: 10, top: 700, width: 300, height: 60 }) as DOMRect;
	document.body.appendChild(element);
};

const leaveNote = (overrides: Partial<ClosingHandover> = {}) =>
	leaveClosingHandover(window, {
		focal: 'messageField',
		at: Date.now(),
		...overrides
	});

const root = () => document.querySelector<HTMLElement>(ROOT);
const phase = () => root()?.getAttribute('data-closing-phase');

/**
 * ORISO-Frontend#1737. The new document picks the closing animation up where
 * the old one let go: the screen is covered before anything else is on it, the
 * app starts underneath, and the reveal ends on the message field.
 */
describe('resumeClosingAnimation', () => {
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
		delete (window as unknown as { matchMedia?: unknown }).matchMedia;
		document.body.innerHTML = '';
		window.sessionStorage.clear();
	});

	it('plays nothing when the old document left no note', async () => {
		const play = installAnimate();
		const result = await resumeClosingAnimation();
		expect(result.played).toBe(false);
		expect(root()).toBeNull();
		expect(play.calls).toHaveLength(0);
	});

	it('covers the screen before anything else, with the wave', () => {
		const play = installAnimate();
		leaveNote();

		void resumeClosingAnimation();

		// Synchronously: nothing may be painted between the page load and the cover.
		expect(root()?.getAttribute('data-closing-animation')).toBe(
			'wave-reveal'
		);
		expect(phase()).toBe('covered');
		expect(
			root()?.querySelectorAll('[data-closing-layer]').length
		).toBeGreaterThan(0);
		expect(play.cover().length).toBeGreaterThan(0);
		play.cover().forEach((call) =>
			expect(
				call.finish,
				'the cover is put at its end at once, not played again'
			).toHaveBeenCalledTimes(1)
		);
		expect(play.reveal(), 'the reveal waits for the app').toHaveLength(0);
	});

	it('is picked up once: a reload while it plays does not play it again', async () => {
		installAnimate();
		leaveNote();
		void resumeClosingAnimation();
		expect(window.sessionStorage.getItem(CLOSING_HANDOVER_KEY)).toBeNull();
	});

	it('reveals upward, as the old document covered', async () => {
		const play = installAnimate();
		leaveNote();
		field();
		const pending = resumeClosingAnimation();
		await vi.advanceTimersByTimeAsync(200);
		await pending;

		const sheets = play.reveal().filter((call) => call.layer === 'wave');
		expect(sheets).toHaveLength(1);
		expect(sheets[0].keyframes.at(-1)?.transform).toMatch(
			/^translateY\(-\d+(\.\d+)?px\)$/
		);
	});

	it("covers in the tenant's colour, and in no other", () => {
		installAnimate();
		leaveNote({ colors: { primary: '#0050a0' } });
		void resumeClosingAnimation();

		const body = root()!.querySelector<HTMLElement>('[data-closing-body]')!;
		const probe = document.createElement('div');
		probe.style.backgroundColor = '#0050a0';
		expect(body.style.backgroundColor).toBe(probe.style.backgroundColor);
		const waves = root()!.querySelectorAll('[data-closing-edge] path');
		expect(waves).toHaveLength(2);
		waves.forEach((path) =>
			expect(path.getAttribute('style')).toBe('fill:#0050a0')
		);
	});

	it('waits for the app, reveals onto the message field and leaves nothing behind', async () => {
		const play = installAnimate();
		leaveNote();
		const pending = resumeClosingAnimation();
		await vi.advanceTimersByTimeAsync(1000);
		expect(phase(), 'still covered while the app starts').toBe('covered');
		expect(play.reveal()).toHaveLength(0);

		field();
		await vi.advanceTimersByTimeAsync(100);
		const result = await pending;

		expect(result.played).toBe(true);
		expect(
			play.reveal().length,
			'it opened once the field was there'
		).toBeGreaterThan(0);
		expect(root(), 'nothing covers the page afterwards').toBeNull();
	});

	it('passes through the same phases as the animation in one document', async () => {
		const seen: string[] = [];
		installAnimate();
		leaveNote();
		field();
		new MutationObserver(() => {
			const now = phase();
			if (now && seen.at(-1) !== now) seen.push(now);
		}).observe(document.body, {
			subtree: true,
			attributes: true,
			childList: true
		});
		const pending = resumeClosingAnimation();
		await vi.advanceTimersByTimeAsync(200);
		await pending;
		await Promise.resolve();
		expect(seen).toEqual(['covered', 'reveal', 'revealed']);
	});

	it('waits for the call, not for the message field, when the old document was on its way to one', async () => {
		const play = installAnimate();
		leaveNote({ focal: 'call' });
		field('message-field');
		const pending = resumeClosingAnimation();
		await vi.advanceTimersByTimeAsync(1000);
		expect(
			play.reveal(),
			'a message field is not what it is waiting for'
		).toHaveLength(0);

		field('call');
		await vi.advanceTimersByTimeAsync(200);
		await pending;
		expect(play.reveal().length).toBeGreaterThan(0);
		expect(root()).toBeNull();
	});

	it('gives the app the time a new document needs before it settles for the fallback point', async () => {
		const play = installAnimate();
		leaveNote();
		const pending = resumeClosingAnimation();
		// Later than a swap inside one document may take, earlier than a page load may.
		const { focalWaitMs, handoverFocalWaitMs } = transitionMotion.closing;
		const late = focalWaitMs + 700;
		expect(late).toBeLessThan(handoverFocalWaitMs);
		await vi.advanceTimersByTimeAsync(late);
		expect(phase(), 'still waiting for a field that comes late').toBe(
			'covered'
		);
		expect(play.reveal()).toHaveLength(0);
		field();
		await vi.advanceTimersByTimeAsync(200);
		await pending;

		expect(play.reveal().length).toBeGreaterThan(0);
		expect(root()).toBeNull();
	});

	it('opens anyway when the app never shows the field, and still gives the page back', async () => {
		const play = installAnimate();
		leaveNote();
		const pending = resumeClosingAnimation();
		await vi.advanceTimersByTimeAsync(
			transitionMotion.closing.handoverFocalWaitMs - 100
		);
		expect(phase(), 'still waiting just before the end of the wait').toBe(
			'covered'
		);
		await vi.advanceTimersByTimeAsync(300);
		await pending;

		expect(
			play.reveal().length,
			'it opened at the end of the wait'
		).toBeGreaterThan(0);
		expect(root()).toBeNull();
	});

	it('never leaves the page covered when the reveal never reports back', async () => {
		installAnimate('never');
		leaveNote();
		field();
		const pending = resumeClosingAnimation();
		await vi.advanceTimersByTimeAsync(transitionMotion.closing.capMs - 50);
		expect(root(), 'still playing just before the cap').not.toBeNull();
		await vi.advanceTimersByTimeAsync(100);

		expect((await pending).played).toBe(true);
		expect(root(), 'nothing covers the page after the cap').toBeNull();
	});

	it('does not open onto layers that are gone when a hidden tab comes back after the cap', async () => {
		const play = installAnimate();
		leaveNote();
		const waiting: FrameRequestCallback[] = [];
		vi.spyOn(window, 'requestAnimationFrame').mockImplementation(
			(callback) => waiting.push(callback)
		);
		const pending = resumeClosingAnimation();
		await vi.advanceTimersByTimeAsync(transitionMotion.closing.capMs + 50);
		await pending;
		expect(root()).toBeNull();
		expect(waiting.length, 'it was still looking').toBeGreaterThan(0);

		waiting.splice(0).forEach((frame) => frame(0));
		await vi.advanceTimersByTimeAsync(3000);

		expect(play.reveal()).toHaveLength(0);
	});

	it('takes the pointer while it covers, so no blind tap reaches the app starting underneath, and lets it through from the reveal on', async () => {
		// The reveal never reports back, so the phases can be looked at one by one.
		installAnimate('never');
		leaveNote();
		const pending = resumeClosingAnimation();

		expect(phase()).toBe('covered');
		expect(
			root()!.style.pointerEvents,
			'blocked while the app starts underneath'
		).toBe('auto');
		expect(root()!.getAttribute('aria-hidden')).toBe('true');
		const layers = root()!.querySelectorAll<HTMLElement>(
			'[data-closing-layer]'
		);
		expect(layers.length).toBeGreaterThan(0);
		layers.forEach((layer) =>
			expect(layer.style.pointerEvents).toBe('none')
		);

		await vi.advanceTimersByTimeAsync(1000);
		expect(phase(), 'still waiting for the app').toBe('covered');
		expect(root()!.style.pointerEvents).toBe('auto');

		field();
		await vi.advanceTimersByTimeAsync(100);
		expect(phase()).toBe('reveal');
		expect(
			root()!.style.pointerEvents,
			'the destination can be used while it is revealed'
		).toBe('none');

		await vi.advanceTimersByTimeAsync(transitionMotion.closing.capMs);
		await pending;
		expect(root(), 'the cap still removes it').toBeNull();
	});

	describe('the page behind the cover', () => {
		/** The container the app mounts into: it is in the HTML before any script runs. */
		const appPage = () => {
			const page = document.createElement('div');
			page.id = 'appRoot';
			document.body.appendChild(page);
			return page;
		};
		/** The chat's message field, with something to type in, once the app has rendered it. */
		const typingField = (page: HTMLElement) => {
			const wrapper = document.createElement('div');
			wrapper.setAttribute('data-closing-focal', 'message-field');
			wrapper.getBoundingClientRect = () =>
				({ left: 10, top: 700, width: 300, height: 60 }) as DOMRect;
			const input = document.createElement('textarea');
			wrapper.appendChild(input);
			page.appendChild(wrapper);
			return input;
		};
		const shut = (element: Element) => element.hasAttribute('inert');

		it('is shut for the keyboard and for screen readers while the app starts underneath, and the cover itself stays open', () => {
			installAnimate();
			const page = appPage();
			leaveNote();

			void resumeClosingAnimation();

			expect(shut(page)).toBe(true);
			expect(shut(root()!)).toBe(false);
		});

		it('stays shut for whatever the app renders into it', () => {
			installAnimate();
			const page = appPage();
			leaveNote();
			void resumeClosingAnimation();

			const input = typingField(page);
			input.focus();

			expect(shut(page)).toBe(true);
		});

		it('is opened again at the reveal, and the keyboard goes to the message field', async () => {
			// The reveal never reports back, so the moment it begins can be looked at.
			installAnimate('never');
			const page = appPage();
			leaveNote();
			const pending = resumeClosingAnimation();
			const input = typingField(page);
			await vi.advanceTimersByTimeAsync(100);

			expect(phase()).toBe('reveal');
			expect(shut(page), 'open as the reveal begins').toBe(false);
			expect(document.activeElement).toBe(input);

			await vi.advanceTimersByTimeAsync(transitionMotion.closing.capMs);
			await pending;
		});

		/* The composer skips its own autofocus up to 900 px: a focused field opens
		   the soft keyboard and shifts the header and the composer there. */
		it('leaves the message field alone on a narrow viewport, as the composer does', async () => {
			installAnimate('never');
			const width = Object.getOwnPropertyDescriptor(
				window,
				'innerWidth'
			)!;
			Object.defineProperty(window, 'innerWidth', {
				configurable: true,
				value: 390
			});
			try {
				const page = appPage();
				leaveNote();
				const pending = resumeClosingAnimation();
				const input = typingField(page);
				await vi.advanceTimersByTimeAsync(100);

				expect(phase()).toBe('reveal');
				expect(shut(page), 'open as the reveal begins').toBe(false);
				expect(document.activeElement).not.toBe(input);

				await vi.advanceTimersByTimeAsync(
					transitionMotion.closing.capMs
				);
				await pending;
			} finally {
				Object.defineProperty(window, 'innerWidth', width);
			}
		});

		it('leaves shut what was shut before, and opens only what it shut', async () => {
			installAnimate();
			const page = appPage();
			const before = document.createElement('div');
			before.setAttribute('inert', '');
			document.body.appendChild(before);
			leaveNote();
			const pending = resumeClosingAnimation();
			typingField(page);
			await vi.advanceTimersByTimeAsync(200);
			await pending;

			expect(shut(page)).toBe(false);
			expect(shut(before)).toBe(true);
		});

		it.each<
			[
				string,
				(pending: Promise<unknown>, page: HTMLElement) => Promise<void>
			]
		>([
			[
				'the reveal ends',
				async (pending, page) => {
					typingField(page);
					await vi.advanceTimersByTimeAsync(200);
					await pending;
				}
			],
			[
				'the reveal never reports back and the cap takes over',
				async (pending, page) => {
					typingField(page);
					await vi.advanceTimersByTimeAsync(
						transitionMotion.closing.capMs + 50
					);
					await pending;
				}
			],
			[
				'the app never shows its field and the fallback point is used',
				async (pending) => {
					await vi.advanceTimersByTimeAsync(
						transitionMotion.closing.handoverFocalWaitMs + 400
					);
					await pending;
				}
			]
		])('is opened again on every path: %s', async (name, finish) => {
			installAnimate(
				name.includes('never reports') ? 'never' : 'at once'
			);
			const page = appPage();
			leaveNote();
			const pending = resumeClosingAnimation();
			expect(shut(page)).toBe(true);

			await finish(pending, page);

			expect(root(), 'nothing covers the page').toBeNull();
			expect(shut(page), 'the page is open').toBe(false);
		});

		it('is opened again when a hidden tab comes back only after the cap', async () => {
			installAnimate();
			const page = appPage();
			leaveNote();
			const waiting: FrameRequestCallback[] = [];
			vi.spyOn(window, 'requestAnimationFrame').mockImplementation(
				(callback) => waiting.push(callback)
			);
			const pending = resumeClosingAnimation();
			expect(shut(page)).toBe(true);
			await vi.advanceTimersByTimeAsync(
				transitionMotion.closing.capMs + 50
			);
			await pending;

			expect(shut(page)).toBe(false);
			waiting.splice(0).forEach((frame) => frame(0));
			await vi.advanceTimersByTimeAsync(3000);
			expect(shut(page), 'a late frame shuts nothing again').toBe(false);
		});

		it.each([
			['the old document left no note', () => undefined],
			['a person asked for less motion', () => leaveNote()]
		])('is not touched when %s', async (name, prepare) => {
			installAnimate();
			const page = appPage();
			prepare();

			await resumeClosingAnimation({
				reducedMotion: name.includes('less motion')
			});

			expect(shut(page)).toBe(false);
			expect(
				window.sessionStorage.getItem(CLOSING_HANDOVER_KEY)
			).toBeNull();
		});

		it('is not touched in a browser that cannot animate', async () => {
			const page = appPage();
			leaveNote();

			await resumeClosingAnimation();

			expect(shut(page)).toBe(false);
		});
	});

	/**
	 * The pieces are sized in pixels when the stage is made. A phone that turns
	 * while the new document holds the screen covered must not show the app
	 * through the strip that has been added.
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
			document.querySelector<HTMLElement>('[data-closing-layer="wave"]')!;
		const layerCount = () =>
			document.querySelectorAll('[data-closing-layer]').length;

		it('fits the pieces to the new size while the app starts underneath', async () => {
			const play = installAnimate();
			leaveNote();
			const pending = resumeClosingAnimation();
			expect(phase()).toBe('covered');
			const before = front().style.width;
			const count = layerCount();

			const restore = resizeTo(1366, 640);
			try {
				const made = play.calls.length;
				window.dispatchEvent(new Event('resize'));
				expect(front().style.width).toBe('1366px');
				expect(front().style.height).toBe('640px');
				expect(front().style.width).not.toBe(before);
				expect(layerCount(), 'rebuilt, not added to').toBe(count);
				const rebuilt = play.calls.slice(made);
				expect(rebuilt.length).toBeGreaterThan(0);
				rebuilt.forEach((call) =>
					expect(
						call.finish,
						'the new pieces start where the cover ended, not at its beginning'
					).toHaveBeenCalled()
				);
			} finally {
				restore();
			}
			await vi.advanceTimersByTimeAsync(transitionMotion.closing.capMs);
			await pending;
		});

		it('leaves the pieces alone once the reveal has started', async () => {
			installAnimate('never');
			leaveNote();
			field();
			const pending = resumeClosingAnimation();
			await vi.advanceTimersByTimeAsync(100);
			expect(phase()).toBe('reveal');
			const before = front().style.width;

			const restore = resizeTo(1366, 640);
			try {
				window.dispatchEvent(new Event('resize'));
				expect(front().style.width).toBe(before);
			} finally {
				restore();
			}
			await vi.advanceTimersByTimeAsync(transitionMotion.closing.capMs);
			await pending;
		});

		it('stops listening when it is over', async () => {
			installAnimate();
			leaveNote();
			field();
			const remove = vi.spyOn(window, 'removeEventListener');
			const pending = resumeClosingAnimation();
			await vi.advanceTimersByTimeAsync(2000);
			await pending;
			expect(remove).toHaveBeenCalledWith('resize', expect.any(Function));
		});

		it('stops listening when the cap takes the cover away first', async () => {
			installAnimate('never');
			leaveNote();
			field();
			const remove = vi.spyOn(window, 'removeEventListener');
			const pending = resumeClosingAnimation();
			await vi.advanceTimersByTimeAsync(
				transitionMotion.closing.capMs + 50
			);
			await pending;
			expect(remove).toHaveBeenCalledWith('resize', expect.any(Function));
		});
	});

	describe('when it should not play', () => {
		it('throws a note away that is older than the animation may cover the page', async () => {
			const play = installAnimate();
			leaveNote({ at: Date.now() - transitionMotion.closing.capMs - 1 });

			const result = await resumeClosingAnimation();

			expect(result.played).toBe(false);
			expect(root()).toBeNull();
			expect(play.calls).toHaveLength(0);
			expect(
				window.sessionStorage.getItem(CLOSING_HANDOVER_KEY)
			).toBeNull();
		});

		it('draws nothing for a person who asked for less motion, and throws the note away', async () => {
			const play = installAnimate();
			leaveNote();

			const result = await resumeClosingAnimation({
				reducedMotion: true
			});

			expect(result.played).toBe(false);
			expect(root()).toBeNull();
			expect(play.calls).toHaveLength(0);
			expect(
				window.sessionStorage.getItem(CLOSING_HANDOVER_KEY)
			).toBeNull();
		});

		it('asks the system by itself whether the person wants less motion', async () => {
			const play = installAnimate();
			window.matchMedia = vi.fn(
				(query: string) =>
					({
						matches: query.includes('prefers-reduced-motion'),
						media: query
					}) as MediaQueryList
			) as unknown as typeof window.matchMedia;
			leaveNote();

			const result = await resumeClosingAnimation();

			expect(result.played).toBe(false);
			expect(play.calls).toHaveLength(0);
			expect(root()).toBeNull();
		});

		it('leaves the note alone when there is no page to cover yet', async () => {
			installAnimate();
			leaveNote();
			const noBody = {
				defaultView: window,
				body: null,
				documentElement: document.documentElement
			} as unknown as Document;

			const result = await resumeClosingAnimation({ document: noBody });

			expect(result.played).toBe(false);
			expect(
				window.sessionStorage.getItem(CLOSING_HANDOVER_KEY)
			).not.toBeNull();
		});

		it('draws nothing in a browser that cannot animate, and throws the note away', async () => {
			removeAnimate();
			leaveNote();

			const result = await resumeClosingAnimation();

			expect(result.played).toBe(false);
			expect(root()).toBeNull();
			expect(
				window.sessionStorage.getItem(CLOSING_HANDOVER_KEY)
			).toBeNull();
		});
	});
});
