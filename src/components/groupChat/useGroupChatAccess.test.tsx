// @vitest-environment jsdom

import { cleanup, renderHook, waitFor } from '@testing-library/react';
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

		expect(result.current).toBe('checking');
		await waitFor(() => expect(result.current).toBe('notMember'));
		expect(apiGetGroupChatInfo).toHaveBeenCalledWith(42);
	});

	it('asks again once she was let in (knock to join)', async () => {
		apiGetGroupChatInfo.mockRejectedValueOnce(new Error('FORBIDDEN'));
		const { result, rerender } = renderHook(
			({ revision }) =>
				useGroupChatAccess({ ...group, isConsultant: true, revision }),
			{ initialProps: { revision: 0 } }
		);
		await waitFor(() => expect(result.current).toBe('notMember'));

		rerender({ revision: 1 });

		await waitFor(() => expect(result.current).toBe('member'));
		expect(apiGetGroupChatInfo).toHaveBeenCalledTimes(2);
	});

	it('lets a counsellor in when the server allows her the group', async () => {
		const { result } = renderHook(() =>
			useGroupChatAccess({ ...group, isConsultant: true })
		);

		await waitFor(() => expect(result.current).toBe('member'));
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

		expect(result.current).toBe('member');
		expect(apiGetGroupChatInfo).not.toHaveBeenCalled();
	});

	it('leaves clients and one-to-one sessions alone', () => {
		const asker = renderHook(() =>
			useGroupChatAccess({ ...group, isConsultant: false })
		);
		const session = renderHook(() =>
			useGroupChatAccess({ ...group, isGroup: false, isConsultant: true })
		);

		expect(asker.result.current).toBe('member');
		expect(session.result.current).toBe('member');
		expect(apiGetGroupChatInfo).not.toHaveBeenCalled();
	});

	// Anything but a clear refusal keeps today's view; the server still
	// guards starting and joining.
	it('keeps the group open on an error that is not a refusal', async () => {
		apiGetGroupChatInfo.mockRejectedValue(new Error('CATCH_ALL'));

		const { result } = renderHook(() =>
			useGroupChatAccess({ ...group, isConsultant: true })
		);

		await waitFor(() => expect(result.current).toBe('member'));
	});
});
