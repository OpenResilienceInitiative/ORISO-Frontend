// @vitest-environment oriso-jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

const playClosingAnimation = vi.fn(async () => ({ played: true }));
vi.mock('./playClosingAnimation', () => ({
	playClosingAnimation: (options: unknown) => playClosingAnimation(options)
}));

const { useClosingAnimation } = await import('./useClosingAnimation');

const reducedMotionIs = (reduce: boolean) => {
	window.matchMedia = ((q: string) => ({
		matches: q.includes('prefers-reduced-motion') ? reduce : false,
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
		reducedMotion: boolean;
		focal: string;
	};
};

/**
 * ORISO-Frontend#1737. One hook answers, for every waiting room, whether the
 * wave reveal plays at all. There is one design and one direction, so the width
 * of the screen is not asked.
 */
describe('useClosingAnimation', () => {
	beforeEach(() => playClosingAnimation.mockClear());
	afterEach(() => vi.restoreAllMocks());

	it('asks the engine for no direction: it sweeps upward on every screen', async () => {
		reducedMotionIs(false);
		expect(await pressed()).not.toHaveProperty('direction');
	});

	it('does not look at the width of the screen', async () => {
		const asked: string[] = [];
		window.matchMedia = ((q: string) => {
			asked.push(q);
			return {
				matches: false,
				media: q,
				addEventListener: () => undefined,
				removeEventListener: () => undefined,
				addListener: () => undefined,
				removeListener: () => undefined,
				dispatchEvent: () => false,
				onchange: null
			};
		}) as typeof window.matchMedia;
		await pressed();
		expect(asked.filter((q) => q.includes('width'))).toEqual([]);
	});

	it("hands the room's focal point on untouched", async () => {
		reducedMotionIs(false);
		expect((await pressed('call')).focal).toBe('call');
		expect((await pressed('messageField')).focal).toBe('messageField');
	});

	it('tells the engine to skip when the person asked for less motion', async () => {
		reducedMotionIs(true);
		expect((await pressed()).reducedMotion).toBe(true);
	});

	it('does not skip for a person who did not ask', async () => {
		reducedMotionIs(false);
		expect((await pressed()).reducedMotion).toBe(false);
	});
});
