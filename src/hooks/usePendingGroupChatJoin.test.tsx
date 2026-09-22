// @vitest-environment jsdom

import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// `vi.mock` is hoisted above this import, so the hook still gets the doubles.
import { usePendingGroupChatJoin } from './usePendingGroupChatJoin';

const joinGroupChat = vi.hoisted(() => vi.fn());
const navigate = vi.hoisted(() => vi.fn());
const tenant = vi.hoisted(() => ({ ready: true }));

vi.mock('./useJoinGroupChat', () => ({
	useJoinGroupChat: () => ({ joinGroupChat, tenantReady: tenant.ready })
}));
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));
vi.mock('../components/groupChat/entryRoom/GroupEntryRoom', () => ({
	groupEntryRoomPath: (gcid: string) => `/group/${gcid}`
}));

const CONSULTANT = 'AUTHORIZATION_CONSULTANT_DEFAULT';

const settled = {
	grantedAuthorities: [CONSULTANT],
	passwordChangeRequired: false,
	twoFactorAuth: { isRequired: true, isActive: true }
} as any;

const owesPassword = { ...settled, passwordChangeRequired: true };

const withDeepLink = (gcid = 'gc-synthetic') => {
	window.history.replaceState({}, '', `/?gcid=${gcid}`);
};

beforeEach(() => {
	vi.clearAllMocks();
	tenant.ready = true;
	joinGroupChat.mockResolvedValue(true);
	withDeepLink();
});

afterEach(() => {
	cleanup();
	window.history.replaceState({}, '', '/');
});

describe('usePendingGroupChatJoin', () => {
	it('follows the deep link once the tenant is ready and the account is settled', async () => {
		renderHook(() => usePendingGroupChatJoin(settled));

		await waitFor(() =>
			expect(joinGroupChat).toHaveBeenCalledWith('gc-synthetic')
		);
		await waitFor(() =>
			expect(navigate).toHaveBeenCalledWith('/group/gc-synthetic', {
				replace: true
			})
		);
	});

	it('waits for the tenant before assigning anything', () => {
		tenant.ready = false;

		renderHook(() => usePendingGroupChatJoin(settled));

		expect(joinGroupChat).not.toHaveBeenCalled();
	});

	/**
	 * Joining calls `apiPutGroupChat(gcid, ASSIGN)` — a server-side mutation.
	 * `tenantReady` says nothing about `userData`: the tenant comes from its
	 * own context while the profile arrives with the bootstrap, so `undefined`
	 * is reachable here. `isAccountSetupPending` is deliberately fail-open on
	 * an unknown, which would assign a freshly provisioned account that still
	 * holds the administrator's password.
	 */
	it('does not assign the account before the profile has arrived', () => {
		renderHook(() => usePendingGroupChatJoin(undefined));

		expect(joinGroupChat).not.toHaveBeenCalled();
	});

	it('does not assign the account while setup is still pending', () => {
		renderHook(() => usePendingGroupChatJoin(owesPassword));

		expect(joinGroupChat).not.toHaveBeenCalled();
	});

	// The id is kept, not cleared, on every early return — the deep link still
	// has to work once the session may act on it.
	it.each([
		['the profile arrives', undefined],
		['setup settles', owesPassword]
	])('still follows the link once %s', async (_label, initial) => {
		const { rerender } = renderHook(
			({ userData }) => usePendingGroupChatJoin(userData),
			{ initialProps: { userData: initial as any } }
		);
		expect(joinGroupChat).not.toHaveBeenCalled();

		rerender({ userData: settled });

		await waitFor(() =>
			expect(joinGroupChat).toHaveBeenCalledWith('gc-synthetic')
		);
	});

	it('opens the entry room even when the assignment is refused', async () => {
		joinGroupChat.mockRejectedValue(new Error('CONFLICT'));

		renderHook(() => usePendingGroupChatJoin(settled));

		await waitFor(() =>
			expect(navigate).toHaveBeenCalledWith('/group/gc-synthetic', {
				replace: true
			})
		);
	});
});
