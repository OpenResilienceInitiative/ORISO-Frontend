// @vitest-environment jsdom
import React, { PropsWithChildren } from 'react';
import { cleanup, renderHook, waitFor, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ActiveSessionContext } from '../globalState';
import { useMatrixRoomUsers } from './useMatrixRoomUsers';

const ROOM_ID = '!room:matrix.example.org';

const mocks = vi.hoisted(() => {
	const env = process.env as Record<string, string>;
	env.REACT_APP_API_URL = 'http://localhost:9001';
	env.REACT_APP_KEYCLOAK_REALM = 'oriso';

	return {
		resolveSession: vi.fn(() => ({
			isMatrixSession: true,
			matrixRoomId: ROOM_ID,
			sessionId: 1
		})),
		loadMatrixRoomMembers: vi.fn<() => Promise<any[]>>(() =>
			Promise.resolve([])
		),
		getMatrixRoom: vi.fn<() => { membersLoaded: () => boolean } | null>(
			() => ({ membersLoaded: () => true })
		),
		onMatrixRoomMembers: vi.fn<
			(roomId: string, listener: () => void) => (() => void) | null
		>(() => () => {})
	};
});

vi.mock('../services/chatTransportService', () => ({
	chatTransportService: {
		resolveSession: mocks.resolveSession,
		loadMatrixRoomMembers: mocks.loadMatrixRoomMembers,
		getMatrixRoom: mocks.getMatrixRoom,
		onMatrixRoomMembers: mocks.onMatrixRoomMembers
	}
}));

// The globalState barrel transitively imports the whole registration UI,
// which vitest cannot resolve (extensionless .styles imports); mock it with
// just the context the hook consumes.
vi.mock('../globalState', async () => {
	const ReactModule = await import('react');
	return {
		ActiveSessionContext: ReactModule.createContext(null)
	};
});

const activeSession = {
	item: { id: 1, matrixRoomId: ROOM_ID, moderators: ['@mod:x'] }
} as any;

const wrapper = ({ children }: PropsWithChildren) => (
	<ActiveSessionContext.Provider
		value={{ activeSession, readActiveSession: () => {} } as any}
	>
		{children}
	</ActiveSessionContext.Provider>
);

describe('useMatrixRoomUsers', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.resolveSession.mockReturnValue({
			isMatrixSession: true,
			matrixRoomId: ROOM_ID,
			sessionId: 1
		});
		mocks.onMatrixRoomMembers.mockReturnValue(() => {});
		mocks.getMatrixRoom.mockReturnValue({ membersLoaded: () => true });
	});

	afterEach(() => {
		cleanup();
		vi.useRealTimers();
	});

	it('returns the complete member set after the lazy load resolved', async () => {
		mocks.loadMatrixRoomMembers.mockResolvedValue([
			{ userId: '@asker:x', name: 'Asker' },
			{ userId: '@consultant:x', rawDisplayName: 'Consultant' },
			{ userId: null }
		]);

		const { result } = renderHook(() => useMatrixRoomUsers(), { wrapper });

		await waitFor(() => {
			expect(result.current.users).toHaveLength(2);
		});

		expect(mocks.loadMatrixRoomMembers).toHaveBeenCalledWith(ROOM_ID);
		expect(result.current.users).toEqual([
			{ _id: '@asker:x', username: 'asker', displayName: 'Asker' },
			{
				_id: '@consultant:x',
				username: 'consultant',
				displayName: 'Consultant'
			}
		]);
		expect(result.current.moderators).toEqual(['@mod:x']);
	});

	it('updates the member set when a membership event arrives', async () => {
		let membershipListener: (() => void) | null = null;
		mocks.onMatrixRoomMembers.mockImplementation(
			(_roomId: string, listener: () => void) => {
				membershipListener = listener;
				return () => {};
			}
		);
		mocks.loadMatrixRoomMembers.mockResolvedValue([
			{ userId: '@asker:x', name: 'Asker' }
		]);

		const { result } = renderHook(() => useMatrixRoomUsers(), { wrapper });

		await waitFor(() => {
			expect(result.current.users).toHaveLength(1);
		});

		mocks.loadMatrixRoomMembers.mockResolvedValue([
			{ userId: '@asker:x', name: 'Asker' },
			{ userId: '@joined:x', name: 'Late Joiner' }
		]);

		act(() => {
			membershipListener?.();
		});

		await waitFor(() => {
			expect(result.current.users).toHaveLength(2);
		});
		expect(result.current.users[1]).toEqual({
			_id: '@joined:x',
			username: 'joined',
			displayName: 'Late Joiner'
		});
	});

	it('retries when the client exists before the room reaches the sync store', async () => {
		mocks.getMatrixRoom
			.mockReturnValueOnce(null)
			.mockReturnValue({ membersLoaded: () => true });
		mocks.loadMatrixRoomMembers
			.mockResolvedValueOnce([])
			.mockResolvedValue([
				{ userId: '@late:x', name: 'Late room member' }
			]);

		const { result } = renderHook(() => useMatrixRoomUsers(), { wrapper });

		await waitFor(() => expect(result.current.users).toHaveLength(1), {
			timeout: 2000
		});
		expect(result.current.users[0].username).toBe('late');
	});

	it('keeps one member refresh in flight across retry ticks', async () => {
		vi.useFakeTimers();
		let resolveMembers: (members: any[]) => void = () => {};
		mocks.loadMatrixRoomMembers.mockReturnValue(
			new Promise((resolve) => {
				resolveMembers = resolve;
			})
		);

		const { unmount } = renderHook(() => useMatrixRoomUsers(), { wrapper });

		await act(async () => {
			await vi.advanceTimersByTimeAsync(1500);
		});
		expect(mocks.loadMatrixRoomMembers).toHaveBeenCalledTimes(1);

		await act(async () => {
			resolveMembers([{ userId: '@late:x', name: 'Late room member' }]);
			await Promise.resolve();
		});

		unmount();
		vi.useRealTimers();
	});

	it('stops polling with backoff when the room never reaches the sync store', async () => {
		vi.useFakeTimers();
		mocks.getMatrixRoom.mockReturnValue(null);
		mocks.loadMatrixRoomMembers.mockResolvedValue([]);

		const { unmount } = renderHook(() => useMatrixRoomUsers(), { wrapper });

		await act(async () => {
			await vi.advanceTimersByTimeAsync(2000);
		});
		// Backoff: 0 ms, 500 ms, 1500 ms — not one load per 500 ms tick.
		expect(mocks.loadMatrixRoomMembers).toHaveBeenCalledTimes(3);

		await act(async () => {
			await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
		});
		const callsAtLimit = mocks.loadMatrixRoomMembers.mock.calls.length;
		expect(callsAtLimit).toBeLessThanOrEqual(10);

		await act(async () => {
			await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
		});
		expect(mocks.loadMatrixRoomMembers).toHaveBeenCalledTimes(callsAtLimit);

		unmount();
		vi.useRealTimers();
	});

	it('keeps retrying while the member load failed although the room exists', async () => {
		vi.useFakeTimers();
		let membersLoaded = false;
		mocks.getMatrixRoom.mockReturnValue({
			membersLoaded: () => membersLoaded
		});
		mocks.loadMatrixRoomMembers.mockResolvedValue([
			{ userId: '@cached:x', name: 'Cached' }
		]);

		const { unmount } = renderHook(() => useMatrixRoomUsers(), { wrapper });

		await act(async () => {
			await vi.advanceTimersByTimeAsync(2000);
		});
		expect(mocks.loadMatrixRoomMembers).toHaveBeenCalledTimes(3);

		membersLoaded = true;
		await act(async () => {
			await vi.advanceTimersByTimeAsync(2000);
		});
		const callsAfterSuccess = mocks.loadMatrixRoomMembers.mock.calls.length;
		expect(callsAfterSuccess).toBe(4);

		await act(async () => {
			await vi.advanceTimersByTimeAsync(60 * 1000);
		});
		expect(mocks.loadMatrixRoomMembers).toHaveBeenCalledTimes(
			callsAfterSuccess
		);

		unmount();
		vi.useRealTimers();
	});

	it('detaches the membership listener on unmount', async () => {
		const detach = vi.fn();
		mocks.onMatrixRoomMembers.mockReturnValue(detach);
		mocks.loadMatrixRoomMembers.mockResolvedValue([]);

		const { unmount } = renderHook(() => useMatrixRoomUsers(), { wrapper });

		await waitFor(() => {
			expect(mocks.onMatrixRoomMembers).toHaveBeenCalled();
		});

		unmount();
		expect(detach).toHaveBeenCalled();
	});

	it('yields an empty list for sessions without a Matrix room', async () => {
		mocks.resolveSession.mockReturnValue({
			isMatrixSession: false,
			matrixRoomId: null,
			sessionId: 1
		} as any);

		const { result } = renderHook(() => useMatrixRoomUsers(), { wrapper });

		expect(result.current.users).toEqual([]);
		expect(mocks.loadMatrixRoomMembers).not.toHaveBeenCalled();
	});
});
