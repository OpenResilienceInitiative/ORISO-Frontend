import { useEffect, useRef } from 'react';
import type { MatrixClientService } from '../services/matrixClientService';
import { startAuthenticatedChatRecovery } from '../services/authenticatedChatRecovery';
import { clearLoginRecoveryPassword } from '../services/loginRecoveryHandoff';
import { setRecoveryRuntimeStatus } from '../services/recoveryReminderState';
import {
	AUTHORITIES,
	hasUserAuthority
} from '../globalState/helpers/stateHelpers';
import type { UserDataInterface } from '../globalState/interfaces/UserDataInterface';
import { isAccountSetupPending } from '../components/twoFactorAuth/accountSetupStep';

/**
 * Set the signed-in account's chat recovery up once its client has synced.
 *
 * Two accounts are held back, for the same reason in different words: nothing
 * may be derived from a credential that is not the account holder's alone.
 *
 * - An anonymous session has no durable identity to recover.
 * - An account still behind the setup gate signed in with the password its
 *   administrator chose. In LOGIN_PASSWORD mode `initializeChatRecovery`
 *   would create the Megolm key backup and seal its recovery key under
 *   exactly that password. Unlike the password itself, that key is never
 *   rotated: a secret the gate exists to retire within minutes would buy
 *   permanent access to the counsellor's encrypted history. The handed-off
 *   password is dropped instead, and the next sign-in — the first with a
 *   password only the counsellor knows — sets recovery up properly.
 *
 * Lives in a hook of its own so the conditions that decide whether it may run
 * at all are testable without mounting the whole authenticated app.
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
	const setupPending = isAccountSetupPending(userData);

	useEffect(() => {
		if (!matrixClientService || !recoveryUserLoaded) return;
		let cancelled = false;
		const unsubscribe = matrixClientService.onSyncStateChange((state) => {
			if (state !== 'PREPARED' && state !== 'SYNCING') return;
			const client = matrixClientService.getClient();
			const userId = client?.getUserId();
			if (!client || !userId || recoveryClients.current.has(client))
				return;
			if (recoveryAnonymous || setupPending) {
				clearLoginRecoveryPassword();
				return;
			}
			try {
				void startAuthenticatedChatRecovery(
					client,
					{
						chatRecoveryMode: recoveryMode,
						chatRecoveryPolicyRevision: recoveryRevision
					},
					recoveryClients.current,
					() => cancelled
				);
			} catch {
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
		setupPending,
		recoveryMode,
		recoveryRevision
	]);
};
