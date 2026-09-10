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
		chatRecoveryPolicyRevision: 1
	},
	update: vi.fn(),
	change: vi.fn(),
	RepairRequiredError: class extends Error {},
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
	PasswordRecoveryRepairRequiredError: state.RepairRequiredError
}));
vi.mock('../../services/matrixClientRegistry', () => ({
	getMatrixClientService: () => ({
		getReadyClient: async () => ({ getUserId: () => '@synthetic:test' })
	})
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
		<input
			aria-label={item.name}
			value={item.content}
			onChange={inputHandle}
		/>
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
