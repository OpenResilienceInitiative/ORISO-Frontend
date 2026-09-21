// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
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
		// Unmount every consumer, so none of them answers the next test's
		// storage events.
		cleanup();
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

	// #1485 review: two consumers reconcile at once; the loss one of them
	// persists must invalidate the other's older, still-pending "true".
	it('does not let an older reconcile revive a consumer after another one recorded the loss', async () => {
		localStorage.setItem('oriso_liveChatAvailability', '1');
		const pendingGets: Array<(available: boolean) => void> = [];
		vi.mocked(apiGetLiveChatAvailability).mockImplementation(
			() =>
				new Promise((resolve) => {
					pendingGets.push(resolve);
				})
		);
		const { result } = renderHook(() => ({
			navigation: useLiveChatAvailable(),
			sessionsList: useLiveChatAvailable()
		}));
		expect(pendingGets).toHaveLength(2);

		await act(async () => pendingGets[0](false));
		expect(pendingGets).toHaveLength(2);
		await act(async () => pendingGets[1](true));

		expect(result.current.navigation[0]).toBe(false);
		expect(result.current.sessionsList[0]).toBe(false);
		expect(localStorage.getItem('oriso_liveChatAvailability')).toBeNull();
	});

	// #1485 review: the loss is recorded in one tab; every other tab of the
	// same counsellor has to say why it went off too.
	it('records why it switched off so other tabs can tell the counsellor', async () => {
		vi.useFakeTimers();
		vi.mocked(apiGetLiveChatAvailability).mockResolvedValue(true);
		vi.mocked(apiHeartbeatLiveChatAvailability).mockRejectedValue(
			new Error('FORBIDDEN')
		);
		renderHook(() => {
			const availability = useLiveChatAvailable();
			useLiveChatAvailabilityHeartbeat(true, availability[0]);
			return availability;
		});
		await act(async () => Promise.resolve());

		await act(async () => vi.advanceTimersByTimeAsync(45_000));

		expect(
			JSON.parse(
				localStorage.getItem('oriso_liveChatAvailabilityLoss') ?? '{}'
			)
		).toEqual(expect.objectContaining({ reason: 'refused' }));
	});

	it('shows the reason another tab recorded when it switched off', async () => {
		vi.mocked(apiGetLiveChatAvailability).mockResolvedValue(true);
		localStorage.setItem('oriso_liveChatAvailability', '1');
		const { result } = renderHook(() => useLiveChatAvailable());
		await waitFor(() => expect(result.current[0]).toBe(true));
		vi.mocked(apiGetLiveChatAvailability).mockResolvedValue(false);

		// What the other tab's write looks like from here.
		const loss = JSON.stringify({ reason: 'refused', at: Date.now() });
		localStorage.setItem('oriso_liveChatAvailabilityLoss', loss);
		localStorage.removeItem('oriso_liveChatAvailability');
		act(() => {
			window.dispatchEvent(
				new StorageEvent('storage', {
					key: 'oriso_liveChatAvailabilityLoss',
					newValue: loss
				})
			);
			window.dispatchEvent(
				new StorageEvent('storage', {
					key: 'oriso_liveChatAvailability',
					oldValue: '1',
					newValue: null
				})
			);
		});

		await waitFor(() => expect(result.current[0]).toBe(false));
		expect(result.current[2].lostReason).toBe('refused');
	});

	it('withdraws the reason when another tab switches live chat on again', async () => {
		const { result } = renderHook(() => useLiveChatAvailable());
		await waitFor(() => expect(result.current[2].loading).toBe(false));
		act(() => {
			window.dispatchEvent(
				new StorageEvent('storage', {
					key: 'oriso_liveChatAvailabilityLoss',
					newValue: JSON.stringify({ reason: 'leaseLost', at: 1 })
				})
			);
		});
		expect(result.current[2].lostReason).toBe('leaseLost');

		act(() => {
			window.dispatchEvent(
				new StorageEvent('storage', {
					key: 'oriso_liveChatAvailabilityLoss',
					newValue: null
				})
			);
		});

		expect(result.current[2].lostReason).toBeNull();
	});

	it('clears the recorded reason once the counsellor switches on again', async () => {
		localStorage.setItem(
			'oriso_liveChatAvailabilityLoss',
			JSON.stringify({ reason: 'refused', at: 1 })
		);
		const { result } = renderHook(() => useLiveChatAvailable());
		await waitFor(() => expect(result.current[2].loading).toBe(false));

		await act(async () => result.current[1](true));

		expect(
			localStorage.getItem('oriso_liveChatAvailabilityLoss')
		).toBeNull();
	});

	it('does not resurface an old recorded reason on a later load', async () => {
		localStorage.setItem(
			'oriso_liveChatAvailabilityLoss',
			JSON.stringify({ reason: 'refused', at: 1 })
		);

		const { result } = renderHook(() => useLiveChatAvailable());
		await waitFor(() => expect(result.current[2].loading).toBe(false));

		expect(result.current[2].lostReason).toBeNull();
	});

	// #1485 review: tab B's check was sent before tab A switched on; its late
	// "no" must not remove A's fresh preference or raise a loss notice.
	it('discards a check sent before another tab switched live chat on', async () => {
		const pendingGets: Array<(available: boolean) => void> = [];
		vi.mocked(apiGetLiveChatAvailability).mockImplementation(
			() =>
				new Promise((resolve) => {
					pendingGets.push(resolve);
				})
		);
		const { result } = renderHook(() => useLiveChatAvailable());
		expect(pendingGets).toHaveLength(1);

		localStorage.setItem('oriso_liveChatAvailability', '1');
		act(() => {
			window.dispatchEvent(
				new StorageEvent('storage', {
					key: 'oriso_liveChatAvailability',
					newValue: '1'
				})
			);
		});
		await act(async () => pendingGets[0](false));

		expect(localStorage.getItem('oriso_liveChatAvailability')).toBe('1');
		expect(result.current[2].lostReason).toBeNull();

		expect(pendingGets).toHaveLength(2);
		await act(async () => pendingGets[1](true));
		expect(result.current[0]).toBe(true);
	});

	it('lets every consumer in the tab follow a change another tab made', async () => {
		const pendingGets: Array<(available: boolean) => void> = [];
		vi.mocked(apiGetLiveChatAvailability).mockImplementation(
			() =>
				new Promise((resolve) => {
					pendingGets.push(resolve);
				})
		);
		const { result } = renderHook(() => ({
			navigation: useLiveChatAvailable(),
			sessionsList: useLiveChatAvailable()
		}));
		await act(async () => pendingGets.splice(0).forEach((r) => r(false)));

		localStorage.setItem('oriso_liveChatAvailability', '1');
		act(() => {
			window.dispatchEvent(
				new StorageEvent('storage', {
					key: 'oriso_liveChatAvailability',
					newValue: '1'
				})
			);
		});
		await act(async () => pendingGets.splice(0).forEach((r) => r(true)));

		expect(result.current.navigation[0]).toBe(true);
		expect(result.current.sessionsList[0]).toBe(true);
	});

	// #1485 review: the server counts the consultant as long as any of her
	// tabs renews the lease, so one offline tab must not switch all off.
	it('stays live while another tab keeps the lease acknowledged', async () => {
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

		await act(async () => vi.advanceTimersByTimeAsync(100_000));
		// The other tab's heartbeat was acknowledged just now.
		localStorage.setItem(
			'oriso_liveChatAvailabilityAck',
			String(Date.now())
		);

		await act(async () => vi.advanceTimersByTimeAsync(119_000));
		expect(result.current[0]).toBe(true);
		expect(localStorage.getItem('oriso_liveChatAvailability')).toBe('1');

		// Nothing acknowledged anywhere for a whole lease: now it is gone.
		await act(async () => vi.advanceTimersByTimeAsync(1_000));
		expect(result.current[0]).toBe(false);
		expect(result.current[2].lostReason).toBe('connectionLost');
	});

	it('shares when its own heartbeat was last acknowledged', async () => {
		vi.useFakeTimers();
		renderHook(() => useLiveChatAvailabilityHeartbeat(true, true));

		await act(async () => vi.advanceTimersByTimeAsync(45_000));

		expect(localStorage.getItem('oriso_liveChatAvailabilityAck')).toBe(
			String(Date.now())
		);
	});

	it('does not raise a loss notice on load when nothing claimed "live"', async () => {
		const { result } = renderHook(() => useLiveChatAvailable());
		await waitFor(() => expect(result.current[2].loading).toBe(false));

		expect(result.current[0]).toBe(false);
		expect(result.current[2].lostReason).toBeNull();
	});
});
