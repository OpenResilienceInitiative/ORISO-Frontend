// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCyclingIndex } from './useCyclingIndex';

describe('useCyclingIndex', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	it('starts at 0', () => {
		const { result } = renderHook(() => useCyclingIndex(3, 4000));
		expect(result.current).toBe(0);
	});

	it('advances to the next index after the interval elapses', () => {
		const { result } = renderHook(() => useCyclingIndex(3, 4000));
		act(() => {
			vi.advanceTimersByTime(4000);
		});
		expect(result.current).toBe(1);
	});

	it('wraps back to 0 after the last index', () => {
		const { result } = renderHook(() => useCyclingIndex(2, 4000));
		act(() => {
			vi.advanceTimersByTime(4000);
		});
		expect(result.current).toBe(1);
		act(() => {
			vi.advanceTimersByTime(4000);
		});
		expect(result.current).toBe(0);
	});

	it('does not cycle when there is a single item', () => {
		const { result } = renderHook(() => useCyclingIndex(1, 4000));
		act(() => {
			vi.advanceTimersByTime(40000);
		});
		expect(result.current).toBe(0);
	});

	it('does not cycle when there are no items', () => {
		const { result } = renderHook(() => useCyclingIndex(0, 4000));
		act(() => {
			vi.advanceTimersByTime(40000);
		});
		expect(result.current).toBe(0);
	});

	it('does not cycle when disabled (e.g. reduced motion)', () => {
		const { result } = renderHook(() =>
			useCyclingIndex(3, 4000, { enabled: false })
		);
		act(() => {
			vi.advanceTimersByTime(40000);
		});
		expect(result.current).toBe(0);
	});

	it('clears its timer on unmount', () => {
		const clearSpy = vi.spyOn(globalThis, 'clearInterval');
		const { unmount } = renderHook(() => useCyclingIndex(3, 4000));
		unmount();
		expect(clearSpy).toHaveBeenCalled();
	});

	it('keeps the index in range when the item count shrinks', () => {
		const { result, rerender } = renderHook(
			({ count }) => useCyclingIndex(count, 4000),
			{ initialProps: { count: 5 } }
		);
		act(() => {
			vi.advanceTimersByTime(4000 * 4);
		});
		expect(result.current).toBe(4);
		rerender({ count: 2 });
		expect(result.current).toBeLessThan(2);
	});
});
