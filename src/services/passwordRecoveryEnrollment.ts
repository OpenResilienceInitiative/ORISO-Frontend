import type { MatrixClient } from 'matrix-js-sdk';
import { InvalidRecoveryKeyError } from './matrixKeyBackupService';
import {
	enrollPasswordRecoveryAfterKeyRecovery,
	PasswordRecoveryRepairBlockedError,
	PasswordRecoveryWorkLimitError
} from './matrixPasswordRecoveryService';
import {
	markPendingRecoveryKeyPasswordProtected,
	RecoverySetupBusyError,
	withRecoverySetupLock
} from './pendingRecoveryKeyStore';
import { setRecoveryRuntimeStatus } from './recoveryReminderState';

/**
 * Seal a recovery key the person already holds under their current login
 * password, so that password unlocks the chat history on a new device. The
 * caller must have proven the password (a sign-in, a re-authentication, or
 * the password change that just set it).
 */
export const sealRecoveryKeyUnderPassword = async (
	client: MatrixClient,
	userId: string,
	password: string,
	encodedRecoveryKey: string,
	policyRevision: number
): Promise<void> => {
	await withRecoverySetupLock(userId, () =>
		enrollPasswordRecoveryAfterKeyRecovery(
			client,
			password,
			encodedRecoveryKey.trim(),
			policyRevision
		)
	);
	markPendingRecoveryKeyPasswordProtected(userId);
	setRecoveryRuntimeStatus(userId, 'ready');
};

/** The i18n key that explains why sealing the recovery key failed. */
export const passwordRecoveryEnrollmentErrorKey = (error: unknown): string =>
	error instanceof RecoverySetupBusyError
		? 'profile.encryption.setup.busy'
		: error instanceof InvalidRecoveryKeyError
			? 'profile.encryption.recover.invalidKey'
			: error instanceof PasswordRecoveryRepairBlockedError
				? 'encryption.passwordRecovery.repairBlocked'
				: error instanceof PasswordRecoveryWorkLimitError
					? 'encryption.passwordRecovery.retryable-failure'
					: 'encryption.passwordRecovery.enrollmentFailed';
