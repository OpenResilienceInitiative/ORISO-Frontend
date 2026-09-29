// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGroupChatAccess } from './useGroupChatAccess';

const apiGetGroupChatInfo = vi.hoisted(() => vi.fn());

vi.mock('../../api', () => ({
	apiGetGroupChatInfo,
	FETCH_ERRORS: { FORBIDDEN: 'FORBIDDEN', NO_MATCH: 'NO_MATCH' }
}));

const group = { chatId: 42, isGroup: true, subscribed: false };

beforeEach(() => {
	vi.clearAllMocks();
	apiGetGroupChatInfo.mockResolvedValue({ id: 42, active: false });
});

afterEach(cleanup);

/**
 * #1499: a counsellor who follows a group's invite link now lands in her own
 * session view. For a group of another Beratungsstelle the chat itself still
 * loads (every counsellor gets `/users/chat/room/<id>`, measured on Dev
 * 2026-09-23), but `/users/chat/<id>` answers 403 — and without this check
 * she saw the moderator room with an enabled "Chat starten".
 */
describe('useGroupChatAccess', () => {
	it('reports a counsellor the server refuses as not a member', async () => {
		apiGetGroupChatInfo.mockRejectedValue(new Error('FORBIDDEN'));

		const { result } = renderHook(() =>
			useGroupChatAccess({ ...group, isConsultant: true })
		);

		expect(result.current.access).toBe('checking');
		await waitFor(() => expect(result.current.access).toBe('notMember'));
		expect(apiGetGroupChatInfo).toHaveBeenCalledWith(42);
	});

	it('lets a counsellor in when the server allows her the group', async () => {
		const { result } = renderHook(() =>
			useGroupChatAccess({ ...group, isConsultant: true })
		);

		await waitFor(() => expect(result.current.access).toBe('member'));
	});

	// Owner and co-moderators are joined to the room: no extra request, no
	// extra wait before their own waiting room.
	it('does not ask for a counsellor who is already in the room', () => {
		const { result } = renderHook(() =>
			useGroupChatAccess({
				...group,
				subscribed: true,
				isConsultant: true
			})
		);

		expect(result.current.access).toBe('member');
		expect(apiGetGroupChatInfo).not.toHaveBeenCalled();
	});

	it('leaves clients and one-to-one sessions alone', () => {
		const asker = renderHook(() =>
			useGroupChatAccess({ ...group, isConsultant: false })
		);
		const session = renderHook(() =>
			useGroupChatAccess({ ...group, isGroup: false, isConsultant: true })
		);

		expect(asker.result.current.access).toBe('member');
		expect(session.result.current.access).toBe('member');
		expect(apiGetGroupChatInfo).not.toHaveBeenCalled();
	});

	// Only a clear answer decides: a failed or unreadable check must not show
	// the moderator room with an enabled "Chat starten".
	it.each([
		['a request error', () => Promise.reject(new Error('CATCH_ALL'))],
		['an unknown group', () => Promise.reject(new Error('NO_MATCH'))],
		['an empty answer', () => Promise.resolve(undefined)],
		['another group', () => Promise.resolve({ id: 7, active: true })]
	])('reports the group unavailable on %s', async (_, answer) => {
		apiGetGroupChatInfo.mockImplementation(answer);

		const { result } = renderHook(() =>
			useGroupChatAccess({ ...group, isConsultant: true })
		);

		await waitFor(() => expect(result.current.access).toBe('unavailable'));
	});

	it('asks again on retry and lets her in once the server answers', async () => {
		apiGetGroupChatInfo.mockRejectedValueOnce(new Error('CATCH_ALL'));

		const { result } = renderHook(() =>
			useGroupChatAccess({ ...group, isConsultant: true })
		);
		await waitFor(() => expect(result.current.access).toBe('unavailable'));

		act(() => result.current.retry());

		expect(result.current.access).toBe('checking');
		await waitFor(() => expect(result.current.access).toBe('member'));
		expect(apiGetGroupChatInfo).toHaveBeenCalledTimes(2);
	});
});
