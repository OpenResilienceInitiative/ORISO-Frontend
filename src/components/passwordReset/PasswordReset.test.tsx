// @vitest-environment oriso-jsdom
import { MemoryRouter } from 'react-router-dom';
import * as React from 'react';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';
import { PasswordReset } from './PasswordReset';
const state = vi.hoisted(() => ({
	userData: {
		chatRecoveryMode: 'LOGIN_PASSWORD',
		chatRecoveryPolicyRevision: 1,
		passwordChangeRequired: false,
		twoFactorAuth: undefined as
			| { isRequired: boolean; isActive: boolean }
			| undefined
	},
	clientService: null as any,
	update: vi.fn(),
	change: vi.fn(),
	hasEvidence: vi.fn(async () => true),
	completeRecovery: vi.fn(async () => true),
	loadParked: vi.fn(async (): Promise<string | null> => null),
	seal: vi.fn(async (..._args: unknown[]) => undefined),
	firstSeal: vi.fn(
		async (..._args: unknown[]): Promise<string | undefined> => 'ready'
	),
	RepairRequiredError: class extends Error {},
	RepairBlockedError: class extends Error {},
	WorkLimitError: class extends Error {},
	logout: vi.fn()
}));
vi.mock('../../globalState', async () => {
	const React = await import('react');
	return {
		UserDataContext: React.createContext(state),
		AUTHORITIES: {},
		hasUserAuthority: () => false
	};
});
vi.mock('../animatedIllustration/AnimatedIllustration', () => ({
	CheckAnimation: () => null
}));
vi.mock('../../api', () => ({
	apiUpdatePassword: state.update,
	FETCH_ERRORS: { BAD_REQUEST: 'BAD_REQUEST' }
}));
vi.mock('../../services/matrixPasswordRecoveryService', () => ({
	changePasswordWithRecovery: state.change,
	hasPasswordRecoveryEvidence: state.hasEvidence,
	hasCompleteKeyRecovery: state.completeRecovery,
	PasswordRecoveryRepairRequiredError: state.RepairRequiredError,
	PasswordRecoveryRepairBlockedError: state.RepairBlockedError,
	PasswordRecoveryWorkLimitError: state.WorkLimitError
}));
vi.mock('../../services/matrixClientRegistry', () => ({
	getMatrixClientService: () => state.clientService
}));
vi.mock('../logout/logout', () => ({ logout: state.logout }));
vi.mock('../../services/pendingRecoveryKeyStore', async (importOriginal) => ({
	...((await importOriginal()) as Record<string, unknown>),
	loadPendingRecoveryKey: state.loadParked
}));
vi.mock('../../services/passwordRecoveryEnrollment', () => ({
	sealRecoveryKeyUnderPassword: state.seal,
	passwordRecoveryEnrollmentErrorKey: () =>
		'encryption.passwordRecovery.enrollmentFailed'
}));
vi.mock('../../services/authenticatedChatRecovery', () => ({
	sealRecoveryUnderFirstPassword: state.firstSeal
}));
vi.mock('../profile/EncryptionSettings/RecoveryKeyField', () => ({
	RecoveryKeyField: ({ value, onChange }: any) => (
		<input
			aria-label="recovery-key"
			value={value}
			onChange={(event) => onChange(event.target.value)}
		/>
	)
}));
vi.mock('../../utils/tenantSettingsHelper', () => ({
	getTenantSettings: () => ({})
}));
vi.mock('../../hooks/useAppConfig', () => ({
	useAppConfig: () => ({ urls: { toLogin: '/login' } })
}));
vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));
vi.mock('../../utils/validateInputValue', async (importOriginal) => ({
	// The live criteria checklist reads the real rules; only the overall
	// strength verdict is pinned so the recovery paths stay the subject here.
	...((await importOriginal()) as Record<string, unknown>),
	strengthIndicator: () => 4,
	inputValuesFit: (a: string, b: string) => a === b
}));
vi.mock('../inputField/InputField', () => ({
	InputField: ({ item, inputHandle }: any) => (
		<>
			<input
				aria-label={item.name}
				value={item.content}
				onChange={inputHandle}
			/>
			{item.infoText && <span>{item.infoText}</span>}
		</>
	)
}));
vi.mock('../button/Button', () => ({
	BUTTON_TYPES: {},
	// The password form's submit is "save-password"; any other button (the
	// follow-up step's) is named by its label.
	Button: ({ buttonHandle, disabled, item }: any) => (
		<button disabled={disabled} onClick={buttonHandle}>
			{[
				'profile.functions.security.button',
				'profile.functions.password.reset.submitAndContinue'
			].includes(item?.label)
				? 'save-password'
				: item?.label}
		</button>
	)
}));
vi.mock('../overlay/Overlay', () => ({
	OVERLAY_FUNCTIONS: {},
	Overlay: () => <div>saved</div>
}));
beforeEach(() => {
	vi.clearAllMocks();
	state.hasEvidence.mockResolvedValue(true);
	state.completeRecovery.mockResolvedValue(true);
	state.loadParked.mockResolvedValue(null);
	state.seal.mockResolvedValue(undefined);
	state.firstSeal.mockResolvedValue('ready');
	state.userData.twoFactorAuth = undefined;
	localStorage.clear();
	state.userData.chatRecoveryMode = 'LOGIN_PASSWORD';
	state.userData.passwordChangeRequired = false;
	state.clientService = {
		getReadyClient: async () => ({ getUserId: () => '@synthetic:test' })
	};
});
afterEach(cleanup);
const submit = () => {
	render(
		<MemoryRouter>
			<PasswordReset />
		</MemoryRouter>
	);
	fireEvent.change(screen.getByLabelText('passwordResetOld'), {
		target: { value: 'old-synthetic' }
	});
	fireEvent.change(screen.getByLabelText('passwordResetNew'), {
		target: { value: 'new-synthetic' }
	});
	fireEvent.change(screen.getByLabelText('passwordResetConfirm'), {
		target: { value: 'new-synthetic' }
	});
	fireEvent.click(screen.getByText('save-password'));
};
it('updates password through staged recovery and logs out only after it resolves', async () => {
	let finish: () => void;
	const pending = new Promise<void>((resolve) => {
		finish = resolve;
	});
	state.change.mockImplementation(async (_c, _old, _new, update) => {
		await update();
		await pending;
	});
	submit();
	await waitFor(() => expect(state.update).toHaveBeenCalled());
	expect(state.logout).not.toHaveBeenCalled();
	finish!();
	await waitFor(() => expect(state.logout).toHaveBeenCalled());
	expect(state.change).toHaveBeenCalledOnce();
	expect(state.update).toHaveBeenCalledWith('old-synthetic', 'new-synthetic');
});
it('does not call the password API or logout if envelope preparation fails', async () => {
	state.change.mockRejectedValue(new Error('envelope unavailable'));
	submit();
	await waitFor(() => expect(state.change).toHaveBeenCalled());
	expect(state.update).not.toHaveBeenCalled();
	expect(state.logout).not.toHaveBeenCalled();
});
it('keeps legacy password changes on the existing path', async () => {
	state.userData.chatRecoveryMode = 'RECOVERY_KEY';
	state.update.mockResolvedValue(undefined);
	submit();
	await waitFor(() => expect(state.logout).toHaveBeenCalled());
	expect(state.change).not.toHaveBeenCalled();
});

/**
 * QA (OBP 2.1, #69) was told to repair the chat recovery although recovery
 * (secret storage, backup, recovery key) was set up — only the password
 * envelope was missing, and the security settings offer no way to add one
 * without a fresh recovery key. With no envelope nothing is sealed under the
 * old password, so changing it loses nothing: same reasoning as the
 * account-setup gate's first change.
 */
describe('when recovery exists but no password envelope', () => {
	beforeEach(() => {
		state.change.mockRejectedValue(new state.RepairRequiredError());
		state.hasEvidence.mockResolvedValue(false);
		state.update.mockResolvedValue(undefined);
	});

	/**
	 * The change itself loses nothing — but the new password must come to
	 * unlock the history on a new device (#1917), so the flow does not end
	 * there: it asks for the recovery key once and seals it under the NEW
	 * password.
	 */
	it('changes the password, then seals the typed recovery key under the new password', async () => {
		submit();

		expect(
			await screen.findByText(
				'encryption.passwordRecovery.afterChange.explanation'
			)
		).toBeTruthy();
		expect(state.update).toHaveBeenCalledWith(
			'old-synthetic',
			'new-synthetic'
		);
		expect(state.logout).not.toHaveBeenCalled();

		fireEvent.change(screen.getByLabelText('recovery-key'), {
			target: { value: '  EsTc synthetic key  ' }
		});
		fireEvent.click(
			screen.getByText('encryption.passwordRecovery.afterChange.submit')
		);

		await waitFor(() => expect(state.logout).toHaveBeenCalled());
		expect(state.seal).toHaveBeenCalledWith(
			expect.anything(),
			'@synthetic:test',
			'new-synthetic',
			'EsTc synthetic key',
			1
		);
	});

	it('seals a recovery key parked on this device without asking for it', async () => {
		state.loadParked.mockResolvedValue('EsTc parked key');

		submit();

		await waitFor(() => expect(state.logout).toHaveBeenCalled());
		expect(state.seal).toHaveBeenCalledWith(
			expect.anything(),
			'@synthetic:test',
			'new-synthetic',
			'EsTc parked key',
			1
		);
		expect(
			screen.queryByText(
				'encryption.passwordRecovery.afterChange.explanation'
			)
		).toBeNull();
	});

	it('asks for the key when the parked one cannot be sealed', async () => {
		state.loadParked.mockResolvedValue('EsTc stale key');
		state.seal.mockRejectedValueOnce(new Error('wrong key'));

		submit();

		expect(await screen.findByLabelText('recovery-key')).toBeTruthy();
		expect(state.logout).not.toHaveBeenCalled();
	});

	it('keeps the step open and says why when sealing fails', async () => {
		state.seal.mockRejectedValue(new Error('invalid key'));
		submit();
		fireEvent.change(await screen.findByLabelText('recovery-key'), {
			target: { value: 'EsTc wrong key' }
		});
		fireEvent.click(
			screen.getByText('encryption.passwordRecovery.afterChange.submit')
		);

		expect(
			await screen.findByText(
				'encryption.passwordRecovery.enrollmentFailed'
			)
		).toBeTruthy();
		expect(state.logout).not.toHaveBeenCalled();
	});

	it('lets the person skip, and then finishes without sealing anything', async () => {
		submit();
		fireEvent.click(
			await screen.findByText(
				'encryption.passwordRecovery.afterChange.later'
			)
		);

		await waitFor(() => expect(state.logout).toHaveBeenCalled());
		expect(state.seal).not.toHaveBeenCalled();
	});

	it('does not ask for a key when no complete key recovery exists to seal', async () => {
		state.completeRecovery.mockResolvedValue(false);

		submit();

		await waitFor(() => expect(state.logout).toHaveBeenCalled());
		expect(state.update).toHaveBeenCalledWith(
			'old-synthetic',
			'new-synthetic'
		);
		expect(state.seal).not.toHaveBeenCalled();
	});
});

it('keeps the change blocked when evidence cannot be read', async () => {
	state.change.mockRejectedValue(new state.RepairRequiredError());
	state.hasEvidence.mockRejectedValue(new Error('homeserver unreachable'));

	submit();

	expect(await screen.findByRole('alert')).toBeTruthy();
	expect(state.update).not.toHaveBeenCalled();
	expect(state.logout).not.toHaveBeenCalled();
});

it('links to recovery repair without changing credentials when a partial enrollment exists', async () => {
	state.change.mockRejectedValue(new state.RepairRequiredError());
	submit();
	expect(await screen.findByRole('alert')).toBeTruthy();
	expect(
		screen
			.getByRole('link', { name: 'encryption.passwordRecovery.settings' })
			.getAttribute('href')
	).toBe('/profile/einstellungen/sicherheit');
	expect(state.update).not.toHaveBeenCalled();
	expect(state.logout).not.toHaveBeenCalled();
});

it.each<[new () => Error, string]>([
	[state.RepairBlockedError, 'encryption.passwordRecovery.repairBlocked'],
	[state.WorkLimitError, 'encryption.passwordRecovery.retryable-failure']
])('shows the specific recovery failure for %s', async (ErrorType, message) => {
	state.change.mockRejectedValue(new ErrorType());
	submit();

	expect(await screen.findByText(message)).toBeTruthy();
	expect(state.update).not.toHaveBeenCalled();
	expect(state.logout).not.toHaveBeenCalled();
});

/**
 * The account-setup gate shows this form to a counsellor whose login an
 * administrator provisioned. `passwordChangeRequired` is only ever set at that
 * provisioning, so the gate's step is always the account's FIRST password
 * change: nothing of the counsellor's own is sealed under the old password,
 * and there is nothing to rotate. The gate offers no other way on than logging
 * out, so a submit that can only fail strands the account.
 */
it('changes the password without a chat client while the account still owes its first one', async () => {
	state.clientService = null;
	state.userData.passwordChangeRequired = true;
	state.update.mockResolvedValue(undefined);

	submit();

	await waitFor(() => expect(state.logout).toHaveBeenCalled());
	expect(state.update).toHaveBeenCalledWith('old-synthetic', 'new-synthetic');
	expect(state.change).not.toHaveBeenCalled();
});

it('finishes the first password change when the chat client never becomes ready', async () => {
	state.clientService = {
		getReadyClient: async () => {
			throw new Error('Matrix client not initialized');
		}
	};
	state.userData.passwordChangeRequired = true;
	state.update.mockResolvedValue(undefined);

	submit();

	await waitFor(() => expect(state.logout).toHaveBeenCalled());
	expect(state.update).toHaveBeenCalledWith('old-synthetic', 'new-synthetic');
});

it('finishes the first password change when there is no enrolment to rotate', async () => {
	state.userData.passwordChangeRequired = true;
	state.change.mockRejectedValue(new state.RepairRequiredError());
	state.update.mockResolvedValue(undefined);

	submit();

	await waitFor(() => expect(state.logout).toHaveBeenCalled());
	expect(state.update).toHaveBeenCalledWith('old-synthetic', 'new-synthetic');
});

/**
 * #1917: an administrator provisioned the counsellor with a one-time password
 * and a mandatory second factor. The gate's password step logs out right
 * after the change, so nothing would be sealed until a later sign-in — a
 * device switch before that leaves the history unreadable without the
 * recovery key. So the gate's password step
 * sets recovery up and seals it under the counsellor's OWN new password, right
 * after the server accepted it. Never under the administrator's.
 */
describe('the gate’s first password change', () => {
	beforeEach(() => {
		state.userData.passwordChangeRequired = true;
		state.userData.twoFactorAuth = { isRequired: true, isActive: false };
		state.change.mockRejectedValue(new state.RepairRequiredError());
		state.hasEvidence.mockResolvedValue(false);
		state.completeRecovery.mockResolvedValue(false);
		state.update.mockResolvedValue(undefined);
	});

	it('seals recovery under the new password after the change, before logging out', async () => {
		const order: string[] = [];
		state.update.mockImplementation(async () => {
			order.push('update');
		});
		state.firstSeal.mockImplementation(async () => {
			order.push('seal');
			return 'ready';
		});
		state.logout.mockImplementation(() => {
			order.push('logout');
		});

		submit();

		await waitFor(() => expect(state.logout).toHaveBeenCalled());
		expect(order).toEqual(['update', 'seal', 'logout']);
		expect(state.update).toHaveBeenCalledWith(
			'old-synthetic',
			'new-synthetic'
		);
		expect(state.firstSeal).toHaveBeenCalledOnce();
		expect(state.firstSeal).toHaveBeenCalledWith(
			expect.objectContaining({ getUserId: expect.any(Function) }),
			{ mode: 'LOGIN_PASSWORD', revision: 1 },
			'new-synthetic',
			expect.any(Function)
		);
		expect(JSON.stringify(state.firstSeal.mock.calls)).not.toContain(
			'old-synthetic'
		);
		expect(state.seal).not.toHaveBeenCalled();
	});

	it('still logs out when sealing fails, and leaves the retry to the next sign-in', async () => {
		state.firstSeal.mockResolvedValue('retryable-failure');

		submit();

		await waitFor(() => expect(state.logout).toHaveBeenCalled());
		expect(state.update).toHaveBeenCalledWith(
			'old-synthetic',
			'new-synthetic'
		);
		expect(screen.queryByRole('alert')).toBeNull();
	});

	it('still logs out when sealing throws outright', async () => {
		state.firstSeal.mockRejectedValue(new Error('unexpected'));

		submit();

		await waitFor(() => expect(state.logout).toHaveBeenCalled());
		expect(screen.queryByRole('alert')).toBeNull();
	});

	it('seals nothing when the password change itself fails', async () => {
		state.update.mockRejectedValue(new Error('BAD_REQUEST'));

		submit();

		expect(
			await screen.findByText(
				'encryption.passwordRecovery.passwordChangeFailed'
			)
		).toBeTruthy();
		expect(state.firstSeal).not.toHaveBeenCalled();
		expect(state.logout).not.toHaveBeenCalled();
	});

	it('also seals while an interrupted earlier attempt left evidence behind', async () => {
		state.hasEvidence.mockResolvedValue(true);

		submit();

		await waitFor(() => expect(state.logout).toHaveBeenCalled());
		expect(state.firstSeal).toHaveBeenCalledWith(
			expect.anything(),
			{ mode: 'LOGIN_PASSWORD', revision: 1 },
			'new-synthetic',
			expect.any(Function)
		);
	});

	it('seals nothing outside the login-password mode', async () => {
		state.userData.chatRecoveryMode = 'RECOVERY_KEY';

		submit();

		await waitFor(() => expect(state.logout).toHaveBeenCalled());
		expect(state.firstSeal).not.toHaveBeenCalled();
		expect(state.change).not.toHaveBeenCalled();
	});

	it('changes the password without sealing when there is no chat client', async () => {
		state.clientService = null;

		submit();

		await waitFor(() => expect(state.logout).toHaveBeenCalled());
		expect(state.firstSeal).not.toHaveBeenCalled();
	});

	it('takes a re-onboarded account with complete recovery to the follow-up step instead', async () => {
		state.completeRecovery.mockResolvedValue(true);
		state.loadParked.mockResolvedValue('EsTc parked key');

		submit();

		await waitFor(() => expect(state.logout).toHaveBeenCalled());
		expect(state.firstSeal).not.toHaveBeenCalled();
		expect(state.seal).toHaveBeenCalledWith(
			expect.anything(),
			'@synthetic:test',
			'new-synthetic',
			'EsTc parked key',
			1
		);
	});
});

it('seals nothing on an ordinary password change outside the gate', async () => {
	state.change.mockRejectedValue(new state.RepairRequiredError());
	state.hasEvidence.mockResolvedValue(false);
	state.completeRecovery.mockResolvedValue(false);
	state.update.mockResolvedValue(undefined);

	submit();

	await waitFor(() => expect(state.logout).toHaveBeenCalled());
	expect(state.firstSeal).not.toHaveBeenCalled();
});

/**
 * An established account DOES have material sealed under the old password.
 * Changing it without rotating that envelope leaves the counsellor's encrypted
 * history reachable only with a recovery key they may never have saved, so the
 * change is refused — and the message says what is wrong and what to do,
 * rather than blaming the old password.
 */
it('refuses an established account’s change when the chat client is unavailable, and says why', async () => {
	state.clientService = null;

	submit();

	expect(
		await screen.findByText('encryption.passwordRecovery.chatUnavailable')
	).toBeTruthy();
	expect(state.update).not.toHaveBeenCalled();
	expect(state.logout).not.toHaveBeenCalled();
	expect(state.change).not.toHaveBeenCalled();
});

describe('when the new password is the current one', () => {
	const fill = (oldValue: string, newValue: string) => {
		render(
			<MemoryRouter>
				<PasswordReset />
			</MemoryRouter>
		);
		fireEvent.change(screen.getByLabelText('passwordResetOld'), {
			target: { value: oldValue }
		});
		fireEvent.change(screen.getByLabelText('passwordResetNew'), {
			target: { value: newValue }
		});
		fireEvent.change(screen.getByLabelText('passwordResetConfirm'), {
			target: { value: newValue }
		});
	};

	it('says so, keeps the button disabled and never calls the password API', () => {
		fill('same-synthetic', 'same-synthetic');

		expect(
			screen.getByText(/profile\.functions\.password\.reset\.sameAsOld/)
		).not.toBeNull();
		const save = screen.getByText('save-password') as HTMLButtonElement;
		expect(save.disabled).toBe(true);

		fireEvent.click(save);
		expect(state.update).not.toHaveBeenCalled();
		expect(state.change).not.toHaveBeenCalled();
	});

	it('notices it too when the current password is typed last', () => {
		render(
			<MemoryRouter>
				<PasswordReset />
			</MemoryRouter>
		);
		fireEvent.change(screen.getByLabelText('passwordResetNew'), {
			target: { value: 'same-synthetic' }
		});
		fireEvent.change(screen.getByLabelText('passwordResetConfirm'), {
			target: { value: 'same-synthetic' }
		});
		fireEvent.change(screen.getByLabelText('passwordResetOld'), {
			target: { value: 'same-synthetic' }
		});

		expect(
			(screen.getByText('save-password') as HTMLButtonElement).disabled
		).toBe(true);
	});

	it('leaves the intro out inside the account-setup dialog', () => {
		render(
			<MemoryRouter>
				<PasswordReset hideIntro />
			</MemoryRouter>
		);

		expect(
			screen.queryByText('profile.functions.password.reset.subtitle')
		).toBeNull();
	});
});

describe('inside the account-setup dialog', () => {
	const K = 'profile.functions.password.reset.';

	const renderDialog = () => {
		render(
			<MemoryRouter>
				<PasswordReset hideIntro variant="dialog" />
			</MemoryRouter>
		);

		return {
			type: (label: string, value: string) =>
				fireEvent.change(screen.getByLabelText(label), {
					target: { value }
				})
		};
	};

	const criterion = (labelKey: string) =>
		screen.getByText(labelKey).closest('li') as HTMLLIElement;

	it('names the field the user just signed in with', () => {
		renderDialog();

		expect(screen.getByText(`${K}old.hint`)).not.toBeNull();
		expect(screen.getByLabelText(`${K}old.dialogLabel`)).not.toBeNull();
		expect(screen.getByLabelText(`${K}new.label`)).not.toBeNull();
		expect(screen.getByLabelText(`${K}confirm.dialogLabel`)).not.toBeNull();
	});

	// The checklist is the only feedback while the password is still being
	// typed, so each rule has to answer for itself, not for the whole verdict.
	it('ticks each criterion off as the typed password meets it', () => {
		const { type } = renderDialog();
		const met = () =>
			[
				`${K}criteria.mixedCase`,
				`${K}criteria.number`,
				`${K}criteria.specialChar`,
				`${K}criteria.minLength`
			].map((key) =>
				criterion(key).className.includes(
					'passwordReset__criterion--met'
				)
			);

		expect(met()).toEqual([false, false, false, false]);

		type(`${K}new.label`, 'ab');
		expect(met()).toEqual([false, false, false, false]);

		type(`${K}new.label`, 'aB');
		expect(met()).toEqual([true, false, false, false]);

		type(`${K}new.label`, 'aB3');
		expect(met()).toEqual([true, true, false, false]);

		type(`${K}new.label`, 'aB3!');
		expect(met()).toEqual([true, true, true, false]);

		type(`${K}new.label`, 'aB3!aB3!aB');
		expect(met()).toEqual([true, true, true, true]);
	});

	it('refuses the administrator’s password here too', () => {
		const { type } = renderDialog();

		type(`${K}old.dialogLabel`, 'same-synthetic');
		type(`${K}new.label`, 'same-synthetic');
		type(`${K}confirm.dialogLabel`, 'same-synthetic');

		expect(screen.getByText(`${K}sameAsOld`)).not.toBeNull();
		expect(
			(screen.getByText('save-password') as HTMLButtonElement).disabled
		).toBe(true);
		expect(state.update).not.toHaveBeenCalled();
	});
});
