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
		localStorage.setItem('oriso_liveChatAvailability', '1');

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
		expect(localStorage.getItem('oriso_liveChatAvailability')).toBe('1');
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
		expect(localStorage.getItem('oriso_liveChatAvailability')).toBeNull();
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
					key: 'oriso_liveChatAvailability',
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
		expect(localStorage.getItem('oriso_liveChatAvailability')).toBe('1');
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
		expect(localStorage.getItem('oriso_liveChatAvailability')).toBeNull();
	});

	it('ignores a stale heartbeat result after a newly acknowledged enable', async () => {
		vi.useFakeTimers();
		vi.mocked(apiGetLiveChatAvailability).mockResolvedValue(true);
		let resolveHeartbeat: (available: boolean) => void = () => undefined;
		vi.mocked(apiHeartbeatLiveChatAvailability).mockReturnValueOnce(
			new Promise((resolve) => {
				resolveHeartbeat = resolve;
			})
		);
		const { result } = renderHook(() => {
			const availability = useLiveChatAvailable();
			useLiveChatAvailabilityHeartbeat(true, availability[0]);
			return availability;
		});
		await act(async () => Promise.resolve());
		await act(async () => vi.advanceTimersByTimeAsync(45_000));

		await act(async () => result.current[1](true));
		await act(async () => resolveHeartbeat(false));

		expect(result.current[0]).toBe(true);
		expect(localStorage.getItem('oriso_liveChatAvailability')).toBe('1');
	});

	// #1485: seen on Dev — every heartbeat answered 403 while the switch still
	// said "live" and localStorage still held the preference.
	it.each(['FORBIDDEN', 'UNAUTHORIZED'])(
		'turns the switch off and drops the preference when the heartbeat is refused (%s)',
		async (refusal) => {
			vi.useFakeTimers();
			localStorage.setItem('oriso_liveChatAvailability', '1');
			vi.mocked(apiGetLiveChatAvailability).mockResolvedValue(true);
			vi.mocked(apiHeartbeatLiveChatAvailability).mockRejectedValue(
				new Error(refusal)
			);
			const { result } = renderHook(() => {
				const availability = useLiveChatAvailable();
				useLiveChatAvailabilityHeartbeat(true, availability[0]);
				return availability;
			});
			await act(async () => Promise.resolve());
			expect(result.current[0]).toBe(true);

			await act(async () => vi.advanceTimersByTimeAsync(45_000));

			expect(result.current[0]).toBe(false);
			expect(
				localStorage.getItem('oriso_liveChatAvailability')
			).toBeNull();
		}
	);

	// #1485: the counsellor has to learn why she is no longer live.
	it.each([
		['FORBIDDEN', 'refused'],
		['UNAUTHORIZED', 'sessionExpired']
	])(
		'names why the switch went off when the heartbeat is refused (%s)',
		async (refusal, reason) => {
			vi.useFakeTimers();
			vi.mocked(apiGetLiveChatAvailability).mockResolvedValue(true);
			vi.mocked(apiHeartbeatLiveChatAvailability).mockRejectedValue(
				new Error(refusal)
			);
			const { result } = renderHook(() => {
				const availability = useLiveChatAvailable();
				useLiveChatAvailabilityHeartbeat(true, availability[0]);
				return availability;
			});
			await act(async () => Promise.resolve());

			await act(async () => vi.advanceTimersByTimeAsync(45_000));

			expect(result.current[2].lostReason).toBe(reason);
		}
	);

	it('names an expired lease and lets the counsellor switch on again without a reload', async () => {
		vi.useFakeTimers();
		vi.mocked(apiGetLiveChatAvailability).mockResolvedValue(true);
		vi.mocked(apiHeartbeatLiveChatAvailability).mockResolvedValueOnce(
			false
		);
		const { result } = renderHook(() => {
			const availability = useLiveChatAvailable();
			useLiveChatAvailabilityHeartbeat(true, availability[0]);
			return availability;
		});
		await act(async () => Promise.resolve());
		await act(async () => vi.advanceTimersByTimeAsync(45_000));
		expect(result.current[0]).toBe(false);
		expect(result.current[2].lostReason).toBe('leaseLost');

		await act(async () => result.current[1](true));

		expect(result.current[0]).toBe(true);
		expect(result.current[2].lostReason).toBeNull();
		expect(localStorage.getItem('oriso_liveChatAvailability')).toBe('1');
	});

	// #1485: a dropped connection is not a refusal. The lease lives 120 s and
	// the heartbeat runs every 45 s, so one lost beat must not switch anyone off.
	it.each([
		['a 5xx', new Error('CATCH_ALL')],
		['a timeout', new Error('TIMEOUT')],
		['no response', new TypeError('Failed to fetch')]
	])(
		'stays live and retries quietly after %s on one heartbeat',
		async (_label, failure) => {
			vi.useFakeTimers();
			localStorage.setItem('oriso_liveChatAvailability', '1');
			vi.mocked(apiGetLiveChatAvailability).mockResolvedValue(true);
			vi.mocked(apiHeartbeatLiveChatAvailability)
				.mockRejectedValueOnce(failure)
				.mockResolvedValue(true);
			const { result } = renderHook(() => {
				const availability = useLiveChatAvailable();
				useLiveChatAvailabilityHeartbeat(true, availability[0]);
				return availability;
			});
			await act(async () => Promise.resolve());

			await act(async () => vi.advanceTimersByTimeAsync(45_000));
			expect(result.current[0]).toBe(true);
			expect(result.current[2].lostReason).toBeNull();
			expect(localStorage.getItem('oriso_liveChatAvailability')).toBe(
				'1'
			);

			await act(async () => vi.advanceTimersByTimeAsync(45_000));
			expect(apiHeartbeatLiveChatAvailability).toHaveBeenCalledTimes(2);
			expect(result.current[0]).toBe(true);

			// Acknowledged again at 90 s, so the lease is good well past 120 s.
			await act(async () => vi.advanceTimersByTimeAsync(60_000));
			expect(result.current[0]).toBe(true);
		}
	);

	it('stops claiming live once no heartbeat was acknowledged for longer than the lease', async () => {
		vi.useFakeTimers();
		localStorage.setItem('oriso_liveChatAvailability', '1');
		vi.mocked(apiGetLiveChatAvailability).mockResolvedValue(true);
		vi.mocked(apiHeartbeatLiveChatAvailability).mockRejectedValue(
			new TypeError('Failed to fetch')
		);
		const { result } = renderHook(() => {
			const availability = useLiveChatAvailable();
			useLiveChatAvailabilityHeartbeat(true, availability[0]);
			return availability;
		});
		await act(async () => Promise.resolve());

		await act(async () => vi.advanceTimersByTimeAsync(119_000));
		expect(apiHeartbeatLiveChatAvailability).toHaveBeenCalledTimes(2);
		expect(result.current[0]).toBe(true);

		await act(async () => vi.advanceTimersByTimeAsync(1_000));

		expect(result.current[0]).toBe(false);
		expect(result.current[2].lostReason).toBe('connectionLost');
		expect(localStorage.getItem('oriso_liveChatAvailability')).toBeNull();
	});

	// #1485: the stored preference must never outlive the lease it claims.
	it('drops a stored "live" preference on load when the backend does not count the consultant', async () => {
		localStorage.setItem('oriso_liveChatAvailability', '1');

		const { result } = renderHook(() => useLiveChatAvailable());
		await waitFor(() => expect(result.current[2].loading).toBe(false));

		expect(result.current[0]).toBe(false);
		expect(localStorage.getItem('oriso_liveChatAvailability')).toBeNull();
		expect(result.current[2].lostReason).toBe('leaseLost');
	});

	it('does not raise a loss notice on load when nothing claimed "live"', async () => {
		const { result } = renderHook(() => useLiveChatAvailable());
		await waitFor(() => expect(result.current[2].loading).toBe(false));

		expect(result.current[0]).toBe(false);
		expect(result.current[2].lostReason).toBeNull();
	});
});
