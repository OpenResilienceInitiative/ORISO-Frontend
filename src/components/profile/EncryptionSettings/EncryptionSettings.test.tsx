// @vitest-environment oriso-jsdom
import {
	PasswordRecoveryPasswordRejectedError,
	PasswordRecoveryWorkLimitError
} from '../../../services/matrixPasswordRecoveryService';
import { reauthenticateRecovery } from '../../../services/reauthenticateRecovery';
import * as React from 'react';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
import type { MatrixClient } from 'matrix-js-sdk';
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';
import type { EncryptionSetupStatus } from '../../../services/matrixKeyBackupService';
import {
	beginRecoverySetup,
	getPendingRecoveryKey,
	resetPendingRecoveryKeyCacheForTests,
	savePendingRecoveryKey
} from '../../../services/pendingRecoveryKeyStore';
import {
	setRecoveryRuntimeStatus,
	clearRecoveryRuntimeState,
	type RecoveryRuntimeStatus
} from '../../../services/recoveryReminderState';
import { EncryptionSettingsPanel } from './index';
import { UserDataContext } from '../../../globalState';

const setUpRecovery = vi.hoisted(() =>
	vi.fn().mockResolvedValue('test-recovery-key')
);
const getEncryptionStatus = vi.hoisted(() => vi.fn());
const enrollAfterRecovery = vi.hoisted(() => vi.fn());
const hasEvidence = vi.hoisted(() => vi.fn(async () => true));
const resealWithPrevious = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock(
	'../../../services/matrixPasswordRecoveryService',
	async (importOriginal) => ({
		...(await importOriginal<
			typeof import('../../../services/matrixPasswordRecoveryService')
		>()),
		enrollPasswordRecoveryAfterKeyRecovery: enrollAfterRecovery,
		hasPasswordRecoveryEvidence: hasEvidence,
		resealWithPreviousPassword: resealWithPrevious
	})
);
vi.mock('../../../services/reauthenticateRecovery', () => ({
	reauthenticateRecovery: vi.fn(async () => undefined)
}));

vi.mock('react-i18next', () => ({
	useTranslation: () => {
		const catalogue: Record<string, string> = {
			'profile.encryption.setup.cta': 'Ersatzschlüssel einrichten',
			'profile.encryption.showKey.confirmLabel':
				'Ich habe den Schlüssel sicher gespeichert.',
			'profile.encryption.showKey.copy': 'Schlüssel kopieren',
			'profile.encryption.showKey.done': 'Fertig',
			'profile.encryption.unavailable':
				'Die Verschlüsselungseinstellungen sind gerade nicht verfügbar. Bitte laden Sie die Seite neu.',
			'profile.encryption.recover.inputLabel': 'Ersatzschlüssel',
			'profile.encryption.recover.cta': 'Verlauf wiederherstellen',
			'profile.encryption.showKey.silentExplainer':
				'Ihr Ersatzschlüssel wurde beim Anmelden automatisch eingerichtet.',
			'profile.encryption.setup.busy':
				'Ihr Ersatzschlüssel wird gerade schon eingerichtet — in einem anderen Tab oder im Hintergrund.'
		};
		return {
			t: (key: string) => catalogue[key] ?? key
		};
	}
}));

vi.mock('lottie-react', () => ({ default: () => null }));

vi.mock('../../../services/matrixKeyBackupService', async (importOriginal) => {
	const actual =
		await importOriginal<
			typeof import('../../../services/matrixKeyBackupService')
		>();
	return { ...actual, setUpRecovery, getEncryptionStatus };
});

const notSetUp: EncryptionSetupStatus = {
	secretStorageReady: false,
	crossSigningReady: false,
	activeBackupVersion: null,
	serverBackupExists: false,
	keyStorageOutOfSync: false
};

const outOfSync: EncryptionSetupStatus = {
	secretStorageReady: false,
	crossSigningReady: false,
	activeBackupVersion: null,
	serverBackupExists: true,
	keyStorageOutOfSync: true
};

const healthy: EncryptionSetupStatus = {
	secretStorageReady: true,
	crossSigningReady: true,
	activeBackupVersion: '3',
	serverBackupExists: true,
	keyStorageOutOfSync: false
};

const UNAVAILABLE_TEXT =
	'Die Verschlüsselungseinstellungen sind gerade nicht verfügbar. Bitte laden Sie die Seite neu.';

describe('EncryptionSettingsPanel', () => {
	afterEach(cleanup);

	it('keeps typed recovery input when its surrounding group rerenders', () => {
		const client = {} as MatrixClient;
		const { rerender } = render(
			<EncryptionSettingsPanel
				clientOverride={client}
				initialStatusOverride={outOfSync}
				showHeading={false}
			/>
		);
		const input = screen.getByRole('textbox', { name: 'Ersatzschlüssel' });
		fireEvent.change(input, {
			target: { value: 'unfinished recovery key' }
		});
		rerender(
			<EncryptionSettingsPanel
				clientOverride={client}
				initialStatusOverride={outOfSync}
				showHeading={false}
			/>
		);
		expect(
			(
				screen.getByRole('textbox', {
					name: 'Ersatzschlüssel'
				}) as HTMLInputElement
			).value
		).toBe('unfinished recovery key');
		expect(
			screen.queryByRole('heading', { name: 'profile.encryption.title' })
		).toBeNull();
	});

	it('uses the shared M3 checkbox for recovery-key confirmation', async () => {
		render(
			<EncryptionSettingsPanel
				clientOverride={{} as MatrixClient}
				initialStatusOverride={notSetUp}
			/>
		);

		fireEvent.click(
			screen.getByRole('button', {
				name: 'Ersatzschlüssel einrichten'
			})
		);

		const checkbox = await screen.findByRole('checkbox', {
			name: 'Ich habe den Schlüssel sicher gespeichert.'
		});
		expect(checkbox.closest('label')?.classList).toContain('m3Checkbox');
		for (const name of ['Schlüssel kopieren', 'Fertig']) {
			expect(
				screen.getByRole('button', { name }).closest('.button__wrapper')
					?.classList
			).toContain('encryptionSettings__fullWidthAction');
		}

		fireEvent.click(checkbox);
		expect((checkbox as HTMLInputElement).checked).toBe(true);
	});

	it('shows the unavailable state when setup has no ready client', async () => {
		render(
			<EncryptionSettingsPanel
				clientOverride={null}
				initialStatusOverride={notSetUp}
			/>
		);

		fireEvent.click(
			screen.getByRole('button', {
				name: 'Ersatzschlüssel einrichten'
			})
		);

		expect(await screen.findByText(UNAVAILABLE_TEXT)).toBeTruthy();
	});

	it('shows the unavailable state when recovery has no ready client', async () => {
		render(
			<EncryptionSettingsPanel
				clientOverride={null}
				initialStatusOverride={outOfSync}
			/>
		);

		fireEvent.change(screen.getByLabelText('Ersatzschlüssel'), {
			target: { value: 'recovery-key' }
		});
		fireEvent.click(
			screen.getByRole('button', { name: 'Verlauf wiederherstellen' })
		);

		expect(await screen.findByText(UNAVAILABLE_TEXT)).toBeTruthy();
	});

	describe('recovery key parked by the silent setup (#839 follow-up)', () => {
		const USER_ID = '@abe.simpson:example.org';
		const PARKED_KEY = 'EsTc 1111 2222 3333 4444';
		const clientWithUser = { getUserId: () => USER_ID } as MatrixClient;

		beforeEach(() => {
			localStorage.clear();
			resetPendingRecoveryKeyCacheForTests();
			getEncryptionStatus.mockReset();
			setUpRecovery.mockClear();
		});

		it('shows the key the background setup generated', async () => {
			savePendingRecoveryKey(USER_ID, PARKED_KEY);
			getEncryptionStatus.mockResolvedValue(healthy);

			render(<EncryptionSettingsPanel clientOverride={clientWithUser} />);

			expect(await screen.findByText(PARKED_KEY)).toBeTruthy();
			expect(screen.getByText(/automatisch eingerichtet/i)).toBeTruthy();
		});

		it('forgets the key once the user confirms they stored it', async () => {
			savePendingRecoveryKey(USER_ID, PARKED_KEY);
			getEncryptionStatus.mockResolvedValue(healthy);

			render(<EncryptionSettingsPanel clientOverride={clientWithUser} />);

			fireEvent.click(
				await screen.findByRole('checkbox', {
					name: 'Ich habe den Schlüssel sicher gespeichert.'
				})
			);
			fireEvent.click(screen.getByRole('button', { name: 'Fertig' }));

			await waitFor(() =>
				expect(getPendingRecoveryKey(USER_ID)).toBeNull()
			);
			expect(screen.queryByText(PARKED_KEY)).toBeNull();
		});

		it('keeps a manually created key across a reload until it is confirmed', async () => {
			getEncryptionStatus.mockResolvedValue(notSetUp);
			const firstVisit = render(
				<EncryptionSettingsPanel clientOverride={clientWithUser} />
			);

			fireEvent.click(
				await screen.findByRole('button', {
					name: 'Ersatzschlüssel einrichten'
				})
			);
			expect(await screen.findByText('test-recovery-key')).toBeTruthy();
			firstVisit.unmount();

			render(<EncryptionSettingsPanel clientOverride={clientWithUser} />);

			expect(await screen.findByText('test-recovery-key')).toBeTruthy();
		});

		it('refuses to set up a second time while another tab is at it', async () => {
			getEncryptionStatus.mockResolvedValue(notSetUp);
			// The background bootstrap (or another tab) holds the lock.
			beginRecoverySetup(USER_ID);

			render(<EncryptionSettingsPanel clientOverride={clientWithUser} />);
			fireEvent.click(
				await screen.findByRole('button', {
					name: 'Ersatzschlüssel einrichten'
				})
			);

			expect(
				await screen.findByText(/gerade schon eingerichtet/i)
			).toBeTruthy();
			expect(setUpRecovery).not.toHaveBeenCalled();
		});

		it('asks for the recovery key first when this device is out of sync', async () => {
			savePendingRecoveryKey(USER_ID, PARKED_KEY);
			getEncryptionStatus.mockResolvedValue(outOfSync);

			render(<EncryptionSettingsPanel clientOverride={clientWithUser} />);

			expect(
				await screen.findByLabelText('Ersatzschlüssel')
			).toBeTruthy();
			expect(screen.queryByText(PARKED_KEY)).toBeNull();
		});
	});
});

it('preserves password and OTP autofill and mismatch blocking with shared form controls', async () => {
	const userId = '@form:test';
	setRecoveryRuntimeStatus(userId, 'needs-password');
	savePendingRecoveryKey(userId, 'synthetic-form-key');
	getEncryptionStatus.mockResolvedValue(healthy);
	render(
		<UserDataContext.Provider
			value={
				{
					userData: {
						chatRecoveryMode: 'LOGIN_PASSWORD',
						chatRecoveryPolicyRevision: 1,
						twoFactorAuth: { isActive: true }
					}
				} as any
			}
		>
			<EncryptionSettingsPanel
				clientOverride={{ getUserId: () => userId } as MatrixClient}
			/>
		</UserDataContext.Provider>
	);
	const password = await screen.findByLabelText(
		'encryption.passwordRecovery.loginPassword'
	);
	const repeat = screen.getByLabelText(
		'encryption.passwordRecovery.repeatPassword'
	);
	const otp = screen.getByLabelText('encryption.passwordRecovery.otp');
	expect(password.getAttribute('autocomplete')).toBe('current-password');
	expect(otp.getAttribute('autocomplete')).toBe('one-time-code');
	expect(otp.getAttribute('inputmode')).toBe('numeric');
	const submit = screen.getByRole('button', {
		name: 'encryption.passwordRecovery.enroll'
	}) as HTMLButtonElement;
	expect(submit.disabled).toBe(true);
	fireEvent.change(password, { target: { value: 'synthetic-password' } });
	expect(submit.disabled).toBe(true);
	fireEvent.change(repeat, { target: { value: 'different-password' } });
	expect(submit.disabled).toBe(true);
	expect(repeat.getAttribute('aria-invalid')).toBe('true');
	expect(
		screen.getByText('registration.account.repeatPassword.error')
	).toBeTruthy();
	fireEvent.change(repeat, { target: { value: 'synthetic-password' } });
	expect(submit.disabled).toBe(false);
	expect(repeat.getAttribute('aria-invalid')).toBe('false');
	expect(
		screen.queryByText('registration.account.repeatPassword.error')
	).toBeNull();
	const form = password.closest('form')!;
	const requestSubmit = vi
		.spyOn(form, 'requestSubmit')
		.mockImplementation(() => {});
	fireEvent.click(submit);
	expect(requestSubmit).toHaveBeenCalledOnce();
	requestSubmit.mockRestore();
});

afterEach(() => {
	cleanup();
	clearRecoveryRuntimeState();
	localStorage.clear();
	resetPendingRecoveryKeyCacheForTests();
});
it.each([
	'idle',
	'pending',
	'busy',
	'device-ready',
	'needs-sign-in',
	'needs-recovery-key',
	'retryable-failure'
] as RecoveryRuntimeStatus[])(
	'shows the actual runtime status %s without a premature logout action',
	async (status) => {
		const userId = '@status:test';
		getEncryptionStatus.mockResolvedValue(healthy);
		setRecoveryRuntimeStatus(userId, status);
		render(
			<UserDataContext.Provider
				value={
					{
						userData: {
							chatRecoveryMode: 'LOGIN_PASSWORD',
							chatRecoveryPolicyRevision: 1
						}
					} as any
				}
			>
				<EncryptionSettingsPanel
					clientOverride={{ getUserId: () => userId } as MatrixClient}
				/>
			</UserDataContext.Provider>
		);
		expect(
			await screen.findByText('encryption.passwordRecovery.' + status)
		).toBeTruthy();
		if (['idle', 'pending', 'busy'].includes(status)) {
			expect(
				screen.queryByText('encryption.passwordRecovery.reauthenticate')
			).toBeNull();
			expect(
				screen.queryByLabelText(
					'encryption.passwordRecovery.loginPassword'
				)
			).toBeNull();
		}
	}
);

it.each(['busy', 'work-limit'])(
	'reports enrollment %s without blaming the password or OTP',
	async (kind) => {
		const userId = '@enroll-busy:test';
		setRecoveryRuntimeStatus(userId, 'needs-password');
		savePendingRecoveryKey(userId, 'synthetic-key');
		getEncryptionStatus.mockResolvedValue(healthy);
		if (kind === 'busy') beginRecoverySetup(userId);
		else
			enrollAfterRecovery.mockRejectedValueOnce(
				new PasswordRecoveryWorkLimitError()
			);
		render(
			<UserDataContext.Provider
				value={
					{
						userData: {
							chatRecoveryMode: 'LOGIN_PASSWORD',
							chatRecoveryPolicyRevision: 1
						}
					} as any
				}
			>
				<EncryptionSettingsPanel
					clientOverride={{ getUserId: () => userId } as MatrixClient}
				/>
			</UserDataContext.Provider>
		);
		const password = await screen.findByLabelText(
			'encryption.passwordRecovery.loginPassword'
		);
		fireEvent.change(password, { target: { value: 'synthetic-password' } });
		fireEvent.change(
			screen.getByLabelText('encryption.passwordRecovery.repeatPassword'),
			{ target: { value: 'synthetic-password' } }
		);
		fireEvent.submit(password.closest('form')!);
		expect(
			await screen.findByText(
				kind === 'busy'
					? /gerade schon eingerichtet/
					: 'encryption.passwordRecovery.retryable-failure'
			)
		).toBeTruthy();
		expect(
			screen.queryByText('encryption.passwordRecovery.enrollmentFailed')
		).toBeNull();
	}
);

/**
 * #1917: recovery works on this device, but nothing is sealed under the
 * password (set up with the recovery key only, or a password change whose
 * follow-up step was skipped). The panel used to show a status and a logout
 * button only — enrolment needed a freshly generated key. It must say what is
 * missing and take the recovery key the person already holds.
 */
describe('password recovery without any envelope', () => {
	const userId = '@no-envelope:test';
	const client = { getUserId: () => userId } as MatrixClient;
	const renderPanel = () =>
		render(
			<UserDataContext.Provider
				value={
					{
						userData: {
							chatRecoveryMode: 'LOGIN_PASSWORD',
							chatRecoveryPolicyRevision: 3
						}
					} as any
				}
			>
				<EncryptionSettingsPanel clientOverride={client} />
			</UserDataContext.Provider>
		);

	beforeEach(() => {
		enrollAfterRecovery.mockReset();
		hasEvidence.mockReset();
		hasEvidence.mockResolvedValue(false);
		getEncryptionStatus.mockResolvedValue(healthy);
	});
	afterEach(() => hasEvidence.mockResolvedValue(true));

	it.each(['needs-recovery-key', 'device-ready', 'needs-password'] as const)(
		'says it is not set up and offers enrolment with the existing key (%s)',
		async (status) => {
			setRecoveryRuntimeStatus(userId, status);
			renderPanel();

			expect(
				await screen.findByText(
					'encryption.passwordRecovery.notEnrolled'
				)
			).toBeTruthy();
			expect(
				screen.getByRole('textbox', { name: 'Ersatzschlüssel' })
			).toBeTruthy();
			expect(
				screen.getByLabelText(
					'encryption.passwordRecovery.loginPassword'
				)
			).toBeTruthy();
		}
	);

	it('seals the typed recovery key under the current password', async () => {
		setRecoveryRuntimeStatus(userId, 'needs-recovery-key');
		renderPanel();
		const key = await screen.findByRole('textbox', {
			name: 'Ersatzschlüssel'
		});
		const submit = screen.getByRole('button', {
			name: 'encryption.passwordRecovery.enroll'
		}) as HTMLButtonElement;
		const password = screen.getByLabelText(
			'encryption.passwordRecovery.loginPassword'
		);
		fireEvent.change(password, { target: { value: 'synthetic-password' } });
		fireEvent.change(
			screen.getByLabelText('encryption.passwordRecovery.repeatPassword'),
			{ target: { value: 'synthetic-password' } }
		);
		expect(submit.disabled).toBe(true);
		fireEvent.change(key, { target: { value: ' EsTc typed key ' } });
		expect(submit.disabled).toBe(false);

		fireEvent.submit(password.closest('form')!);

		await waitFor(() =>
			expect(enrollAfterRecovery).toHaveBeenCalledWith(
				client,
				'synthetic-password',
				'EsTc typed key',
				3
			)
		);
		expect(
			await screen.findByText('encryption.passwordRecovery.ready')
		).toBeTruthy();
	});

	it('offers no enrolment of a new envelope when one exists', async () => {
		hasEvidence.mockResolvedValue(true);
		setRecoveryRuntimeStatus(userId, 'needs-recovery-key');
		renderPanel();

		expect(
			await screen.findByText(
				'encryption.passwordRecovery.needs-recovery-key'
			)
		).toBeTruthy();
		expect(
			screen.queryByText('encryption.passwordRecovery.notEnrolled')
		).toBeNull();
		expect(
			screen.queryByRole('button', {
				name: 'encryption.passwordRecovery.enroll'
			})
		).toBeNull();
	});
});

/**
 * #1931: the password was changed outside the Frontend (Admin "Mein Konto",
 * forgot-password, a setup link). The sign-in password opens none of the
 * existing copies, so the status is 'needs-recovery-key' although an envelope
 * exists. The panel used to show only that status and a logout button; it now
 * offers both ways back to a seal under the current password.
 */
describe('an envelope sealed under the previous password', () => {
	const userId = '@stale:test';
	const client = { getUserId: () => userId } as MatrixClient;
	const renderPanel = (status: EncryptionSetupStatus = healthy) => {
		getEncryptionStatus.mockResolvedValue(status);
		return render(
			<UserDataContext.Provider
				value={
					{
						userData: {
							chatRecoveryMode: 'LOGIN_PASSWORD',
							chatRecoveryPolicyRevision: 5,
							twoFactorAuth: { isActive: true }
						}
					} as any
				}
			>
				<EncryptionSettingsPanel clientOverride={client} />
			</UserDataContext.Provider>
		);
	};
	const choose = async (method: 'usePreviousPassword' | 'useRecoveryKey') =>
		fireEvent.click(
			await screen.findByLabelText(
				`encryption.passwordRecovery.stale.${method}`
			)
		);
	const fill = (label: string, value: string) =>
		fireEvent.change(screen.getByLabelText(label), { target: { value } });
	const submit = () =>
		fireEvent.click(
			screen.getByRole('button', {
				name: 'encryption.passwordRecovery.stale.submit'
			})
		);

	beforeEach(() => {
		hasEvidence.mockResolvedValue(true);
		enrollAfterRecovery.mockReset();
		resealWithPrevious.mockReset();
		vi.mocked(reauthenticateRecovery).mockReset();
		setRecoveryRuntimeStatus(userId, 'needs-recovery-key');
	});

	it.each([
		['this device holds the history', healthy],
		['this device is out of sync', outOfSync]
	])('explains both ways back when %s', async (_label, status) => {
		renderPanel(status);

		expect(
			await screen.findByText(
				'encryption.passwordRecovery.stale.explanation'
			)
		).toBeTruthy();
		expect(
			screen.getByLabelText(
				'encryption.passwordRecovery.stale.usePreviousPassword'
			)
		).toBeTruthy();
		expect(
			screen.getByLabelText(
				'encryption.passwordRecovery.stale.useRecoveryKey'
			)
		).toBeTruthy();
		// One recovery-key entry only: the repair's, which re-seals as well.
		expect(
			screen.queryByRole('button', { name: 'Verlauf wiederherstellen' })
		).toBeNull();
		expect(
			screen.queryByText('encryption.passwordRecovery.reauthenticate')
		).toBeNull();
	});

	it('re-wraps with the previous password once the current one is proven', async () => {
		renderPanel();
		await choose('usePreviousPassword');
		fill(
			'encryption.passwordRecovery.stale.previousPassword',
			'previous-pw'
		);
		fill('encryption.passwordRecovery.loginPassword', 'current-pw');
		fill('encryption.passwordRecovery.otp', '123456');
		submit();

		await waitFor(() =>
			expect(resealWithPrevious).toHaveBeenCalledWith(
				client,
				'previous-pw',
				'current-pw'
			)
		);
		expect(reauthenticateRecovery).toHaveBeenCalledWith(
			'current-pw',
			'123456'
		);
		expect(
			vi.mocked(reauthenticateRecovery).mock.invocationCallOrder[0]
		).toBeLessThan(resealWithPrevious.mock.invocationCallOrder[0]);
		expect(
			await screen.findByText('encryption.passwordRecovery.ready')
		).toBeTruthy();
		expect(
			screen.queryByText('encryption.passwordRecovery.stale.explanation')
		).toBeNull();
		expect(enrollAfterRecovery).not.toHaveBeenCalled();
	});

	it('says so when the previous password opens nothing either', async () => {
		resealWithPrevious.mockRejectedValueOnce(
			new PasswordRecoveryPasswordRejectedError()
		);
		renderPanel();
		await choose('usePreviousPassword');
		fill('encryption.passwordRecovery.stale.previousPassword', 'wrong-pw');
		fill('encryption.passwordRecovery.loginPassword', 'current-pw');
		submit();

		expect(
			await screen.findByText(
				'encryption.passwordRecovery.stale.previousPasswordRejected'
			)
		).toBeTruthy();
		expect(
			screen.getByText('encryption.passwordRecovery.needs-recovery-key')
		).toBeTruthy();
	});

	it('re-seals nothing when the current password is not proven', async () => {
		vi.mocked(reauthenticateRecovery).mockRejectedValueOnce(
			new Error('invalid_grant')
		);
		renderPanel();
		await choose('usePreviousPassword');
		fill(
			'encryption.passwordRecovery.stale.previousPassword',
			'previous-pw'
		);
		fill('encryption.passwordRecovery.loginPassword', 'not-current');
		submit();

		expect(
			await screen.findByText(
				'encryption.passwordRecovery.enrollmentFailed'
			)
		).toBeTruthy();
		expect(resealWithPrevious).not.toHaveBeenCalled();
	});

	it('replaces the stale copies with the recovery key under the current password', async () => {
		renderPanel(outOfSync);
		await choose('useRecoveryKey');
		fireEvent.change(
			screen.getByRole('textbox', { name: 'Ersatzschlüssel' }),
			{
				target: { value: ' EsTc stale key ' }
			}
		);
		fill('encryption.passwordRecovery.loginPassword', 'current-pw');
		fill('encryption.passwordRecovery.otp', '654321');
		submit();

		await waitFor(() =>
			expect(enrollAfterRecovery).toHaveBeenCalledWith(
				client,
				'current-pw',
				'EsTc stale key',
				5
			)
		);
		expect(reauthenticateRecovery).toHaveBeenCalledWith(
			'current-pw',
			'654321'
		);
		expect(
			await screen.findByText('encryption.passwordRecovery.ready')
		).toBeTruthy();
		expect(resealWithPrevious).not.toHaveBeenCalled();
	});
});
