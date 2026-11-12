// @vitest-environment oriso-jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vite-plus/test';

import {
	buildCallLifecycleContent,
	CALL_STATE_NOT_FOUND,
	type CallLifecycleMessage
} from '../../utils/callLifecycleMessage';
import {
	UNKNOWN_RECHECK_DELAY_MS,
	UNKNOWN_STATE_LIMIT
} from '../message/useCallTimelineState';
import { runningCallOf, useRunningCall } from './runningCall';

const ROOM = '!session:oriso.test';
const COUNSELLOR = '@berater:oriso.test';

const call = (
	overrides: Partial<CallLifecycleMessage> = {}
): CallLifecycleMessage => ({
	callId: 'call-1',
	roomRef: ROOM,
	callRoomId: '!call:oriso.test',
	state: 'running',
	callType: 'audio',
	participants: [{ userId: COUNSELLOR, displayName: 'Beratung' }],
	present: [{ userId: COUNSELLOR, displayName: 'Beratung' }],
	...overrides
});

let ts = 1_000;
const event = (
	content: Record<string, unknown>,
	id = `$e${ts}`,
	sender = COUNSELLOR
) => {
	const at = (ts += 1000);
	return {
		getType: () => 'm.room.message',
		getContent: () => content,
		getSender: () => sender,
		getTs: () => at,
		getId: () => id,
		isRedacted: () => false
	};
};

const card = (message: CallLifecycleMessage, id?: string) =>
	event(buildCallLifecycleContent(message), id);
const edit = (message: CallLifecycleMessage, of: string, sender?: string) =>
	event(buildCallLifecycleContent(message, of), undefined, sender);
const text = () => event({ msgtype: 'm.text', body: 'Hallo' });

describe('the running call of a conversation, for the list (S10)', () => {
	it('finds the call the card says is running', () => {
		const found = runningCallOf([text(), card(call()), text()], ROOM);
		expect(found?.callId).toBe('call-1');
		expect(found?.present).toHaveLength(1);
	});

	it('takes the latest revision of the card', () => {
		const original = card(call(), '$card');
		const ended = edit(call({ state: 'ended' }), '$card');
		expect(runningCallOf([original, ended], ROOM)).toBeNull();

		const again = card(call(), '$card');
		const joined = edit(
			call({
				present: [
					{ userId: COUNSELLOR, displayName: 'Beratung' },
					{ userId: '@anon:oriso.test', displayName: 'Fuchs' }
				]
			}),
			'$card'
		);
		expect(runningCallOf([again, joined], ROOM)?.present).toHaveLength(2);
	});

	it('ignores a call that belongs to another room', () => {
		expect(
			runningCallOf([card(call({ roomRef: '!side:oriso.test' }))], ROOM)
		).toBeNull();
	});

	it('says nothing without events or a room', () => {
		expect(runningCallOf([], ROOM)).toBeNull();
		expect(runningCallOf([card(call())], null)).toBeNull();
	});

	it('drops the call once the server says it ended', async () => {
		const events = [card(call())];
		const loadState = vi.fn().mockResolvedValue(call({ state: 'ended' }));
		const { result } = renderHook(() =>
			useRunningCall(events, ROOM, loadState)
		);
		expect(result.current?.callId).toBe('call-1');
		await waitFor(() => expect(result.current).toBeNull());
		expect(loadState).toHaveBeenCalledTimes(1);
	});

	it('keeps the card´s word while the server cannot be asked', async () => {
		const events = [card(call())];
		const loadState = vi.fn().mockRejectedValue(new Error('offline'));
		const { result } = renderHook(() =>
			useRunningCall(events, ROOM, loadState)
		);
		await waitFor(() => expect(loadState).toHaveBeenCalled());
		expect(result.current?.callId).toBe('call-1');
	});

	/*
	 * #145/#2215 review: one nullable answer is not an ending. The list
	 * reconciles exactly as the chat card does (useCallTimelineState).
	 */
	it('hides the marker while the server answer is untrusted, and recovers', async () => {
		vi.useFakeTimers();
		try {
			const events = [card(call())];
			const loadState = vi.fn().mockResolvedValue(null);
			const { result } = renderHook(() =>
				useRunningCall(events, ROOM, loadState)
			);
			await act(async () => {
				await vi.advanceTimersByTimeAsync(0);
			});
			expect(result.current).toBeNull();
			loadState.mockResolvedValue(call());
			await act(async () => {
				await vi.advanceTimersByTimeAsync(15_000);
			});
			expect(result.current?.callId).toBe('call-1');
		} finally {
			vi.useRealTimers();
		}
	});

	it('brings a provisionally ended call back once the server knows it', async () => {
		vi.useFakeTimers();
		try {
			const events = [card(call())];
			const loadState = vi
				.fn()
				.mockResolvedValue(CALL_STATE_NOT_FOUND as never);
			const { result } = renderHook(() =>
				useRunningCall(events, ROOM, loadState)
			);
			for (let i = 0; i < UNKNOWN_STATE_LIMIT; i += 1) {
				await act(async () => {
					await vi.advanceTimersByTimeAsync(15_000);
				});
			}
			expect(result.current).toBeNull();
			loadState.mockResolvedValue(call());
			await act(async () => {
				await vi.advanceTimersByTimeAsync(UNKNOWN_RECHECK_DELAY_MS);
			});
			expect(result.current?.callId).toBe('call-1');
		} finally {
			vi.useRealTimers();
		}
	});

	it('asks again while the call keeps running, and drops it when it ends', async () => {
		vi.useFakeTimers();
		try {
			const events = [card(call())];
			const loadState = vi.fn().mockResolvedValue(call());
			const { result } = renderHook(() =>
				useRunningCall(events, ROOM, loadState)
			);
			await act(async () => {
				await vi.advanceTimersByTimeAsync(0);
			});
			expect(result.current?.callId).toBe('call-1');
			loadState.mockResolvedValue(call({ state: 'ended' }));
			await act(async () => {
				await vi.advanceTimersByTimeAsync(15_000);
			});
			expect(loadState.mock.calls.length).toBeGreaterThan(1);
			expect(result.current).toBeNull();
		} finally {
			vi.useRealTimers();
		}
	});

	it('keeps a running call whose card scrolled out of the preview window', async () => {
		vi.useFakeTimers();
		try {
			const loadState = vi.fn().mockResolvedValue(call());
			let events: unknown[] = [card(call())];
			const { result, rerender } = renderHook(() =>
				useRunningCall(events, ROOM, loadState)
			);
			await act(async () => {
				await vi.advanceTimersByTimeAsync(0);
			});
			expect(result.current?.callId).toBe('call-1');
			// 50 newer chat events push the card out of the list's window.
			events = Array.from({ length: 50 }, () => ({
				type: 'm.room.message',
				content: { body: 'hi', msgtype: 'm.text' }
			}));
			rerender();
			expect(result.current?.callId).toBe('call-1');
			// The server reconciliation still ends it.
			loadState.mockResolvedValue(call({ state: 'ended' }));
			await act(async () => {
				await vi.advanceTimersByTimeAsync(15_000);
			});
			expect(result.current).toBeNull();
			rerender();
			expect(result.current).toBeNull();
		} finally {
			vi.useRealTimers();
		}
	});

	it('drops a retained call when a terminal edit arrives, without the server', async () => {
		vi.useFakeTimers();
		try {
			const loadState = vi.fn().mockRejectedValue(new Error('offline'));
			let events: unknown[] = [card(call(), '$card')];
			const { result, rerender } = renderHook(() =>
				useRunningCall(events, ROOM, loadState)
			);
			await act(async () => {
				await vi.advanceTimersByTimeAsync(0);
			});
			expect(result.current?.callId).toBe('call-1');
			// The original card is out of the window; only its edit is in.
			events = [text(), edit(call({ state: 'ended' }), '$card')];
			rerender();
			expect(result.current).toBeNull();
		} finally {
			vi.useRealTimers();
		}
	});

	it('drops a retained call when its card in the window turns terminal', () => {
		const loadState = vi.fn().mockRejectedValue(new Error('offline'));
		let events: unknown[] = [card(call(), '$card')];
		const { result, rerender } = renderHook(() =>
			useRunningCall(events, ROOM, loadState)
		);
		expect(result.current?.callId).toBe('call-1');
		events = [
			card(call(), '$card'),
			edit(call({ state: 'ended' }), '$card')
		];
		rerender();
		expect(result.current).toBeNull();
	});

	it('ignores a forged ending of a retained call by somebody else', () => {
		const loadState = vi.fn().mockRejectedValue(new Error('offline'));
		let events: unknown[] = [card(call(), '$card')];
		const { result, rerender } = renderHook(() =>
			useRunningCall(events, ROOM, loadState)
		);
		expect(result.current?.callId).toBe('call-1');
		events = [
			text(),
			edit(call({ state: 'ended' }), '$card', '@someone:oriso.test')
		];
		rerender();
		expect(result.current?.callId).toBe('call-1');
	});

	it('brings a retained call back after a provisional end, outside the window', async () => {
		vi.useFakeTimers();
		try {
			const loadState = vi
				.fn()
				.mockResolvedValue(CALL_STATE_NOT_FOUND as never);
			let events: unknown[] = [card(call(), '$card')];
			const { result, rerender } = renderHook(() =>
				useRunningCall(events, ROOM, loadState)
			);
			events = [text()];
			rerender();
			for (let i = 0; i < UNKNOWN_STATE_LIMIT; i += 1) {
				await act(async () => {
					await vi.advanceTimersByTimeAsync(15_000);
				});
			}
			expect(result.current).toBeNull();
			rerender();
			loadState.mockResolvedValue(call());
			await act(async () => {
				await vi.advanceTimersByTimeAsync(UNKNOWN_RECHECK_DELAY_MS);
			});
			expect(result.current?.callId).toBe('call-1');
		} finally {
			vi.useRealTimers();
		}
	});

	it('never retains a later card with the same call id from somebody else', () => {
		const loadState = vi.fn().mockRejectedValue(new Error('offline'));
		let events: unknown[] = [
			card(call(), '$card'),
			event(
				buildCallLifecycleContent(call()),
				'$forged',
				'@someone:oriso.test'
			)
		];
		const { result, rerender } = renderHook(() =>
			useRunningCall(events, ROOM, loadState)
		);
		expect(result.current?.callId).toBe('call-1');
		// Both cards scroll out; the forger then "ends" their own card.
		events = [
			text(),
			edit(call({ state: 'ended' }), '$forged', '@someone:oriso.test')
		];
		rerender();
		expect(result.current?.callId).toBe('call-1');
	});

	it('keeps the latest attendance once card and edit left the window', () => {
		const loadState = vi.fn().mockRejectedValue(new Error('offline'));
		const four = [
			{ userId: COUNSELLOR, displayName: 'Beratung' },
			{ userId: '@a:oriso.test', displayName: 'Fuchs' },
			{ userId: '@b:oriso.test', displayName: 'Igel' },
			{ userId: '@c:oriso.test', displayName: 'Dachs' }
		];
		let events: unknown[] = [
			card(call(), '$card'),
			edit(call({ present: four }), '$card')
		];
		const { result, rerender } = renderHook(() =>
			useRunningCall(events, ROOM, loadState)
		);
		expect(result.current?.present).toHaveLength(4);
		events = [text()];
		rerender();
		expect(result.current?.present).toHaveLength(4);
	});
});
