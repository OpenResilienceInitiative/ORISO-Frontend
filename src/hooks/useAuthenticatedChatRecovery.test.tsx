// @vitest-environment jsdom

import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// `vi.mock` is hoisted above this import, so the hook still gets the doubles.
import { useAuthenticatedChatRecovery } from './useAuthenticatedChatRecovery';

const startAuthenticatedChatRecovery = vi.hoisted(() => vi.fn());
const clearLoginRecoveryPassword = vi.hoisted(() => vi.fn());
const setRecoveryRuntimeStatus = vi.hoisted(() => vi.fn());
const getRecoveryRuntimeStatus = vi.hoisted(() => vi.fn(() => 'pending'));

vi.mock('../services/authenticatedChatRecovery', () => ({
	startAuthenticatedChatRecovery
}));
vi.mock('../services/loginRecoveryHandoff', () => ({
	clearLoginRecoveryPassword
}));
vi.mock('../services/recoveryReminderState', () => ({
	setRecoveryRuntimeStatus,
	getRecoveryRuntimeStatus
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

beforeEach(() => {
	vi.clearAllMocks();
	getRecoveryRuntimeStatus.mockReturnValue('pending');
	startAuthenticatedChatRecovery.mockReturnValue(Promise.resolve());
});
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

	/**
	 * `startAuthenticatedChatRecovery` returns `Promise<void> | undefined`, so
	 * a synchronous try/catch around it sees only what throws before the
	 * promise exists. `initializeChatRecovery` sets the status to 'pending'
	 * and arms its 45 s deadline BEFORE its own try block, so anything that
	 * throws in that window rejects the returned promise while the deadline
	 * was never armed: nothing would ever move the status off 'pending', and
	 * the rejection would go unhandled.
	 */
	it('reports a rejection that escapes before the service arms its own deadline', async () => {
		const service = createClientService();
		startAuthenticatedChatRecovery.mockReturnValue(
			Promise.reject(new Error('listener exploded'))
		);

		renderHook(() => useAuthenticatedChatRecovery(service as any, settled));
		service.sync('PREPARED');

		await waitFor(() =>
			expect(setRecoveryRuntimeStatus).toHaveBeenCalledWith(
				'@counsellor:synthetic',
				'retryable-failure'
			)
		);
	});

	/**
	 * Every failure that reaches `initializeChatRecovery`'s own try/catch is
	 * handled there and RESOLVES with a status of its own ('busy', or the
	 * specific outcome). Only the narrow pre-try window rejects. Writing the
	 * generic status unconditionally could therefore only ever clobber a
	 * better one, so the handler defers to whatever is already recorded.
	 */
	it('does not overwrite a status the service already committed', async () => {
		const service = createClientService();
		getRecoveryRuntimeStatus.mockReturnValue('busy');
		startAuthenticatedChatRecovery.mockReturnValue(
			Promise.reject(new Error('notification threw after committing'))
		);

		renderHook(() => useAuthenticatedChatRecovery(service as any, settled));
		service.sync('PREPARED');
		await Promise.resolve();
		await Promise.resolve();

		expect(setRecoveryRuntimeStatus).not.toHaveBeenCalled();
	});

	it('says nothing about a session that has already been torn down', async () => {
		const service = createClientService();
		let fail: (error: Error) => void = () => undefined;
		startAuthenticatedChatRecovery.mockReturnValue(
			new Promise<void>((_resolve, reject) => {
				fail = reject;
			})
		);

		const { unmount } = renderHook(() =>
			useAuthenticatedChatRecovery(service as any, settled)
		);
		service.sync('PREPARED');
		unmount();
		fail(new Error('too late'));
		await Promise.resolve();
		await Promise.resolve();

		expect(setRecoveryRuntimeStatus).not.toHaveBeenCalled();
	});

	it('reports a policy it cannot even read', () => {
		const service = createClientService();
		startAuthenticatedChatRecovery.mockImplementation(() => {
			throw new Error('Invalid chat recovery policy');
		});

		renderHook(() => useAuthenticatedChatRecovery(service as any, settled));
		service.sync('PREPARED');

		expect(setRecoveryRuntimeStatus).toHaveBeenCalledWith(
			'@counsellor:synthetic',
			'retryable-failure'
		);
	});
});
