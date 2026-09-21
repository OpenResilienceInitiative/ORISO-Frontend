// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	useLiveChatAvailable,
	useLiveChatAvailabilityHeartbeat
} from './liveChatToggle';
import { clearLiveChatAvailabilityPreference } from './liveChatAvailabilityStorage';
import {
	apiGetLiveChatAvailability,
	apiHeartbeatLiveChatAvailability,
	apiSetLiveChatAvailability
} from '../api/apiSetLiveChatAvailability';

vi.mock('../api/apiSetLiveChatAvailability', () => ({
	LIVE_CHAT_HEARTBEAT_TIMEOUT_MS: 5_000,
	apiGetLiveChatAvailability: vi.fn(),
	apiHeartbeatLiveChatAvailability: vi.fn(),
	apiSetLiveChatAvailability: vi.fn()
}));

type Settle = {
	resolve: (available: boolean) => void;
	reject: (message: string) => void;
};
/** The next heartbeat stays pending until the test settles it. */
const pendingHeartbeat = (): Settle => {
	const settle: Settle = {
		resolve: () => undefined,
		reject: () => undefined
	};
	vi.mocked(apiHeartbeatLiveChatAvailability).mockReturnValueOnce(
		new Promise((resolve, reject) => {
			settle.resolve = resolve;
			settle.reject = (message) => reject(new Error(message));
		})
	);
	return settle;
};

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

		// One beat at once, then one per interval.
		await act(async () => vi.advanceTimersByTimeAsync(45_000));
		expect(apiHeartbeatLiveChatAvailability).toHaveBeenCalledTimes(2);

		unmount();
		await act(async () => vi.advanceTimersByTimeAsync(90_000));
		expect(apiHeartbeatLiveChatAvailability).toHaveBeenCalledTimes(2);
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
		expect(apiHeartbeatLiveChatAvailability).toHaveBeenCalledTimes(2);

		rerender({ active: false });
		await act(async () => vi.advanceTimersByTimeAsync(90_000));
		expect(apiHeartbeatLiveChatAvailability).toHaveBeenCalledTimes(2);
	});

	it('deactivates all consumers when the backend reports an expired heartbeat lease', async () => {
		vi.useFakeTimers();
		vi.mocked(apiGetLiveChatAvailability).mockResolvedValue(true);
		vi.mocked(apiHeartbeatLiveChatAvailability)
			.mockResolvedValueOnce(true)
			.mockResolvedValue(false);
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
			vi.mocked(apiHeartbeatLiveChatAvailability)
				.mockResolvedValueOnce(true)
				.mockRejectedValue(new Error(refusal));
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
				.mockResolvedValueOnce(true)
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
			expect(apiHeartbeatLiveChatAvailability).toHaveBeenCalledTimes(3);
			expect(result.current[0]).toBe(true);

			// Acknowledged again at 90 s, so the lease is good well past 120 s.
			await act(async () => vi.advanceTimersByTimeAsync(60_000));
			expect(result.current[0]).toBe(true);
		}
	);

	// Drops come a lease plus one request timeout (5 s) after the last
	// acknowledgement: a renewal still in flight in any tab may keep it.
	it('stops claiming live once no heartbeat was acknowledged for longer than the lease', async () => {
		vi.useFakeTimers();
		// Acknowledged just now (an enable or a beat): the lease is known.
		localStorage.setItem(
			'oriso_liveChatAvailabilityAck',
			String(Date.now())
		);
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
		expect(apiHeartbeatLiveChatAvailability).toHaveBeenCalledTimes(3);
		expect(result.current[0]).toBe(true);

		await act(async () => vi.advanceTimersByTimeAsync(6_000));

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
		// Acknowledged just now (an enable or a beat): the lease is known.
		localStorage.setItem(
			'oriso_liveChatAvailabilityAck',
			String(Date.now())
		);
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
		await act(async () => vi.advanceTimersByTimeAsync(6_000));
		expect(result.current[0]).toBe(false);
		expect(result.current[2].lostReason).toBe('connectionLost');
	});

	it('shares when its own heartbeat was last acknowledged', async () => {
		vi.useFakeTimers();
		renderHook(() => useLiveChatAvailabilityHeartbeat(true, true));

		await act(async () => vi.advanceTimersByTimeAsync(45_000));

		// When the renewal was sent (the lease is counted from there) and when
		// it was answered; both are now under fake timers.
		expect(
			JSON.parse(
				localStorage.getItem('oriso_liveChatAvailabilityAck') ?? '{}'
			)
		).toEqual({ sentAt: Date.now(), ackedAt: Date.now() });
	});

	// #1485 review: after a reload the availability GET only reads whether a
	// lease exists; it does not renew it. The lease ends a lease after the last
	// acknowledged heartbeat, not a lease after the page loaded.
	it('checks the lease at once when it becomes active', async () => {
		vi.useFakeTimers();
		renderHook(() => useLiveChatAvailabilityHeartbeat(true, true));

		await act(async () => vi.advanceTimersByTimeAsync(0));

		expect(apiHeartbeatLiveChatAvailability).toHaveBeenCalledTimes(1);
	});

	it('stops claiming live a lease after the last acknowledgement, not after the reload', async () => {
		vi.useFakeTimers();
		localStorage.setItem('oriso_liveChatAvailability', '1');
		// Acknowledged 100 s before this page loaded.
		localStorage.setItem(
			'oriso_liveChatAvailabilityAck',
			String(Date.now() - 100_000)
		);
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
		expect(result.current[0]).toBe(true);

		await act(async () => vi.advanceTimersByTimeAsync(25_000));

		expect(result.current[0]).toBe(false);
		expect(result.current[2].lostReason).toBe('connectionLost');
	});

	it('keeps a reloaded tab live when its first heartbeat renews the lease', async () => {
		vi.useFakeTimers();
		localStorage.setItem('oriso_liveChatAvailability', '1');
		localStorage.setItem(
			'oriso_liveChatAvailabilityAck',
			String(Date.now() - 100_000)
		);
		vi.mocked(apiGetLiveChatAvailability).mockResolvedValue(true);
		const { result } = renderHook(() => {
			const availability = useLiveChatAvailable();
			useLiveChatAvailabilityHeartbeat(true, availability[0]);
			return availability;
		});
		await act(async () => Promise.resolve());

		await act(async () => vi.advanceTimersByTimeAsync(119_000));

		expect(result.current[0]).toBe(true);
		expect(result.current[2].lostReason).toBeNull();
	});

	it('does not let an old acknowledgement switch off a fresh enable', async () => {
		vi.useFakeTimers();
		localStorage.setItem(
			'oriso_liveChatAvailabilityAck',
			String(Date.now() - 3_600_000)
		);
		vi.mocked(apiHeartbeatLiveChatAvailability).mockRejectedValue(
			new TypeError('Failed to fetch')
		);
		const { result } = renderHook(() => {
			const availability = useLiveChatAvailable();
			useLiveChatAvailabilityHeartbeat(true, availability[0]);
			return availability;
		});
		await act(async () => Promise.resolve());

		await act(async () => result.current[1](true));
		await act(async () => vi.advanceTimersByTimeAsync(60_000));

		expect(result.current[0]).toBe(true);
		expect(result.current[2].lostReason).toBeNull();
	});

	// #1485 review: tab B switched on again while this tab's heartbeat was
	// in flight. Its answer describes the lease before B's enable, and B's
	// storage event may not have arrived yet, so the tab-local revision
	// cannot tell; the shared acknowledgement time can.
	it.each([
		['"no lease"', () => Promise.resolve(false)],
		['a refusal', () => Promise.reject(new Error('FORBIDDEN'))]
	])(
		'discards %s sent before another tab switched live chat on again',
		async (_label, staleAnswer) => {
			vi.useFakeTimers();
			localStorage.setItem('oriso_liveChatAvailability', '1');
			vi.mocked(apiGetLiveChatAvailability).mockResolvedValue(true);
			let answer: () => void = () => undefined;
			vi.mocked(apiHeartbeatLiveChatAvailability).mockReturnValueOnce(
				new Promise((resolve, reject) => {
					answer = () => void staleAnswer().then(resolve, reject);
				})
			);
			const { result } = renderHook(() => {
				const availability = useLiveChatAvailable();
				useLiveChatAvailabilityHeartbeat(true, availability[0]);
				return availability;
			});
			await act(async () => Promise.resolve());
			expect(apiHeartbeatLiveChatAvailability).toHaveBeenCalledTimes(1);

			// Tab B's acknowledged enable, before its storage event arrives.
			await act(async () => vi.advanceTimersByTimeAsync(1_000));
			localStorage.setItem(
				'oriso_liveChatAvailabilityAck',
				String(Date.now())
			);
			await act(async () => answer());

			expect(localStorage.getItem('oriso_liveChatAvailability')).toBe(
				'1'
			);
			expect(result.current[0]).toBe(true);
			expect(result.current[2].lostReason).toBeNull();
		}
	);

	// #1485 review: with no acknowledgement on record (first load after this
	// ships, or one older than a lease) the GET only says a lease exists, not
	// how long it has left. A failed first renewal must not buy a full lease.
	const mountWithUnknownLease = () => {
		localStorage.setItem('oriso_liveChatAvailability', '1');
		vi.mocked(apiGetLiveChatAvailability).mockResolvedValue(true);
		return renderHook(() => {
			const availability = useLiveChatAvailable();
			useLiveChatAvailabilityHeartbeat(true, availability[0]);
			return availability;
		});
	};

	it('stops claiming live soon when the lease is unknown and renewing it fails', async () => {
		vi.useFakeTimers();
		vi.mocked(apiHeartbeatLiveChatAvailability).mockRejectedValue(
			new Error('TIMEOUT')
		);
		const { result } = mountWithUnknownLease();
		await act(async () => Promise.resolve());
		expect(result.current[0]).toBe(true);

		await act(async () => vi.advanceTimersByTimeAsync(15_000));

		// The immediate beat and one quick retry, then it gives up.
		expect(apiHeartbeatLiveChatAvailability).toHaveBeenCalledTimes(2);
		expect(result.current[0]).toBe(false);
		expect(result.current[2].lostReason).toBe('connectionLost');
	});

	it('stays live when the quick retry renews an unknown lease', async () => {
		vi.useFakeTimers();
		vi.mocked(apiHeartbeatLiveChatAvailability)
			.mockRejectedValueOnce(new Error('TIMEOUT'))
			.mockResolvedValue(true);
		const { result } = mountWithUnknownLease();
		await act(async () => Promise.resolve());

		await act(async () => vi.advanceTimersByTimeAsync(119_000));

		expect(result.current[0]).toBe(true);
		expect(result.current[2].lostReason).toBeNull();
	});

	it('stays live on an unknown lease when another tab renews it meanwhile', async () => {
		vi.useFakeTimers();
		vi.mocked(apiHeartbeatLiveChatAvailability).mockRejectedValue(
			new Error('TIMEOUT')
		);
		const { result } = mountWithUnknownLease();
		await act(async () => Promise.resolve());

		await act(async () => vi.advanceTimersByTimeAsync(3_000));
		localStorage.setItem(
			'oriso_liveChatAvailabilityAck',
			String(Date.now())
		);
		await act(async () => vi.advanceTimersByTimeAsync(60_000));

		expect(result.current[0]).toBe(true);
		expect(result.current[2].lostReason).toBeNull();
	});

	// #1485 review: a renewal still in flight when the watchdog is due may be
	// the one that keeps the lease; its answer decides, within its timeout.
	it('waits for a first beat still pending when the unknown-lease window closes', async () => {
		vi.useFakeTimers();
		vi.mocked(apiHeartbeatLiveChatAvailability).mockReturnValueOnce(
			new Promise((resolve) => setTimeout(() => resolve(true), 13_000))
		);
		const { result } = mountWithUnknownLease();
		await act(async () => Promise.resolve());

		await act(async () => vi.advanceTimersByTimeAsync(30_000));

		expect(result.current[0]).toBe(true);
		expect(result.current[2].lostReason).toBeNull();
		expect(localStorage.getItem('oriso_liveChatAvailability')).toBe('1');
	});

	it('keeps its own renewal that answers just after the known lease ran out', async () => {
		vi.useFakeTimers();
		localStorage.setItem(
			'oriso_liveChatAvailabilityAck',
			String(Date.now() - 118_000)
		);
		vi.mocked(apiHeartbeatLiveChatAvailability).mockReturnValueOnce(
			new Promise((resolve) => setTimeout(() => resolve(true), 3_000))
		);
		const { result } = mountWithUnknownLease();
		await act(async () => Promise.resolve());

		await act(async () => vi.advanceTimersByTimeAsync(10_000));

		expect(result.current[0]).toBe(true);
		expect(result.current[2].lostReason).toBeNull();
	});

	it('does not wait for a pending beat longer than its request timeout', async () => {
		vi.useFakeTimers();
		vi.mocked(apiHeartbeatLiveChatAvailability).mockReturnValue(
			new Promise(() => undefined)
		);
		const { result } = mountWithUnknownLease();
		await act(async () => Promise.resolve());

		await act(async () => vi.advanceTimersByTimeAsync(20_000));

		expect(result.current[0]).toBe(false);
		expect(result.current[2].lostReason).toBe('connectionLost');
	});

	// #1485 review: logout unmounts the navigation shell while a beat may be
	// in flight. Its late answer belongs to a session that is gone.
	it('aborts a pending heartbeat when the shell unmounts', async () => {
		vi.useFakeTimers();
		const { unmount } = renderHook(() =>
			useLiveChatAvailabilityHeartbeat(true, true)
		);
		const [signal] = vi.mocked(apiHeartbeatLiveChatAvailability).mock
			.calls[0] as unknown as [AbortSignal];

		unmount();

		expect(signal).toBeInstanceOf(AbortSignal);
		expect(signal.aborted).toBe(true);
	});

	// #1485 review: fetchData adds an abort listener to the signal it is given
	// and never removes it, so one signal shared by every beat would collect
	// a listener every 45 s.
	it('gives every heartbeat its own abort signal', async () => {
		vi.useFakeTimers();
		renderHook(() => useLiveChatAvailabilityHeartbeat(true, true));

		await act(async () => vi.advanceTimersByTimeAsync(90_000));

		const signals = vi
			.mocked(apiHeartbeatLiveChatAvailability)
			.mock.calls.map(([signal]) => signal);
		expect(signals).toHaveLength(3);
		expect(new Set(signals).size).toBe(3);
	});

	it.each([
		['a late success', (settle: Settle) => settle.resolve(true)],
		['a late "no lease"', (settle: Settle) => settle.resolve(false)],
		['a late refusal', (settle: Settle) => settle.reject('FORBIDDEN')]
	])('ignores %s that arrives after logout', async (_label, answer) => {
		vi.useFakeTimers();
		localStorage.setItem('oriso_liveChatAvailability', '1');
		const settle = pendingHeartbeat();
		const { unmount } = renderHook(() =>
			useLiveChatAvailabilityHeartbeat(true, true)
		);

		unmount();
		clearLiveChatAvailabilityPreference();
		await act(async () => answer(settle));
		await act(async () => vi.advanceTimersByTimeAsync(200_000));

		expect(
			localStorage.getItem('oriso_liveChatAvailabilityAck')
		).toBeNull();
		expect(
			localStorage.getItem('oriso_liveChatAvailabilityLoss')
		).toBeNull();
	});

	it('gives the next consultant only the unknown-lease window after a logout mid-beat', async () => {
		vi.useFakeTimers();
		localStorage.setItem('oriso_liveChatAvailability', '1');
		const settle = pendingHeartbeat();
		const first = renderHook(() =>
			useLiveChatAvailabilityHeartbeat(true, true)
		);
		first.unmount();
		clearLiveChatAvailabilityPreference();
		await act(async () => settle.resolve(true));

		// The next consultant signs in; the server holds a lease of unknown age.
		vi.mocked(apiHeartbeatLiveChatAvailability).mockRejectedValue(
			new Error('TIMEOUT')
		);
		const { result } = mountWithUnknownLease();
		await act(async () => Promise.resolve());
		await act(async () => vi.advanceTimersByTimeAsync(15_000));

		expect(result.current[0]).toBe(false);
		expect(result.current[2].lostReason).toBe('connectionLost');
	});

	// #1485 review: the rail toggle and the profile switch can both submit
	// "on". The second acknowledged enable bumps the revision without
	// restarting the heartbeat (the state stays active); the watchdog armed
	// by the first must not simply stand down. Invariant: while active, a
	// watchdog is armed, so a lost connection always ends in "off".
	it('keeps the watchdog armed after a second enable while already live', async () => {
		vi.useFakeTimers();
		vi.mocked(apiHeartbeatLiveChatAvailability).mockRejectedValue(
			new Error('TIMEOUT')
		);
		const { result } = renderHook(() => {
			const rail = useLiveChatAvailable();
			const profile = useLiveChatAvailable();
			useLiveChatAvailabilityHeartbeat(true, rail[0]);
			return { rail, profile };
		});
		await act(async () => Promise.resolve());

		await act(async () => result.current.rail[1](true));
		await act(async () => vi.advanceTimersByTimeAsync(10_000));
		await act(async () => result.current.profile[1](true));
		expect(result.current.rail[0]).toBe(true);

		// The first enable's watchdog is due at 120 s; the lease from the
		// second enable (at 10 s) still runs, so still live...
		await act(async () => vi.advanceTimersByTimeAsync(111_000));
		expect(result.current.rail[0]).toBe(true);

		// ...and a lease after the last acknowledgement it goes off.
		await act(async () => vi.advanceTimersByTimeAsync(15_000));
		expect(result.current.rail[0]).toBe(false);
		expect(result.current.rail[2].lostReason).toBe('connectionLost');
		expect(localStorage.getItem('oriso_liveChatAvailability')).toBeNull();
	});

	// #1485 review: another tab's beat, sent just before the lease ran out,
	// may have renewed it but answer seconds later. This tab cannot see that
	// request, so before dropping it waits one request timeout and reads the
	// shared acknowledgement again.
	it("waits one request timeout for another tab's late acknowledgement before dropping", async () => {
		vi.useFakeTimers();
		localStorage.setItem('oriso_liveChatAvailability', '1');
		localStorage.setItem(
			'oriso_liveChatAvailabilityAck',
			String(Date.now())
		);
		vi.mocked(apiGetLiveChatAvailability).mockResolvedValue(true);
		vi.mocked(apiHeartbeatLiveChatAvailability).mockRejectedValue(
			new Error('TIMEOUT')
		);
		const { result } = renderHook(() => {
			const availability = useLiveChatAvailable();
			useLiveChatAvailabilityHeartbeat(true, availability[0]);
			return availability;
		});
		await act(async () => Promise.resolve());

		await act(async () => vi.advanceTimersByTimeAsync(124_000));
		// The other tab's beat (sent at 119 s) is acknowledged only now.
		localStorage.setItem(
			'oriso_liveChatAvailabilityAck',
			String(Date.now())
		);
		await act(async () => vi.advanceTimersByTimeAsync(6_000));

		expect(result.current[0]).toBe(true);
		expect(result.current[2].lostReason).toBeNull();
	});

	// #1485 review: a check sent before another tab switched on can answer
	// "no" before that tab's storage event arrives here.
	it("does not let a check older than another tab's enable remove it", async () => {
		vi.useFakeTimers();
		localStorage.setItem('oriso_liveChatAvailability', '1');
		let answer: (available: boolean) => void = () => undefined;
		vi.mocked(apiGetLiveChatAvailability).mockReturnValueOnce(
			new Promise((resolve) => {
				answer = resolve;
			})
		);
		const { result } = renderHook(() => useLiveChatAvailable());

		await act(async () => vi.advanceTimersByTimeAsync(1_000));
		// The other tab's acknowledged enable; its storage event is not here yet.
		localStorage.setItem(
			'oriso_liveChatAvailabilityAck',
			String(Date.now())
		);
		await act(async () => answer(false));

		expect(localStorage.getItem('oriso_liveChatAvailability')).toBe('1');
		expect(
			localStorage.getItem('oriso_liveChatAvailabilityAck')
		).not.toBeNull();
		expect(result.current[2].lostReason).toBeNull();
	});

	// #1485 review: the server started the lease no earlier than the enable
	// was sent, so a slow answer must not stretch the lease the client claims.
	it("counts an enable's lease from when it was sent, not answered", async () => {
		vi.useFakeTimers();
		vi.mocked(apiSetLiveChatAvailability).mockReturnValueOnce(
			new Promise((resolve) =>
				setTimeout(() => resolve(undefined), 10_000)
			)
		);
		vi.mocked(apiHeartbeatLiveChatAvailability).mockRejectedValue(
			new Error('TIMEOUT')
		);
		const { result } = renderHook(() => {
			const availability = useLiveChatAvailable();
			useLiveChatAvailabilityHeartbeat(true, availability[0]);
			return availability;
		});
		await act(async () => Promise.resolve());

		let enabled: Promise<void> = Promise.resolve();
		act(() => {
			enabled = result.current[1](true);
		});
		await act(async () => vi.advanceTimersByTimeAsync(10_000));
		await act(async () => enabled);
		expect(result.current[0]).toBe(true);

		// Sent at 0 s: a lease plus the 5 s grace ends at 125 s, not 135 s.
		await act(async () => vi.advanceTimersByTimeAsync(116_000));

		expect(result.current[0]).toBe(false);
		expect(result.current[2].lostReason).toBe('connectionLost');
	});

	// #1485 review: another tab must never see the fresh preference without
	// the fresh acknowledgement that makes its own stale "no" ignorable.
	it('writes the acknowledgement before it publishes the enabled preference', async () => {
		const setItem = vi.spyOn(Storage.prototype, 'setItem');
		const { result } = renderHook(() => useLiveChatAvailable());
		await waitFor(() => expect(result.current[2].loading).toBe(false));
		setItem.mockClear();

		await act(async () => result.current[1](true));

		const keys = setItem.mock.calls.map(([key]) => key);
		expect(keys.indexOf('oriso_liveChatAvailabilityAck')).toBeGreaterThan(
			-1
		);
		expect(keys.indexOf('oriso_liveChatAvailabilityAck')).toBeLessThan(
			keys.indexOf('oriso_liveChatAvailability')
		);
		setItem.mockRestore();
	});

	// #1485 review: an enable or a beat still in flight when the session is
	// torn down must not write the session's keys back afterwards.
	it('does not revive the session keys when an enable answers after teardown', async () => {
		let answer: () => void = () => undefined;
		vi.mocked(apiSetLiveChatAvailability).mockReturnValueOnce(
			new Promise((resolve) => {
				answer = () => resolve(undefined);
			})
		);
		const { result } = renderHook(() => useLiveChatAvailable());
		await waitFor(() => expect(result.current[2].loading).toBe(false));

		let enabled: Promise<void> = Promise.resolve();
		act(() => {
			enabled = result.current[1](true);
		});
		clearLiveChatAvailabilityPreference();
		await act(async () => {
			answer();
			await enabled.catch(() => undefined);
		});

		expect(localStorage.getItem('oriso_liveChatAvailability')).toBeNull();
		expect(
			localStorage.getItem('oriso_liveChatAvailabilityAck')
		).toBeNull();
	});

	it('does not write an acknowledgement when a beat answers after teardown', async () => {
		vi.useFakeTimers();
		const settle = pendingHeartbeat();
		renderHook(() => useLiveChatAvailabilityHeartbeat(true, true));

		// Teardown without the shell unmounting (an auth failure in place).
		clearLiveChatAvailabilityPreference();
		await act(async () => settle.resolve(true));

		expect(
			localStorage.getItem('oriso_liveChatAvailabilityAck')
		).toBeNull();
	});

	it('does not raise a loss notice on load when nothing claimed "live"', async () => {
		const { result } = renderHook(() => useLiveChatAvailable());
		await waitFor(() => expect(result.current[2].loading).toBe(false));

		expect(result.current[0]).toBe(false);
		expect(result.current[2].lostReason).toBeNull();
	});
});
