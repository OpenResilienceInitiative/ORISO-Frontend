// @vitest-environment jsdom

import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// `vi.mock` is hoisted above this import, so the hook still gets the doubles.
import { usePendingGroupChatJoin } from './usePendingGroupChatJoin';
import {
	forgetGroupInviteToken,
	groupInviteTokenFor
} from '../components/groupChat/groupInviteTokenMemory';

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
const ASKER = 'AUTHORIZATION_USER_DEFAULT';

const settled = {
	grantedAuthorities: [ASKER],
	passwordChangeRequired: false,
	twoFactorAuth: { isRequired: false, isActive: false }
} as any;

const owesPassword = { ...settled, passwordChangeRequired: true };

const settledCounsellor = {
	grantedAuthorities: [CONSULTANT],
	passwordChangeRequired: false,
	twoFactorAuth: { isRequired: true, isActive: true }
} as any;

const counsellorOwesPassword = {
	...settledCounsellor,
	passwordChangeRequired: true
};
const counsellorOwesSecondFactor = {
	...settledCounsellor,
	twoFactorAuth: { isRequired: true, isActive: false }
};

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

	it('opens the entry room of the group number, not of the whole invite id (#1237)', async () => {
		withDeepLink('19.Ab3_x-Yz');
		renderHook(() => usePendingGroupChatJoin(settled));

		await waitFor(() =>
			expect(joinGroupChat).toHaveBeenCalledWith('19.Ab3_x-Yz')
		);
		await waitFor(() =>
			expect(navigate).toHaveBeenCalledWith('/group/19', {
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

	/**
	 * #1499: a counsellor, the group's own moderator included, landed in the
	 * client's entry room — the assignment is a client action (404 for her)
	 * and both branches opened `/groups/<id>/entry`. Her room is the group in
	 * her own session view.
	 */
	describe('for a counsellor', () => {
		it('opens the group in the counsellor session view without assigning', async () => {
			withDeepLink('42');

			renderHook(() => usePendingGroupChatJoin(settledCounsellor));

			await waitFor(() =>
				expect(navigate).toHaveBeenCalledWith(
					'/sessions/consultant/sessionView/session/42',
					{ replace: true }
				)
			);
			expect(joinGroupChat).not.toHaveBeenCalled();
			expect(navigate).toHaveBeenCalledTimes(1);
		});

		it.each([
			['owes a new password', counsellorOwesPassword],
			[
				'still has to set up the second factor',
				counsellorOwesSecondFactor
			],
			['has no profile yet', undefined]
		])(
			'leaves the account-setup gate in front while she %s',
			(_label, userData) => {
				withDeepLink('42');

				renderHook(() => usePendingGroupChatJoin(userData));

				expect(navigate).not.toHaveBeenCalled();
				expect(joinGroupChat).not.toHaveBeenCalled();
			}
		);

		it('still opens the group once her setup settles', async () => {
			withDeepLink('42');
			const { rerender } = renderHook(
				({ userData }) => usePendingGroupChatJoin(userData),
				{ initialProps: { userData: counsellorOwesPassword as any } }
			);
			expect(navigate).not.toHaveBeenCalled();

			rerender({ userData: settledCounsellor });

			await waitFor(() =>
				expect(navigate).toHaveBeenCalledWith(
					'/sessions/consultant/sessionView/session/42',
					{ replace: true }
				)
			);
		});

		/* Knock to join (#1499 item 14) needs the link's token; she carries
		   it from the login redirect into her session view. */
		it('opens the group of an invite id with token and keeps the token for a knock', async () => {
			forgetGroupInviteToken(42);
			withDeepLink('42.tok_EN-9');

			renderHook(() => usePendingGroupChatJoin(settledCounsellor));

			await waitFor(() =>
				expect(navigate).toHaveBeenCalledWith(
					'/sessions/consultant/sessionView/session/42',
					{ replace: true }
				)
			);
			expect(groupInviteTokenFor(42)).toBe('tok_EN-9');
			expect(joinGroupChat).not.toHaveBeenCalled();
		});

		it('keeps no token for a link without one', async () => {
			forgetGroupInviteToken(42);
			withDeepLink('42');

			renderHook(() => usePendingGroupChatJoin(settledCounsellor));

			await waitFor(() => expect(navigate).toHaveBeenCalled());
			expect(groupInviteTokenFor(42)).toBeUndefined();
		});

		// The id comes from the address bar; only a chat id becomes a route.
		it('ignores a link whose group id is not a number', () => {
			withDeepLink('..%2Fadmin');

			renderHook(() => usePendingGroupChatJoin(settledCounsellor));

			expect(navigate).not.toHaveBeenCalled();
			expect(joinGroupChat).not.toHaveBeenCalled();
		});
	});
});
