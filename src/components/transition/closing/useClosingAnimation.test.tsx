// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const playClosingAnimation = vi.fn(async () => ({ played: true }));
vi.mock('./playClosingAnimation', () => ({
	playClosingAnimation: (options: unknown) => playClosingAnimation(options)
}));

const { useClosingAnimation } = await import('./useClosingAnimation');

const screenIs = (query: { desktop: boolean; reducedMotion: boolean }) => {
	window.matchMedia = ((q: string) => ({
		matches: q.includes('prefers-reduced-motion')
			? query.reducedMotion
			: q.includes('min-width: 1200px')
				? query.desktop
				: false,
		media: q,
		addEventListener: () => undefined,
		removeEventListener: () => undefined,
		addListener: () => undefined,
		removeListener: () => undefined,
		dispatchEvent: () => false,
		onchange: null
	})) as typeof window.matchMedia;
};

const pressed = async (focal: 'messageField' | 'call' = 'messageField') => {
	const { result } = renderHook(() => useClosingAnimation());
	await result.current.play({
		focal,
		onCovered: () => undefined
	});
	return playClosingAnimation.mock.calls.at(-1)?.[0] as unknown as {
		direction: string;
		reducedMotion: boolean;
		focal: string;
	};
};

/**
 * ORISO-Frontend#1737. One hook answers, for every waiting room, which way the
 * slide reveal sweeps and whether it plays at all.
 */
describe('useClosingAnimation', () => {
	beforeEach(() => playClosingAnimation.mockClear());
	afterEach(() => vi.restoreAllMocks());

	it('sweeps sideways on a desktop width', async () => {
		screenIs({ desktop: true, reducedMotion: false });
		expect((await pressed()).direction).toBe('horizontal');
	});

	it('sweeps upward on anything narrower', async () => {
		screenIs({ desktop: false, reducedMotion: false });
		expect((await pressed()).direction).toBe('vertical');
	});

	it('sweeps upward in a browser that cannot answer the width query', async () => {
		(window as unknown as { matchMedia?: unknown }).matchMedia = undefined;
		expect((await pressed()).direction).toBe('vertical');
	});

	it("hands the room's focal point on untouched", async () => {
		screenIs({ desktop: true, reducedMotion: false });
		expect((await pressed('call')).focal).toBe('call');
		expect((await pressed('messageField')).focal).toBe('messageField');
	});

	it('tells the engine to skip when the person asked for less motion', async () => {
		screenIs({ desktop: true, reducedMotion: true });
		expect((await pressed()).reducedMotion).toBe(true);
	});

	it('does not skip for a person who did not ask', async () => {
		screenIs({ desktop: true, reducedMotion: false });
		expect((await pressed()).reducedMotion).toBe(false);
	});
});
