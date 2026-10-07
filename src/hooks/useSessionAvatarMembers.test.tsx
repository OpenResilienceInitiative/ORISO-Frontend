// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiGetChatMembers } from '../api/apiGetChatMembers';
import { useSessionAvatarMembers } from './useSessionAvatarMembers';

vi.mock('../api/apiGetChatMembers', () => ({ apiGetChatMembers: vi.fn() }));
const api = vi.mocked(apiGetChatMembers);
const members = [
	{ _id: '@author:example.org', avatarKind: 'ICON', avatarId: 'owl' }
];

describe('active chat avatar metadata', () => {
	beforeEach(() => {
		vi.resetAllMocks();
		api.mockResolvedValue({ members });
	});
	afterEach(cleanup);
	it('loads once for one active chat and shares the result across rerenders', async () => {
		const { result, rerender } = renderHook(() =>
			useSessionAvatarMembers(42, 'account-a')
		);
		await waitFor(() => expect(result.current).toEqual(members));
		rerender();
		rerender();
		expect(api).toHaveBeenCalledTimes(1);
		expect(api).toHaveBeenCalledWith(42);
	});
	it('does not query a direct session or a logged out account', () => {
		renderHook(() => useSessionAvatarMembers(undefined, 'account-a'));
		renderHook(() => useSessionAvatarMembers(42, undefined));
		expect(api).not.toHaveBeenCalled();
	});
	it('falls back to the derived avatar if access is forbidden', async () => {
		api.mockRejectedValue({ status: 403 });
		const { result } = renderHook(() =>
			useSessionAvatarMembers(42, 'account-a')
		);
		await act(async () => {});
		expect(result.current).toEqual([]);
	});
	it('hides old chat data immediately and ignores its late response', async () => {
		let resolveOld: (
			value: UserService.Schemas.ChatMembersResponseDTO
		) => void = () => {};
		api.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					resolveOld = resolve;
				})
		);
		api.mockResolvedValue({
			members: [{ _id: '@next:example.org', avatarId: 'fox' }]
		});
		const { result, rerender } = renderHook(
			({ chatId }) => useSessionAvatarMembers(chatId, 'account-a'),
			{ initialProps: { chatId: 42 } }
		);
		rerender({ chatId: 43 });
		expect(result.current).toEqual([]);
		await waitFor(() =>
			expect(result.current[0]?._id).toBe('@next:example.org')
		);
		await act(async () => {
			resolveOld({ members });
		});
		expect(result.current[0]?._id).toBe('@next:example.org');
	});
	it('invalidates loaded metadata when the signed in account changes', async () => {
		const { result, rerender } = renderHook(
			({ accountId }) => useSessionAvatarMembers(42, accountId),
			{ initialProps: { accountId: 'account-a' } }
		);
		await waitFor(() => expect(result.current).toEqual(members));
		api.mockImplementationOnce(() => new Promise(() => {}));
		rerender({ accountId: 'account-b' });
		expect(result.current).toEqual([]);
		expect(api).toHaveBeenCalledTimes(2);
	});
});
