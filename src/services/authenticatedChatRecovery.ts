import { readRecoveryRoot } from './matrixRecoveryAccountData';
import type { MatrixClient } from 'matrix-js-sdk';
import {
	getChatRecoveryPolicy,
	type ChatRecoveryPolicy
} from './chatRecoveryPolicy';
import { consumeLoginRecoveryPassword } from './loginRecoveryHandoff';
import {
	canBootstrapSilently,
	getEncryptionStatus,
	setUpRecovery
} from './matrixKeyBackupService';
import {
	enrollPasswordRecovery,
	hasPasswordRecoveryEvidence,
	recoverWithLoginPassword
} from './matrixPasswordRecoveryService';
import {
	RecoverySetupBusyError,
	getPendingRecoveryKey,
	savePendingRecoveryKey,
	withRecoverySetupLock
} from './pendingRecoveryKeyStore';
import { setRecoveryRuntimeStatus } from './recoveryReminderState';

/** All automatic branches preserve any existing root/backup/enrollment evidence. */
export const initializeChatRecovery = async (
	client: MatrixClient,
	policy: ChatRecoveryPolicy,
	password: string | null,
	cancelled: () => boolean = () => false
): Promise<void> => {
	const userId = client.getUserId();
	if (!userId || cancelled()) return;
	setRecoveryRuntimeStatus(userId, 'pending');
	const deadline = setTimeout(() => {
		if (!cancelled()) setRecoveryRuntimeStatus(userId, 'retryable-failure');
	}, 45000);
	try {
		await withRecoverySetupLock(userId, async () => {
			if (cancelled()) return;
			if (policy.mode === 'LOGIN_PASSWORD' && password) {
				const recovery = await recoverWithLoginPassword(
					client,
					password
				);
				if (recovery.kind !== 'not-enrolled') {
					setRecoveryRuntimeStatus(userId, recovery.kind);
					return;
				}
			}
			// Re-read server state inside the lock; another tab may have completed it.
			let status = await getEncryptionStatus(client);
			let recoveryKey = getPendingRecoveryKey(userId);
			if (cancelled()) return;
			if (
				canBootstrapSilently(status) &&
				!(await readRecoveryRoot(client)) &&
				!(await hasPasswordRecoveryEvidence(client))
			) {
				recoveryKey = await setUpRecovery(client);
				// Setup has committed a root: preserve its only export for this user.
				savePendingRecoveryKey(userId, recoveryKey);
				if (cancelled()) return;
				status = await getEncryptionStatus(client);
			}
			if (cancelled()) return;
			if (policy.mode === 'LOGIN_PASSWORD') {
				if (!password) {
					setRecoveryRuntimeStatus(
						userId,
						status.keyStorageOutOfSync
							? 'needs-recovery-key'
							: status.secretStorageReady ||
								  (status.serverBackupExists &&
										status.crossSigningReady &&
										status.activeBackupVersion !== null)
								? 'device-ready'
								: 'needs-password'
					);
					return;
				}
				if (!recoveryKey) {
					setRecoveryRuntimeStatus(userId, 'needs-recovery-key');
					return;
				}
				await enrollPasswordRecovery(
					client,
					password,
					recoveryKey,
					policy.revision
				);
				setRecoveryRuntimeStatus(userId, 'ready');
			} else {
				setRecoveryRuntimeStatus(
					userId,
					status.keyStorageOutOfSync
						? 'needs-recovery-key'
						: status.secretStorageReady
							? 'ready'
							: 'retryable-failure'
				);
			}
		});
	} catch (error) {
		if (!cancelled())
			setRecoveryRuntimeStatus(
				userId,
				error instanceof RecoverySetupBusyError
					? 'busy'
					: 'retryable-failure'
			);
	} finally {
		clearTimeout(deadline);
	}
};

/** Validate before claiming this client or consuming its one-use credential. */
export const startAuthenticatedChatRecovery = (
	client: MatrixClient,
	account: Parameters<typeof getChatRecoveryPolicy>[0],
	claimedClients: WeakSet<object>,
	cancelled: () => boolean = () => false
): Promise<void> | undefined => {
	if (claimedClients.has(client) || !client.getUserId() || cancelled())
		return;
	const policy = getChatRecoveryPolicy(account);
	claimedClients.add(client);
	return initializeChatRecovery(
		client,
		policy,
		consumeLoginRecoveryPassword(client.getUserId()!),
		cancelled
	);
};
