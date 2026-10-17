// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	USERNAME_AVAILABILITY_DEBOUNCE_MS,
	useUsernameAvailability
} from './useUsernameAvailability';

const settle = () =>
	act(async () => {
		await vi.advanceTimersByTimeAsync(USERNAME_AVAILABILITY_DEBOUNCE_MS);
	});

describe('useUsernameAvailability', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it('reports a taken User-ID once the backend has answered', async () => {
		const check = vi.fn(() => Promise.resolve(false));
		const { result } = renderHook(() =>
			useUsernameAvailability('eule_mika', true, check)
		);
		expect(result.current.checked).toBe(false);
		await settle();
		expect(result.current).toEqual({
			isAvailable: false,
			checked: true,
			failed: false
		});
	});

	it('never counts a newer entry as checked by an older answer', async () => {
		const check = vi.fn(() => Promise.resolve(true));
		const { result, rerender } = renderHook(
			({ name }) => useUsernameAvailability(name, true, check),
			{ initialProps: { name: 'eule_mika' } }
		);
		await settle();
		expect(result.current.checked).toBe(true);
		rerender({ name: 'eule_mika_2' });
		// Same render as the change: not checked yet.
		expect(result.current.checked).toBe(false);
		await settle();
		expect(result.current.checked).toBe(true);
		expect(check).toHaveBeenLastCalledWith('eule_mika_2');
	});

	it('asks again for a User-ID that was changed and then restored', async () => {
		const check = vi.fn(() => Promise.resolve(true));
		const { result, rerender } = renderHook(
			({ name }) => useUsernameAvailability(name, true, check),
			{ initialProps: { name: 'eule_mika' } }
		);
		await settle();
		expect(result.current.checked).toBe(true);
		rerender({ name: 'eule_mika_2' });
		rerender({ name: 'eule_mika' });
		// The old answer may be stale by now: not checked until asked again.
		expect(result.current.checked).toBe(false);
		await settle();
		expect(result.current.checked).toBe(true);
		expect(check).toHaveBeenCalledTimes(2);
	});

	it('marks a failed check as unknown, not as taken', async () => {
		const check = vi.fn(() => Promise.reject(new Error('503')));
		const { result } = renderHook(() =>
			useUsernameAvailability('eule_mika', true, check)
		);
		await settle();
		expect(result.current).toEqual({
			isAvailable: true,
			checked: false,
			failed: true
		});
	});

	it('does not ask for a User-ID the local rule rejects', async () => {
		const check = vi.fn(() => Promise.resolve(true));
		const { result } = renderHook(() =>
			useUsernameAvailability('eu', false, check)
		);
		await settle();
		expect(check).not.toHaveBeenCalled();
		expect(result.current.checked).toBe(false);
	});
});
