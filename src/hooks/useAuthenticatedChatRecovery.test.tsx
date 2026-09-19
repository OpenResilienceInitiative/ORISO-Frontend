// @vitest-environment jsdom

import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// `vi.mock` is hoisted above this import, so the hook still gets the doubles.
import { useAuthenticatedChatRecovery } from './useAuthenticatedChatRecovery';

const startAuthenticatedChatRecovery = vi.hoisted(() => vi.fn());
const clearLoginRecoveryPassword = vi.hoisted(() => vi.fn());
const setRecoveryRuntimeStatus = vi.hoisted(() => vi.fn());

vi.mock('../services/authenticatedChatRecovery', () => ({
	startAuthenticatedChatRecovery
}));
vi.mock('../services/loginRecoveryHandoff', () => ({
	clearLoginRecoveryPassword
}));
vi.mock('../services/recoveryReminderState', () => ({
	setRecoveryRuntimeStatus
}));

const CONSULTANT = 'AUTHORIZATION_CONSULTANT_DEFAULT';
const ANONYMOUS = 'AUTHORIZATION_ANONYMOUS_DEFAULT';

const createClientService = () => {
	const listeners = new Set<(state: string | null) => void>();
	const client = { getUserId: () => '@counsellor:synthetic' };

	return {
		getClient: () => client,
		onSyncStateChange: (listener: (state: string | null) => void) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		sync: (state: string) => listeners.forEach((l) => l(state))
	};
};

const settled = {
	grantedAuthorities: [CONSULTANT],
	chatRecoveryMode: 'LOGIN_PASSWORD',
	chatRecoveryPolicyRevision: 1,
	passwordChangeRequired: false,
	twoFactorAuth: { isRequired: true, isActive: true }
} as any;

const owesPassword = {
	...settled,
	passwordChangeRequired: true
};

const owesSecondFactor = {
	...settled,
	twoFactorAuth: { isRequired: true, isActive: false }
};

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe('useAuthenticatedChatRecovery', () => {
	it('sets recovery up once the synced account is the counsellor’s own', () => {
		const service = createClientService();

		renderHook(() => useAuthenticatedChatRecovery(service as any, settled));
		service.sync('PREPARED');

		expect(startAuthenticatedChatRecovery).toHaveBeenCalledOnce();
	});

	it('drops the handed-off password for an anonymous session', () => {
		const service = createClientService();

		renderHook(() =>
			useAuthenticatedChatRecovery(service as any, {
				...settled,
				grantedAuthorities: [ANONYMOUS]
			})
		);
		service.sync('PREPARED');

		expect(startAuthenticatedChatRecovery).not.toHaveBeenCalled();
		expect(clearLoginRecoveryPassword).toHaveBeenCalled();
	});

	/**
	 * In LOGIN_PASSWORD mode this seals the Megolm key backup under the
	 * password used to sign in. While the account-setup gate is up that is the
	 * administrator's password — the very secret the gate exists to retire —
	 * and the recovery key sealed under it stays valid for good, so a
	 * transient shared password would become permanent access to the
	 * counsellor's encrypted history. Nothing may be derived from it until the
	 * counsellor has replaced it (#1481).
	 */
	it.each([
		['its own password', owesPassword],
		['a second factor', owesSecondFactor]
	])(
		'derives nothing from the administrator’s password while the account still owes %s',
		(_label, userData) => {
			const service = createClientService();

			renderHook(() =>
				useAuthenticatedChatRecovery(service as any, userData)
			);
			service.sync('PREPARED');

			expect(startAuthenticatedChatRecovery).not.toHaveBeenCalled();
			expect(clearLoginRecoveryPassword).toHaveBeenCalled();
		}
	);

	it('sets recovery up on the next sync once setup is settled', () => {
		const service = createClientService();
		const { rerender } = renderHook(
			({ userData }) =>
				useAuthenticatedChatRecovery(service as any, userData),
			{ initialProps: { userData: owesPassword } }
		);
		service.sync('PREPARED');
		expect(startAuthenticatedChatRecovery).not.toHaveBeenCalled();

		rerender({ userData: settled });
		service.sync('PREPARED');

		expect(startAuthenticatedChatRecovery).toHaveBeenCalledOnce();
	});
});
