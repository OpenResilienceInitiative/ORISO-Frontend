// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

type ChangeListener = (event: MediaQueryListEvent) => void;

const installMatchMedia = (initialMatches: boolean) => {
	const listeners = new Set<ChangeListener>();
	const mql = {
		matches: initialMatches,
		media: '(prefers-reduced-motion: reduce)',
		addEventListener: (_: 'change', cb: ChangeListener) => listeners.add(cb),
		removeEventListener: (_: 'change', cb: ChangeListener) =>
			listeners.delete(cb),
		emit(matches: boolean) {
			mql.matches = matches;
			listeners.forEach((cb) => cb({ matches } as MediaQueryListEvent));
		},
		listenerCount: () => listeners.size
	};
	vi.stubGlobal(
		'matchMedia',
		vi.fn().mockReturnValue(mql as unknown as MediaQueryList)
	);
	return mql;
};

describe('usePrefersReducedMotion', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('returns false when the user has not requested reduced motion', () => {
		installMatchMedia(false);
		const { result } = renderHook(() => usePrefersReducedMotion());
		expect(result.current).toBe(false);
	});

	it('returns true when the user has requested reduced motion', () => {
		installMatchMedia(true);
		const { result } = renderHook(() => usePrefersReducedMotion());
		expect(result.current).toBe(true);
	});

	it('reacts when the preference changes at runtime', () => {
		const mql = installMatchMedia(false);
		const { result } = renderHook(() => usePrefersReducedMotion());
		expect(result.current).toBe(false);
		act(() => mql.emit(true));
		expect(result.current).toBe(true);
	});

	it('removes its listener on unmount', () => {
		const mql = installMatchMedia(true);
		const { unmount } = renderHook(() => usePrefersReducedMotion());
		expect(mql.listenerCount()).toBe(1);
		unmount();
		expect(mql.listenerCount()).toBe(0);
	});

	it('falls back to false when matchMedia is unavailable', () => {
		vi.stubGlobal('matchMedia', undefined);
		const { result } = renderHook(() => usePrefersReducedMotion());
		expect(result.current).toBe(false);
	});
});
