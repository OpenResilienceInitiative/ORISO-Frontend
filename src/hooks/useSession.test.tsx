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

	it('loads a valid zero-valued chat id', async () => {
		const rawSession = { chat: { id: 0 } };
		const extendedSession = { item: rawSession.chat, isGroup: true };
		vi.mocked(apiGetChatRoomById).mockResolvedValue({
			sessions: [rawSession]
		} as any);
		vi.mocked(buildExtendedSession).mockReturnValue(extendedSession as any);

		const { result } = renderHook(() => useSession(null, undefined, 0));

		await waitFor(() => expect(result.current.ready).toBe(true));
		expect(apiGetChatRoomById).toHaveBeenCalledWith(
			0,
			expect.any(AbortSignal)
		);
		expect(result.current.session).toBe(extendedSession);
	});

	it('settles ready with no session when a fetch fails', async () => {
		vi.mocked(apiGetSessionRoomBySessionId).mockRejectedValue(
			new Error('network unavailable')
		);
		vi.mocked(apiGetCaseHandoverCandidates).mockRejectedValue(
			new Error('candidate lookup unavailable')
		);

		const { result } = renderHook(() => useSession(null, 7));

		await waitFor(() => expect(result.current.ready).toBe(true));
		expect(result.current.session).toBeNull();
	});

	it('aborts an in-flight request when route parameters change', async () => {
		const signals: AbortSignal[] = [];
		const secondRawSession = { session: { id: 2 } };
		const secondExtendedSession = { item: { id: 2 } };
		vi.mocked(apiGetSessionRoomBySessionId).mockImplementation(
			(sessionId, signal) => {
				signals.push(signal);
				return sessionId === 1
					? new Promise(() => undefined)
					: Promise.resolve({ sessions: [secondRawSession] } as any);
			}
		);
		vi.mocked(buildExtendedSession).mockReturnValue(
			secondExtendedSession as any
		);
		const { result, rerender } = renderHook(
			({ sessionId }) => useSession(null, sessionId),
			{ initialProps: { sessionId: 1 } }
		);

		rerender({ sessionId: 2 });

		await waitFor(() => expect(result.current.ready).toBe(true));
		expect(signals[0].aborted).toBe(true);
		expect(result.current.session).toBe(secondExtendedSession);
	});
});
