// @vitest-environment jsdom
import { MemoryRouter } from 'react-router-dom';
import * as React from 'react';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { PasswordReset } from './PasswordReset';
const state = vi.hoisted(() => ({
	userData: {
		chatRecoveryMode: 'LOGIN_PASSWORD',
		chatRecoveryPolicyRevision: 1,
		passwordChangeRequired: false
	},
	clientService: null as any,
	update: vi.fn(),
	change: vi.fn(),
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
	PasswordRecoveryRepairRequiredError: state.RepairRequiredError,
	PasswordRecoveryRepairBlockedError: state.RepairBlockedError,
	PasswordRecoveryWorkLimitError: state.WorkLimitError
}));
vi.mock('../../services/matrixClientRegistry', () => ({
	getMatrixClientService: () => state.clientService
}));
vi.mock('../logout/logout', () => ({ logout: state.logout }));
vi.mock('../../utils/tenantSettingsHelper', () => ({
	getTenantSettings: () => ({})
}));
vi.mock('../../hooks/useAppConfig', () => ({
	useAppConfig: () => ({ urls: { toLogin: '/login' } })
}));
vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));
vi.mock('../../utils/validateInputValue', () => ({
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
	Button: ({ buttonHandle, disabled }: any) => (
		<button disabled={disabled} onClick={buttonHandle}>
			save-password
		</button>
	)
}));
vi.mock('../overlay/Overlay', () => ({
	OVERLAY_FUNCTIONS: {},
	Overlay: () => <div>saved</div>
}));
beforeEach(() => {
	vi.clearAllMocks();
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

it('links to recovery repair without changing credentials when enrollment is absent', async () => {
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
