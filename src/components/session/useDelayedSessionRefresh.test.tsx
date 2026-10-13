// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDelayedSessionRefresh } from './useDelayedSessionRefresh';

describe('delayed conversation refresh after sending', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it('keeps every rapid send refresh while the same conversation stays mounted', () => {
		const refresh = vi.fn();
		const { result } = renderHook(() =>
			useDelayedSessionRefresh('room-a', refresh)
		);
		result.current('room-a');
		result.current('room-a');
		act(() => vi.advanceTimersByTime(500));
		expect(refresh).toHaveBeenCalledTimes(2);
	});

	it('cancels every pending send refresh on unmount and ignores late success', () => {
		const refresh = vi.fn();
		const { result, unmount } = renderHook(() =>
			useDelayedSessionRefresh('room-a', refresh)
		);
		const schedule = result.current;
		schedule('room-a');
		schedule('room-a');
		unmount();
		schedule('room-a');
		expect(vi.getTimerCount()).toBe(0);
		act(() => vi.advanceTimersByTime(1000));
		expect(refresh).not.toHaveBeenCalled();
	});

	it('cancels old conversation timers and rejects its late completion after navigation', () => {
		const refresh = vi.fn();
		const { result, rerender } = renderHook(
			({ identity }) => useDelayedSessionRefresh(identity, refresh),
			{ initialProps: { identity: 'room-a' } }
		);
		result.current('room-a');
		result.current('room-a');
		rerender({ identity: 'room-b' });
		result.current('room-a');
		expect(vi.getTimerCount()).toBe(0);
		result.current('room-b');
		act(() => vi.advanceTimersByTime(500));
		expect(refresh).toHaveBeenCalledTimes(1);
	});

	it('uses the current callback for the same conversation instead of stale props', () => {
		const oldRefresh = vi.fn();
		const newRefresh = vi.fn();
		const { result, rerender } = renderHook(
			({ refresh }) => useDelayedSessionRefresh('room-a', refresh),
			{ initialProps: { refresh: oldRefresh } }
		);
		result.current('room-a');
		rerender({ refresh: newRefresh });
		act(() => vi.advanceTimersByTime(500));
		expect(oldRefresh).not.toHaveBeenCalled();
		expect(newRefresh).toHaveBeenCalledTimes(1);
	});
});
