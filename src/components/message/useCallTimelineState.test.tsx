// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CallLifecycleMessage } from '../../utils/callLifecycleMessage';
import { useCallTimelineState } from './useCallTimelineState';

const runningCall = (
	overrides: Partial<CallLifecycleMessage> = {}
): CallLifecycleMessage => ({
	callId: 'call-1',
	roomRef: '!source:example',
	callRoomId: '!media:example',
	callType: 'video',
	state: 'running',
	participants: [],
	...overrides
});

afterEach(() => {
	vi.useRealTimers();
});

describe('useCallTimelineState', () => {
	it('returns the durable room value while the immediate refresh is pending', () => {
		const initial = runningCall();
		const loadState = vi.fn(() => new Promise<null>(() => {}));
		const { result } = renderHook(() =>
			useCallTimelineState(initial, loadState)
		);

		expect(result.current).toBe(initial);
		expect(loadState).toHaveBeenCalledTimes(1);
		expect(loadState).toHaveBeenCalledWith(initial);
	});

	it('retries rejected and null reads until an accepted terminal response arrives', async () => {
		vi.useFakeTimers();
		const initial = runningCall();
		const loadState = vi
			.fn()
			.mockRejectedValueOnce(new Error('offline'))
			.mockResolvedValueOnce(null)
			.mockResolvedValue({
				...initial,
				state: 'ended',
				durationSeconds: 125
			});
		const { result } = renderHook(() =>
			useCallTimelineState(initial, loadState)
		);

		await act(async () => {
			await vi.advanceTimersByTimeAsync(30000);
		});

		expect(loadState).toHaveBeenCalledTimes(3);
		expect(result.current.state).toBe('ended');
		await act(async () => {
			await vi.advanceTimersByTimeAsync(30000);
		});
		expect(loadState).toHaveBeenCalledTimes(3);
	});

	it('permits a persisted missed call to progress to ended', async () => {
		const initial = runningCall({ state: 'missed' });
		const { result } = renderHook(() =>
			useCallTimelineState(initial, async () => ({
				...initial,
				state: 'ended',
				durationSeconds: 42
			}))
		);

		await act(async () => {});

		expect(result.current.state).toBe('ended');
		expect(result.current.durationSeconds).toBe(42);
	});

	it('lets authoritative missed state replace a provisional ended card without reopening it', async () => {
		const initial = runningCall({ state: 'ended', durationSeconds: 42 });
		const { result } = renderHook(() =>
			useCallTimelineState(initial, async () => ({
				...initial,
				state: 'missed',
				durationSeconds: undefined
			}))
		);
		await act(async () => {});
		expect(result.current.state).toBe('missed');
		expect(result.current.durationSeconds).toBeUndefined();
	});

	it('keeps a terminal result when an equivalent stale running prop object is supplied', async () => {
		vi.useFakeTimers();
		const initial = runningCall();
		const loadState = vi
			.fn()
			.mockResolvedValueOnce({
				...initial,
				state: 'ended',
				durationSeconds: 42
			})
			.mockResolvedValue(initial);
		const { result, rerender } = renderHook(
			({ call }) => useCallTimelineState(call, loadState),
			{ initialProps: { call: initial } }
		);
		await act(async () => {});

		rerender({ call: { ...initial } });
		await act(async () => {
			await vi.advanceTimersByTimeAsync(30000);
		});

		expect(result.current.state).toBe('ended');
		expect(result.current.durationSeconds).toBe(42);
		expect(loadState).toHaveBeenCalledTimes(1);
	});

	it('retries wrong-identity and disallowed-state responses before accepting completion', async () => {
		vi.useFakeTimers();
		const initial = runningCall({ state: 'missed' });
		const loadState = vi
			.fn()
			.mockResolvedValueOnce({
				...initial,
				callRoomId: '!wrong-media:example',
				state: 'ended'
			})
			.mockResolvedValueOnce({ ...initial, state: 'running' })
			.mockResolvedValue({
				...initial,
				state: 'ended',
				durationSeconds: 42
			});
		const { result } = renderHook(() =>
			useCallTimelineState(initial, loadState)
		);

		await act(async () => {
			await vi.advanceTimersByTimeAsync(30000);
		});

		expect(loadState).toHaveBeenCalledTimes(3);
		expect(result.current.state).toBe('ended');
		expect(result.current.durationSeconds).toBe(42);
	});

	it('ignores an old response after the complete call identity changes', async () => {
		const oldCall = runningCall();
		let resolveOld!: (value: CallLifecycleMessage) => void;
		const oldResponse = new Promise<CallLifecycleMessage>((resolve) => {
			resolveOld = resolve;
		});
		const loadState = vi
			.fn()
			.mockReturnValueOnce(oldResponse)
			.mockImplementation(() => new Promise(() => {}));
		const { result, rerender } = renderHook(
			({ call }) => useCallTimelineState(call, loadState),
			{ initialProps: { call: oldCall } }
		);
		const newCall = runningCall({
			callId: 'call-2',
			callRoomId: '!media-2:example'
		});

		rerender({ call: newCall });
		await act(async () => {
			resolveOld({ ...oldCall, state: 'ended' });
			await oldResponse;
		});

		expect(result.current).toBe(newCall);
		expect(loadState).toHaveBeenCalledTimes(2);
		expect(loadState).toHaveBeenLastCalledWith(newCall);
	});

	it('does not ask again when the same card is merely rebuilt', async () => {
		/*
		 * The session rebuilds every message object on every
		 * `fetchSessionMessages()` — per incoming message, per reaction, per
		 * decryption burst, plus a 60-second fallback. Keying the effect on
		 * the prop object meant one immediate read per card per rebuild: ten
		 * call cards in a conversation sent ten requests for every chat
		 * message that arrived.
		 */
		vi.useFakeTimers();
		const initial = runningCall();
		const loadState = vi.fn(() => Promise.resolve(null));
		const { rerender } = renderHook(
			({ call }) => useCallTimelineState(call, loadState),
			{ initialProps: { call: initial } }
		);
		await act(async () => {});
		expect(loadState).toHaveBeenCalledTimes(1);

		for (let i = 0; i < 5; i += 1) {
			rerender({ call: { ...initial, participants: [] } });
			await act(async () => {});
		}

		expect(loadState).toHaveBeenCalledTimes(1);
		// And the fifteen-second schedule is still the only thing asking.
		await act(async () => {
			await vi.advanceTimersByTimeAsync(15000);
		});
		expect(loadState).toHaveBeenCalledTimes(2);
	});

	it('stops asking about a finished card the server knows nothing about', async () => {
		/*
		 * A null answer for a terminal card is as much as there is to learn:
		 * a card written before the backend held a record, or one whose
		 * record is gone. It used to reschedule every fifteen seconds for as
		 * long as the card stayed on screen.
		 */
		vi.useFakeTimers();
		const loadState = vi.fn(() => Promise.resolve(null));
		renderHook(() =>
			useCallTimelineState(
				runningCall({ state: 'ended', durationSeconds: 42 }),
				loadState
			)
		);
		await act(async () => {});

		await act(async () => {
			await vi.advanceTimersByTimeAsync(120000);
		});
		expect(loadState).toHaveBeenCalledTimes(1);
	});

	it('cancels retries and ignores a pending response after unmount', async () => {
		vi.useFakeTimers();
		const initial = runningCall();
		let resolve!: (value: CallLifecycleMessage) => void;
		const pending = new Promise<CallLifecycleMessage>((done) => {
			resolve = done;
		});
		const loadState = vi.fn(() => pending);
		const { unmount } = renderHook(() =>
			useCallTimelineState(initial, loadState)
		);

		unmount();
		await act(async () => {
			resolve({ ...initial, state: 'ended' });
			await pending;
			await vi.advanceTimersByTimeAsync(30000);
		});

		expect(loadState).toHaveBeenCalledTimes(1);
	});

	it.each(['null', 'rejection'] as const)(
		'cancels an armed retry timer after a %s response when unmounted',
		async (outcome) => {
			vi.useFakeTimers();
			const initial = runningCall();
			const loadState = vi.fn(() =>
				outcome === 'null'
					? Promise.resolve(null)
					: Promise.reject(new Error('offline'))
			);
			const { unmount } = renderHook(() =>
				useCallTimelineState(initial, loadState)
			);
			await act(async () => {});

			unmount();
			await act(async () => {
				await vi.advanceTimersByTimeAsync(30000);
			});

			expect(loadState).toHaveBeenCalledTimes(1);
		}
	);
});
