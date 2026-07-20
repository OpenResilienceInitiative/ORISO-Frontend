// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	useLiveChatAvailable,
	useLiveChatAvailabilityHeartbeat
} from './liveChatToggle';
import {
	apiGetLiveChatAvailability,
	apiHeartbeatLiveChatAvailability,
	apiSetLiveChatAvailability
} from '../api/apiSetLiveChatAvailability';

vi.mock('../api/apiSetLiveChatAvailability', () => ({
	apiGetLiveChatAvailability: vi.fn(),
	apiHeartbeatLiveChatAvailability: vi.fn(),
	apiSetLiveChatAvailability: vi.fn()
}));

describe('live-chat availability state', () => {
	beforeEach(() => {
		localStorage.clear();
		vi.mocked(apiGetLiveChatAvailability).mockResolvedValue(false);
		vi.mocked(apiSetLiveChatAvailability).mockResolvedValue(undefined);
		vi.mocked(apiHeartbeatLiveChatAvailability).mockResolvedValue(true);
	});

	afterEach(() => {
		vi.clearAllMocks();
		vi.useRealTimers();
	});

	it('does not display stale local availability when the backend says false', async () => {
		localStorage.setItem('caritas_liveChatAvailability', '1');

		const { result } = renderHook(() => useLiveChatAvailable());

		await waitFor(() =>
			expect(apiGetLiveChatAvailability).toHaveBeenCalled()
		);
		expect(result.current[0]).toBe(false);
	});

	it('commits availability only after the backend acknowledges it', async () => {
		const { result } = renderHook(() => useLiveChatAvailable());
		await waitFor(() =>
			expect(apiGetLiveChatAvailability).toHaveBeenCalled()
		);

		await act(async () => result.current[1](true));

		expect(result.current[0]).toBe(true);
		expect(localStorage.getItem('caritas_liveChatAvailability')).toBe('1');
	});

	it('keeps the previous state and preference when enabling is rejected', async () => {
		vi.mocked(apiSetLiveChatAvailability).mockRejectedValueOnce(
			new Error('redis unavailable')
		);
		const { result } = renderHook(() => useLiveChatAvailable());
		await waitFor(() =>
			expect(apiGetLiveChatAvailability).toHaveBeenCalled()
		);

		await expect(act(async () => result.current[1](true))).rejects.toThrow(
			'redis unavailable'
		);

		expect(result.current[0]).toBe(false);
		expect(localStorage.getItem('caritas_liveChatAvailability')).toBeNull();
	});

	it('reconciles only relevant cross-tab preference changes with the backend', async () => {
		const { result } = renderHook(() => useLiveChatAvailable());
		await waitFor(() => expect(result.current[2].loading).toBe(false));
		vi.mocked(apiGetLiveChatAvailability).mockClear();

		window.dispatchEvent(new StorageEvent('storage', { key: 'unrelated' }));
		expect(apiGetLiveChatAvailability).not.toHaveBeenCalled();

		vi.mocked(apiGetLiveChatAvailability).mockResolvedValue(true);
		act(() => {
			window.dispatchEvent(
				new StorageEvent('storage', {
					key: 'caritas_liveChatAvailability',
					newValue: '1'
				})
			);
		});
		await waitFor(() => expect(result.current[0]).toBe(true));
	});

	it('does not let a stale GET overwrite an acknowledged toggle', async () => {
		let resolveGet: (available: boolean) => void = () => undefined;
		vi.mocked(apiGetLiveChatAvailability).mockReturnValueOnce(
			new Promise((resolve) => {
				resolveGet = resolve;
			})
		);
		const { result } = renderHook(() => useLiveChatAvailable());

		await act(async () => result.current[1](true));
		await act(async () => resolveGet(false));

		expect(result.current[0]).toBe(true);
		expect(localStorage.getItem('caritas_liveChatAvailability')).toBe('1');
	});

	it('heartbeats while active and stops after unmount', async () => {
		vi.useFakeTimers();
		const { unmount } = renderHook(() =>
			useLiveChatAvailabilityHeartbeat(true, true)
		);

		await act(async () => vi.advanceTimersByTimeAsync(45_000));
		expect(apiHeartbeatLiveChatAvailability).toHaveBeenCalledTimes(1);

		unmount();
		await act(async () => vi.advanceTimersByTimeAsync(90_000));
		expect(apiHeartbeatLiveChatAvailability).toHaveBeenCalledTimes(1);
	});

	it('does not heartbeat when the acknowledged state is inactive', async () => {
		vi.useFakeTimers();
		renderHook(() => useLiveChatAvailabilityHeartbeat(true, false));

		await act(async () => vi.advanceTimersByTimeAsync(90_000));
		expect(apiHeartbeatLiveChatAvailability).not.toHaveBeenCalled();
	});

	it('stops heartbeating immediately when acknowledged state becomes inactive', async () => {
		vi.useFakeTimers();
		const { rerender } = renderHook(
			({ active }) => useLiveChatAvailabilityHeartbeat(true, active),
			{ initialProps: { active: true } }
		);
		await act(async () => vi.advanceTimersByTimeAsync(45_000));
		expect(apiHeartbeatLiveChatAvailability).toHaveBeenCalledTimes(1);

		rerender({ active: false });
		await act(async () => vi.advanceTimersByTimeAsync(90_000));
		expect(apiHeartbeatLiveChatAvailability).toHaveBeenCalledTimes(1);
	});

	it('deactivates all consumers when the backend reports an expired heartbeat lease', async () => {
		vi.useFakeTimers();
		vi.mocked(apiGetLiveChatAvailability).mockResolvedValue(true);
		vi.mocked(apiHeartbeatLiveChatAvailability).mockResolvedValue(false);
		const { result } = renderHook(() => {
			const availability = useLiveChatAvailable();
			useLiveChatAvailabilityHeartbeat(true, availability[0]);
			return availability;
		});
		await act(async () => Promise.resolve());
		expect(result.current[0]).toBe(true);

		await act(async () => vi.advanceTimersByTimeAsync(45_000));

		expect(result.current[0]).toBe(false);
		expect(localStorage.getItem('caritas_liveChatAvailability')).toBeNull();
	});
});
