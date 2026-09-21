// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { OrbitalTrails } from './OrbitalTrails';

/* jsdom has no canvas: a 2D context whose every method is a no-op. */
const fakeContext = () =>
	new Proxy({} as Record<string, unknown>, {
		get: (target, key) =>
			key in target ? target[key as string] : () => undefined,
		set: (target, key, value) => {
			target[key as string] = value;
			return true;
		}
	});

let frames: FrameRequestCallback[];
beforeEach(() => {
	frames = [];
	vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
		() => fakeContext() as never
	);
	vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
		frames.push(cb);
		return frames.length;
	});
	vi.stubGlobal('cancelAnimationFrame', () => undefined);
});
afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

it('stops asking for frames once the trail budget is drawn', () => {
	vi.stubGlobal(
		'IntersectionObserver',
		class {
			observe() {}
			disconnect() {}
		}
	);
	/* 1200 is the component's frame cap: the canvas is already complete. */
	render(<OrbitalTrails label="Lädt" warmupFrames={1200} />);

	expect(frames).toHaveLength(1);
	frames.shift()!(1000);

	expect(frames).toHaveLength(0);
});

it('still animates where IntersectionObserver does not exist', () => {
	vi.stubGlobal('IntersectionObserver', undefined);

	expect(() => render(<OrbitalTrails label="Lädt" />)).not.toThrow();
	expect(frames.length).toBeGreaterThan(0);
});

it('stops asking for frames while off screen, and resumes when back', () => {
	let report: (entries: { isIntersecting: boolean }[]) => void = () =>
		undefined;
	vi.stubGlobal(
		'IntersectionObserver',
		class {
			constructor(cb: typeof report) {
				report = cb;
			}
			observe() {}
			disconnect() {}
		}
	);
	render(<OrbitalTrails label="Lädt" />);
	expect(frames).toHaveLength(1);

	report([{ isIntersecting: false }]);
	frames.shift()!(1000);
	expect(frames).toHaveLength(0);

	report([{ isIntersecting: true }]);
	expect(frames).toHaveLength(1);
});
