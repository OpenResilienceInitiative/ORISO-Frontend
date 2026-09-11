// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLampMap } from './lampMapEffect';

/**
 * #1135 (2): on a first visit the stage slides from 100vw to 40vw over 2.5 s.
 * The lamp map used to measure its canvas once, so a map built at 1440 px was
 * afterwards squeezed by CSS to a third of its width. The effect must re-fit
 * when the panel changes size.
 *
 * jsdom has no 2D canvas, so the context is a recording stub — the test is
 * about sizing, not pixels.
 */

type ResizeCallback = (entries: unknown[]) => void;

let resizeCallback: ResizeCallback | null = null;
let clientWidth = 1440;
let clientHeight = 900;

const contextStub = () =>
	new Proxy(
		{
			createRadialGradient: () => ({ addColorStop: () => undefined })
		} as Record<string, unknown>,
		{
			get: (target, key) =>
				key in target ? target[key as string] : () => undefined
		}
	);

beforeEach(() => {
	vi.useFakeTimers();
	resizeCallback = null;
	clientWidth = 1440;
	clientHeight = 900;
	vi.stubGlobal(
		'ResizeObserver',
		class {
			constructor(callback: ResizeCallback) {
				resizeCallback = callback;
			}
			observe() {}
			disconnect() {}
		}
	);
	vi.stubGlobal('devicePixelRatio', 1);
	vi.stubGlobal('requestAnimationFrame', () => 1);
	vi.stubGlobal('cancelAnimationFrame', () => undefined);
	vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
		() => contextStub() as unknown as CanvasRenderingContext2D
	);
	Object.defineProperty(HTMLCanvasElement.prototype, 'clientWidth', {
		configurable: true,
		get: () => clientWidth
	});
	Object.defineProperty(HTMLCanvasElement.prototype, 'clientHeight', {
		configurable: true,
		get: () => clientHeight
	});
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe('createLampMap sizing (#1135)', () => {
	it('re-fits the bitmap once the panel has settled at a new size', async () => {
		const container = document.createElement('div');
		const canvas = document.createElement('canvas');
		container.appendChild(canvas);

		const handle = await createLampMap(container, canvas);
		expect(canvas.width).toBe(1440);
		expect(canvas.height).toBe(900);

		// The stage finished sliding to 40vw.
		clientWidth = 576;
		expect(resizeCallback).not.toBeNull();
		resizeCallback?.([]);
		// Not yet — the observer fires many times during the slide.
		expect(canvas.width).toBe(1440);
		vi.advanceTimersByTime(200);
		expect(canvas.width).toBe(576);
		expect(canvas.height).toBe(900);

		handle.destroy();
	});

	it('waits for a real size before reporting its first frame', async () => {
		clientWidth = 0;
		clientHeight = 0;
		const container = document.createElement('div');
		const canvas = document.createElement('canvas');
		container.appendChild(canvas);
		const onFirstFrame = vi.fn();
		// The render loop is driven by hand: rAF is stubbed out, so calling
		// the frame callback is what "paints" here.
		let frame: FrameRequestCallback | null = null;
		vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
			frame = cb;
			return 1;
		});

		const handle = await createLampMap(container, canvas, { onFirstFrame });
		frame?.(0);
		// Nothing was fitted yet — the caller must not start the wandering
		// point on a blank frame.
		expect(onFirstFrame).not.toHaveBeenCalled();

		clientWidth = 576;
		clientHeight = 900;
		resizeCallback?.([]);
		vi.advanceTimersByTime(200);
		frame?.(16);
		expect(onFirstFrame).toHaveBeenCalledTimes(1);

		handle.destroy();
	});

	it('leaves the bitmap alone when the size did not actually change', async () => {
		const container = document.createElement('div');
		const canvas = document.createElement('canvas');
		container.appendChild(canvas);
		const handle = await createLampMap(container, canvas);
		const before = canvas.width;
		expect(resizeCallback).not.toBeNull();
		resizeCallback?.([]);
		vi.advanceTimersByTime(200);
		expect(canvas.width).toBe(before);
		handle.destroy();
	});
});
