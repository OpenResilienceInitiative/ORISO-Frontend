// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMatrixTyping } from './useMatrixTyping';

const transport = vi.hoisted(() => ({
	sendTyping: vi.fn(async () => undefined)
}));

vi.mock('../../services/chatTransportService', () => ({
	chatTransportService: transport
}));

const ROOM = '!room:matrix.example';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
	vi.useRealTimers();
	vi.clearAllMocks();
});

describe('useMatrixTyping (#1824, D3: the chat typing rule, shared)', () => {
	it('announces typing once per trigger window and ends it after idle time', () => {
		const { result } = renderHook(() => useMatrixTyping(ROOM));
		act(() => {
			result.current(false);
			result.current(false);
		});
		expect(transport.sendTyping).toHaveBeenCalledTimes(1);
		expect(transport.sendTyping).toHaveBeenLastCalledWith(ROOM, true);

		act(() => vi.advanceTimersByTime(3200));
		expect(transport.sendTyping).toHaveBeenLastCalledWith(ROOM, false);
	});

	it('renews the announcement while typing continues', () => {
		const { result } = renderHook(() => useMatrixTyping(ROOM));
		act(() => result.current(false));
		act(() => vi.advanceTimersByTime(1500));
		act(() => result.current(false));
		expect(
			transport.sendTyping.mock.calls.filter(([, typing]) => typing)
		).toHaveLength(2);
	});

	it('ends typing shortly after the field is cleared', () => {
		const { result } = renderHook(() => useMatrixTyping(ROOM));
		act(() => result.current(false));
		act(() => result.current(true));
		act(() => vi.advanceTimersByTime(250));
		expect(transport.sendTyping).toHaveBeenLastCalledWith(ROOM, false);
	});

	it('sends to an explicit room when given one', () => {
		const { result } = renderHook(() => useMatrixTyping(ROOM));
		act(() => result.current(false, '!side:matrix.example'));
		expect(transport.sendTyping).toHaveBeenLastCalledWith(
			'!side:matrix.example',
			true
		);
	});

	it('ends a running announcement when the room changes or the view closes', () => {
		const { result, rerender, unmount } = renderHook(
			({ room }) => useMatrixTyping(room),
			{ initialProps: { room: ROOM } }
		);
		act(() => result.current(false));
		rerender({ room: '!other:matrix.example' });
		expect(transport.sendTyping).toHaveBeenLastCalledWith(ROOM, false);
		act(() => result.current(false));
		unmount();
		expect(transport.sendTyping).toHaveBeenLastCalledWith(
			'!other:matrix.example',
			false
		);
	});

	it('does nothing without a room', () => {
		const { result } = renderHook(() => useMatrixTyping(null));
		act(() => result.current(false));
		expect(transport.sendTyping).not.toHaveBeenCalled();
	});
});
