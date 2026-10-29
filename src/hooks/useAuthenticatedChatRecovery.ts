import { useEffect, useRef } from 'react';
import type { MatrixClientService } from '../services/matrixClientService';
import { startAuthenticatedChatRecovery } from '../services/authenticatedChatRecovery';
import { clearLoginRecoveryPassword } from '../services/loginRecoveryHandoff';
import {
	getRecoveryRuntimeStatus,
	setRecoveryRuntimeStatus
} from '../services/recoveryReminderState';
import {
	AUTHORITIES,
	hasUserAuthority
} from '../globalState/helpers/stateHelpers';
import type { UserDataInterface } from '../globalState/interfaces/UserDataInterface';
import {
	ACCOUNT_SETUP_STEPS,
	resolveAccountSetupStep
} from '../components/twoFactorAuth/accountSetupStep';

/**
 * Set the signed-in account's chat recovery up once its client has synced.
 *
 * Two accounts are held back, because nothing may be derived from a credential that is not the
 * account holder's alone: an anonymous session has no durable identity, and an account that still
 * owes its own password signed in with the administrator's one-time password. In LOGIN_PASSWORD
 * mode the recovery key would be sealed under that password and is never rotated afterwards, so it
 * is dropped instead and the next sign-in sets recovery up properly (#1481).
 *
 * An account that only owes its second factor is NOT held back: its password is already the
 * person's own — admin-created accounts set it in the Admin onboarding wizard or via
 * forgot-password, because Keycloak refuses the one-time password. Recovery is sealed under it now,
 * while the setup gate keeps blocking the UI until the second factor is enrolled (#1931).
 *
 * A hook of its own so the conditions are testable without mounting the authenticated app.
 */
export const useAuthenticatedChatRecovery = (
	matrixClientService: MatrixClientService | null,
	userData: Partial<UserDataInterface> | undefined
): void => {
	const recoveryClients = useRef(new WeakSet<object>());
	const recoveryMode = userData?.chatRecoveryMode;
	const recoveryRevision = userData?.chatRecoveryPolicyRevision;
	const recoveryAnonymous =
		!!userData &&
		hasUserAuthority(
			AUTHORITIES.ANONYMOUS_DEFAULT,
			userData as UserDataInterface
		);
	const recoveryUserLoaded = !!userData;
	/* Only the password step means the sign-in password is the administrator's. */
	const adminPasswordPending =
		resolveAccountSetupStep(userData) === ACCOUNT_SETUP_STEPS.PASSWORD;

	useEffect(() => {
		if (!matrixClientService || !recoveryUserLoaded) return;
		let cancelled = false;
		const unsubscribe = matrixClientService.onSyncStateChange((state) => {
			if (state !== 'PREPARED' && state !== 'SYNCING') return;
			const client = matrixClientService.getClient();
			const userId = client?.getUserId();
			if (!client || !userId || recoveryClients.current.has(client))
				return;
			if (recoveryAnonymous || adminPasswordPending) {
				clearLoginRecoveryPassword();
				return;
			}
			try {
				const recovery = startAuthenticatedChatRecovery(
					client,
					{
						chatRecoveryMode: recoveryMode,
						chatRecoveryPolicyRevision: recoveryRevision
					},
					recoveryClients.current,
					() => cancelled,
					(operation) =>
						matrixClientService.holdTokenRefreshDuring(operation)
				);
				/* `initializeChatRecovery` sets the status to 'pending' and
				   arms its own 45 s deadline BEFORE its try block, so a throw
				   in that window rejects this promise with the deadline never
				   armed — nothing would move the status off 'pending' again,
				   and the rejection would go unhandled. Every failure that
				   reaches its try IS handled there and resolves with a status
				   of its own, so this handler defers to whatever is already
				   recorded rather than flattening a better answer. */
				void recovery?.catch(() => {
					if (cancelled) return;
					const status = getRecoveryRuntimeStatus(userId);
					if (status === 'idle' || status === 'pending')
						setRecoveryRuntimeStatus(userId, 'retryable-failure');
				});
			} catch {
				/* Synchronous — the policy could not even be read, so nothing
				   of this run's has been recorded yet. */
				setRecoveryRuntimeStatus(userId, 'retryable-failure');
			}
		});
		return () => {
			cancelled = true;
			unsubscribe();
		};
	}, [
		matrixClientService,
		recoveryUserLoaded,
		recoveryAnonymous,
		adminPasswordPending,
		recoveryMode,
		recoveryRevision
	]);
};
