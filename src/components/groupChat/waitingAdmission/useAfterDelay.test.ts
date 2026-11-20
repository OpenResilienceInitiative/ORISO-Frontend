// @vitest-environment oriso-jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { useAfterDelay } from './useAfterDelay';

afterEach(() => vi.useRealTimers());

describe('useAfterDelay (#2237)', () => {
	it('turns true once the time has passed while on', () => {
		vi.useFakeTimers();
		const { result } = renderHook(() => useAfterDelay(true, 60_000));
		expect(result.current).toBe(false);
		act(() => {
			vi.advanceTimersByTime(60_000);
		});
		expect(result.current).toBe(true);
	});

	it('starts over when switched off', () => {
		vi.useFakeTimers();
		const { result, rerender } = renderHook(
			({ on }) => useAfterDelay(on, 60_000),
			{ initialProps: { on: true } }
		);
		act(() => {
			vi.advanceTimersByTime(60_000);
		});
		rerender({ on: false });
		expect(result.current).toBe(false);
		rerender({ on: true });
		act(() => {
			vi.advanceTimersByTime(30_000);
		});
		expect(result.current).toBe(false);
	});
});
