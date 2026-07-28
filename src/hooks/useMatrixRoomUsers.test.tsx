// @vitest-environment jsdom
import React, { PropsWithChildren } from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ActiveSessionContext } from '../globalState';
import { useMatrixRoomUsers } from './useMatrixRoomUsers';

const ROOM_ID = '!room:matrix.oriso.org';

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
		onMatrixRoomMembers: vi.fn<
			(roomId: string, listener: () => void) => (() => void) | null
		>(() => () => {})
	};
});

vi.mock('../services/chatTransportService', () => ({
	chatTransportService: {
		resolveSession: mocks.resolveSession,
		loadMatrixRoomMembers: mocks.loadMatrixRoomMembers,
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
