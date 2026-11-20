// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { chatTransportService } from '../services/chatTransportService';
import { useLoadRoomMembers } from './useLoadRoomMembers';

vi.mock('../services/chatTransportService', () => ({
	chatTransportService: {
		loadMatrixRoomMembers: vi.fn(),
		getMatrixRoom: vi.fn()
	}
}));

const load = vi.mocked(chatTransportService.loadMatrixRoomMembers);
const getRoom = vi.mocked(chatTransportService.getMatrixRoom);
const flush = async (ms: number) => {
	await act(async () => {
		await vi.advanceTimersByTimeAsync(ms);
	});
};

describe('useLoadRoomMembers', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.clearAllMocks();
		load.mockResolvedValue([]);
	});
	afterEach(() => {
		cleanup();
		vi.useRealTimers();
	});

	it('does nothing without a room', () => {
		renderHook(() => useLoadRoomMembers(undefined));
		expect(load).not.toHaveBeenCalled();
	});

	it('loads the members once when they arrive (#1998)', async () => {
		getRoom.mockReturnValue({ membersLoaded: () => true } as any);
		renderHook(() => useLoadRoomMembers('!team:dev.example'));
		await flush(20000);
		expect(load).toHaveBeenCalledTimes(1);
		expect(load).toHaveBeenCalledWith('!team:dev.example');
	});

	it('retries until the room reached the sync store, then stops', async () => {
		getRoom.mockReturnValueOnce(null);
		getRoom.mockReturnValue({ membersLoaded: () => true } as any);
		renderHook(() => useLoadRoomMembers('!team:dev.example'));
		await flush(20000);
		expect(load).toHaveBeenCalledTimes(2);
	});

	it('gives up after a bound and stops on unmount', async () => {
		getRoom.mockReturnValue(null);
		const { unmount } = renderHook(() =>
			useLoadRoomMembers('!team:dev.example')
		);
		await flush(600);
		const callsBeforeUnmount = load.mock.calls.length;
		unmount();
		await flush(120000);
		expect(load).toHaveBeenCalledTimes(callsBeforeUnmount);

		load.mockClear();
		renderHook(() => useLoadRoomMembers('!team:dev.example'));
		await flush(120000);
		expect(load).toHaveBeenCalledTimes(9);
	});
});
