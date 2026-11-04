import type { MatrixClient } from 'matrix-js-sdk';
import { InvalidRecoveryKeyError } from './matrixKeyBackupService';
import {
	enrollPasswordRecoveryAfterKeyRecovery,
	PasswordRecoveryPasswordRejectedError,
	PasswordRecoveryRepairBlockedError,
	PasswordRecoveryRepairRequiredError,
	PasswordRecoveryWorkLimitError,
	resealWithPreviousPassword
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

/**
 * The password was changed outside this app and the recovery key is still sealed under the
 * previous one (#1931): re-wrap it to the current password. The caller must have proven the
 * current password (re-authentication including a required OTP).
 */
export const resealRecoveryWithPreviousPassword = async (
	client: MatrixClient,
	userId: string,
	previousPassword: string,
	currentPassword: string
): Promise<void> => {
	await withRecoverySetupLock(userId, () =>
		resealWithPreviousPassword(client, previousPassword, currentPassword)
	);
	setRecoveryRuntimeStatus(userId, 'ready');
};

/** The i18n key that explains why sealing the recovery key failed. */
export const passwordRecoveryEnrollmentErrorKey = (error: unknown): string =>
	error instanceof PasswordRecoveryPasswordRejectedError
		? 'encryption.passwordRecovery.stale.previousPasswordRejected'
		: error instanceof PasswordRecoveryRepairRequiredError
			? 'encryption.passwordRecovery.repairRequired'
			: error instanceof RecoverySetupBusyError
				? 'profile.encryption.setup.busy'
				: error instanceof InvalidRecoveryKeyError
					? 'profile.encryption.recover.invalidKey'
					: error instanceof PasswordRecoveryRepairBlockedError
						? 'encryption.passwordRecovery.repairBlocked'
						: error instanceof PasswordRecoveryWorkLimitError
							? 'encryption.passwordRecovery.retryable-failure'
							: 'encryption.passwordRecovery.enrollmentFailed';
