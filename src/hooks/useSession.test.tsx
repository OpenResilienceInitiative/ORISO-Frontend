// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	apiGetSessionRoomBySessionId,
	apiGetSessionRoomsByGroupIds
} from '../api/apiGetSessionRooms';
import { apiGetChatRoomById } from '../api/apiGetChatRoomById';
import { apiGetCaseHandoverCandidates } from '../api/apiCaseHandover';
import { buildExtendedSession } from '../globalState';
import { useSession } from './useSession';

vi.mock('../api', () => ({
	FETCH_ERRORS: { ABORT: 'ABORT' }
}));

vi.mock('../api/apiGetSessionRooms', () => ({
	apiGetSessionRoomBySessionId: vi.fn(),
	apiGetSessionRoomsByGroupIds: vi.fn()
}));

vi.mock('../api/apiGetChatRoomById', () => ({
	apiGetChatRoomById: vi.fn()
}));

vi.mock('../api/apiCaseHandover', () => ({
	apiGetCaseHandoverCandidates: vi.fn()
}));

vi.mock('../globalState', () => ({
	buildExtendedSession: vi.fn()
}));

vi.mock('../services/chatTransportService', () => ({
	chatTransportService: {
		resolveSession: vi.fn(),
		markRoomAsRead: vi.fn()
	}
}));

describe('useSession', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('loads a valid zero-valued session id', async () => {
		const rawSession = { session: { id: 0 } };
		const extendedSession = { item: { id: 0 } };
		vi.mocked(apiGetSessionRoomBySessionId).mockResolvedValue({
			sessions: [rawSession]
		} as any);
		vi.mocked(buildExtendedSession).mockReturnValue(extendedSession as any);

		const { result } = renderHook(() => useSession(null, 0));

		await waitFor(() => expect(result.current.ready).toBe(true));
		expect(apiGetSessionRoomBySessionId).toHaveBeenCalledWith(
			0,
			expect.any(AbortSignal)
		);
		expect(result.current.session).toBe(extendedSession);
		expect(apiGetSessionRoomsByGroupIds).not.toHaveBeenCalled();
		expect(apiGetChatRoomById).not.toHaveBeenCalled();
		expect(apiGetCaseHandoverCandidates).not.toHaveBeenCalled();
	});

	it('loads a routed group chat by room id when both route params exist', async () => {
		const rawSession = {
			chat: { id: 1, groupId: '!room:matrix.localhost' }
		};
		const extendedSession = { item: rawSession.chat, isGroup: true };
		vi.mocked(apiGetSessionRoomsByGroupIds).mockResolvedValue({
			sessions: [rawSession]
		} as any);
		vi.mocked(buildExtendedSession).mockReturnValue(extendedSession as any);

		const { result } = renderHook(() =>
			useSession('!room:matrix.localhost', 1)
		);

		await waitFor(() => expect(result.current.ready).toBe(true));
		expect(apiGetSessionRoomsByGroupIds).toHaveBeenCalledWith(
			['!room:matrix.localhost'],
			expect.any(AbortSignal)
		);
		expect(apiGetSessionRoomBySessionId).not.toHaveBeenCalled();
		expect(result.current.session).toBe(extendedSession);
	});
});
