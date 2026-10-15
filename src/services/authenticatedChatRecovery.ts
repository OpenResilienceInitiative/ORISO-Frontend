import { readRecoveryRoot } from './matrixRecoveryAccountData';
import type { MatrixClient } from 'matrix-js-sdk';
import {
	getChatRecoveryPolicy,
	type ChatRecoveryPolicy
} from './chatRecoveryPolicy';
import {
	consumeLoginRecoveryHandoff,
	restageLoginRecoveryPassword
} from './loginRecoveryHandoff';
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
	loadPendingRecoveryKey,
	markPendingRecoveryKeyPasswordProtected,
	savePendingRecoveryKey,
	withRecoverySetupLock
} from './pendingRecoveryKeyStore';
import {
	setRecoveryRuntimeStatus,
	type RecoveryRuntimeStatus
} from './recoveryReminderState';

/** All automatic branches preserve any existing root/backup/enrollment evidence. */
export const initializeChatRecovery = async (
	client: MatrixClient,
	policy: ChatRecoveryPolicy,
	password: string | null,
	cancelled: () => boolean = () => false
): Promise<RecoveryRuntimeStatus | undefined> => {
	const userId = client.getUserId();
	if (!userId || cancelled()) return;
	let last: RecoveryRuntimeStatus = 'pending';
	const report = (status: RecoveryRuntimeStatus) => {
		last = status;
		setRecoveryRuntimeStatus(userId, status);
	};
	report('pending');
	const deadline = setTimeout(() => {
		if (!cancelled()) report('retryable-failure');
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
					if (recovery.kind === 'ready') {
						await loadPendingRecoveryKey(userId);
						markPendingRecoveryKeyPasswordProtected(userId);
					}
					report(recovery.kind);
					return;
				}
			}
			// Re-read server state inside the lock; another tab may have completed it.
			let status = await getEncryptionStatus(client);
			let recoveryKey = await loadPendingRecoveryKey(userId);
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
					// Enrolled: the next sign-in unlocks it, no key needed (#1741).
					if (
						status.keyStorageOutOfSync &&
						(await hasPasswordRecoveryEvidence(client))
					) {
						report('needs-sign-in');
						return;
					}
					report(
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
					report('needs-recovery-key');
					return;
				}
				await enrollPasswordRecovery(
					client,
					password,
					recoveryKey,
					policy.revision
				);
				markPendingRecoveryKeyPasswordProtected(userId);
				report('ready');
			} else {
				report(
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
			report(
				error instanceof RecoverySetupBusyError
					? 'busy'
					: 'retryable-failure'
			);
	} finally {
		clearTimeout(deadline);
	}
	return last;
};

/** Validate before claiming this client or consuming its one-use credential. */
export const startAuthenticatedChatRecovery = (
	client: MatrixClient,
	account: Parameters<typeof getChatRecoveryPolicy>[0],
	claimedClients: WeakSet<object>,
	cancelled: () => boolean = () => false,
	holdTokenRefresh: <T>(operation: () => Promise<T>) => Promise<T> = (
		operation
	) => operation()
): Promise<void> | undefined => {
	if (claimedClients.has(client) || !client.getUserId() || cancelled())
		return;
	const policy = getChatRecoveryPolicy(account);
	// Claimed synchronously, before the hold may wait: a second sync must not start it again.
	claimedClients.add(client);
	// Held: a token refresh would replace the client while keys are imported or bootstrapped.
	return holdTokenRefresh(async () => {
		// Replaced by a refresh while waiting: the replacement client runs its own recovery.
		if (!client.clientRunning) return;
		const userId = client.getUserId()!;
		const handoff = await consumeLoginRecoveryHandoff(userId);
		const outcome = await initializeChatRecovery(
			client,
			policy,
			handoff?.password ?? null,
			cancelled
		);
		// Unfinished, not rejected: keep the password for a retry (#1741).
		if (handoff && (outcome === 'retryable-failure' || outcome === 'busy'))
			await restageLoginRecoveryPassword(
				userId,
				handoff.password,
				handoff.expiresAt
			);
	});
};
