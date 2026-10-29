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

type HoldTokenRefresh = <T>(operation: () => Promise<T>) => Promise<T>;

/** All automatic branches preserve any existing root/backup/enrollment evidence. */
export const initializeChatRecovery = async (
	client: MatrixClient,
	policy: ChatRecoveryPolicy,
	password: string | null,
	cancelled: () => boolean = () => false,
	/** Called synchronously right before a recovery root is committed server-side. */
	onCommit: () => void = () => undefined
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
				if (cancelled()) return;
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
				// Last checkpoint before the commit; nothing awaits in between.
				if (cancelled()) return;
				onCommit();
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
	return cancelled() ? undefined : last;
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
		// Never after a cancel (logout, unmount) or for a replaced client.
		if (
			handoff &&
			!cancelled() &&
			client.clientRunning &&
			(outcome === 'retryable-failure' || outcome === 'busy')
		)
			await restageLoginRecoveryPassword(
				userId,
				handoff.password,
				handoff.expiresAt
			);
	});
};

const DEADLINE = Symbol('first password seal deadline');

/** How long the setup gate's password step waits for the seal before it logs out anyway. */
export const FIRST_PASSWORD_SEAL_TIMEOUT_MS = 30_000;

/**
 * The account-setup gate's password step (#1917): the counsellor has just set their OWN
 * password for the first time, and the server has accepted it. Set recovery up and seal the
 * recovery key under that password now, so the history is sealed even before the next sign-in;
 * that sign-in (with only the second factor owed) then unlocks it with the same password (#1931).
 *
 * Call only after the password change succeeded, and only with the NEW password: the old one is
 * the administrator's, and nothing may ever be sealed under it (#1481).
 *
 * Never rejects. At its deadline a run that has not committed a recovery root yet is stopped at
 * its next checkpoint (no root, no parked key) and a retryable status is returned, so the logout
 * may go on. A run that has already committed one is awaited to the end instead: stopping it, or
 * logging out under it, between setup and enrolment would leave a root without its envelope and
 * the logout would then wipe its only parked key. A failure leaves a retryable status, and the
 * next password sign-in that is past the gate sets recovery up as before.
 */
export const sealRecoveryUnderFirstPassword = async (
	client: MatrixClient,
	policy: ChatRecoveryPolicy,
	newPassword: string,
	holdTokenRefresh: HoldTokenRefresh = (operation) => operation(),
	timeoutMs: number = FIRST_PASSWORD_SEAL_TIMEOUT_MS
): Promise<RecoveryRuntimeStatus | undefined> => {
	const userId = client.getUserId();
	if (policy.mode !== 'LOGIN_PASSWORD' || !userId || !newPassword) return;
	let stopped = false;
	let committing = false;
	let timer: ReturnType<typeof setTimeout> | undefined;
	const giveUp = () => {
		setRecoveryRuntimeStatus(userId, 'retryable-failure');
		return 'retryable-failure' as const;
	};
	try {
		const run = holdTokenRefresh(() =>
			initializeChatRecovery(
				client,
				policy,
				newPassword,
				() => stopped && !committing,
				() => {
					committing = true;
				}
			)
		);
		const deadline = new Promise<typeof DEADLINE>((resolve) => {
			timer = setTimeout(() => resolve(DEADLINE), timeoutMs);
		});
		const first = await Promise.race([run, deadline]);
		if (first !== DEADLINE) return first ?? 'retryable-failure';
		stopped = true;
		if (!committing) {
			// Aborts at its next checkpoint; its eventual settlement is irrelevant.
			run.catch(() => undefined);
			return giveUp();
		}
		return (await run) ?? 'retryable-failure';
	} catch {
		return giveUp();
	} finally {
		clearTimeout(timer);
	}
};
