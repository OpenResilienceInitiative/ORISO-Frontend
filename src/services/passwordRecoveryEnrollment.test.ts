// @vitest-environment oriso-jsdom
import type { MatrixClient } from 'matrix-js-sdk';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { InvalidRecoveryKeyError } from './matrixKeyBackupService';
import {
	PasswordRecoveryRepairBlockedError,
	PasswordRecoveryWorkLimitError
} from './matrixPasswordRecoveryService';
import {
	passwordRecoveryEnrollmentErrorKey,
	sealRecoveryKeyUnderPassword
} from './passwordRecoveryEnrollment';
import { RecoverySetupBusyError } from './pendingRecoveryKeyStore';
import {
	clearRecoveryRuntimeState,
	getRecoveryRuntimeStatus
} from './recoveryReminderState';

const enroll = vi.hoisted(() => vi.fn(async (..._args: unknown[]) => {}));
vi.mock('./matrixPasswordRecoveryService', async (importOriginal) => ({
	...((await importOriginal()) as Record<string, unknown>),
	enrollPasswordRecoveryAfterKeyRecovery: enroll
}));

beforeEach(() => {
	enroll.mockClear();
	clearRecoveryRuntimeState();
	localStorage.clear();
});

describe('sealRecoveryKeyUnderPassword', () => {
	it('seals the trimmed key under the given password and reports ready', async () => {
		const client = {} as MatrixClient;
		await sealRecoveryKeyUnderPassword(
			client,
			'@seal:test',
			'new-password',
			'  EsTc key  ',
			4
		);
		expect(enroll).toHaveBeenCalledWith(
			client,
			'new-password',
			'EsTc key',
			4
		);
		expect(getRecoveryRuntimeStatus('@seal:test')).toBe('ready');
	});

	it('leaves the status alone when sealing fails', async () => {
		enroll.mockRejectedValueOnce(new Error('nope'));
		await expect(
			sealRecoveryKeyUnderPassword(
				{} as MatrixClient,
				'@seal:test',
				'p',
				'k',
				1
			)
		).rejects.toThrow('nope');
		expect(getRecoveryRuntimeStatus('@seal:test')).toBe('idle');
	});
});

it.each<[unknown, string]>([
	[new RecoverySetupBusyError(), 'profile.encryption.setup.busy'],
	[new InvalidRecoveryKeyError(), 'profile.encryption.recover.invalidKey'],
	[
		new PasswordRecoveryRepairBlockedError(),
		'encryption.passwordRecovery.repairBlocked'
	],
	[
		new PasswordRecoveryWorkLimitError(),
		'encryption.passwordRecovery.retryable-failure'
	],
	[new Error('x'), 'encryption.passwordRecovery.enrollmentFailed']
])('explains %s', (error, key) => {
	expect(passwordRecoveryEnrollmentErrorKey(error)).toBe(key);
});
