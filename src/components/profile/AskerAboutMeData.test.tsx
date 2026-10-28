// @vitest-environment oriso-jsdom

import * as React from 'react';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
	within
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { AskerAboutMeData } from './AskerAboutMeData';
import { UserDataContext } from '../../globalState';
import { apiDeleteTwoFactorAuth } from '../../api';
import { accountPolicyUser } from '../../test/fixtures/askerAccountPolicyFixtures';

const apiPutEmailMock = vi.fn();
const apiDeleteEmailMock = vi.fn().mockResolvedValue(undefined);
const policy = vi.hoisted(() => ({ featureAskerEmailEnabled: true }));
vi.mock('../../globalState/provider/TenantProvider', () => ({
	useTenant: () => ({ settings: policy })
}));

// Real Profile stories cover the avatar editor; this test owns email retry.
vi.mock('./ProfileAvatarChoice', () => ({ ProfileAvatarChoice: () => null }));

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

vi.mock('../../globalState', async () => {
	const ReactModule = await import('react');
	return {
		UserDataContext: ReactModule.createContext({
			userData: {
				userName: 'fresh-asker',
				email: 'old@example.test',
				twoFactorAuth: { isActive: false, type: null }
			},
			reloadUserData: vi.fn()
		})
	};
});

vi.mock('../../api', () => ({
	apiDeleteTwoFactorAuth: vi.fn(),
	apiPutEmail: (...args: unknown[]) => apiPutEmailMock(...args),
	FETCH_ERRORS: { X_REASON: 'x-reason' },
	X_REASON: { EMAIL_NOT_AVAILABLE: 'email-not-available' }
}));

vi.mock('../../api/apiDeleteEmail', () => ({
	apiDeleteEmail: (...args: unknown[]) => apiDeleteEmailMock(...args)
}));

vi.mock('../twoFactorAuth/twoFactorAuthConstants', () => ({
	TWO_FACTOR_TYPES: { EMAIL: 'EMAIL' }
}));

vi.mock('../headline/Headline', () => ({
	Headline: ({ text }: { text: string }) => <h2>{text}</h2>
}));

vi.mock('../text/Text', () => ({
	Text: ({ text }: { text: string }) => <p>{text}</p>
}));

vi.mock('../button/Button', () => ({
	BUTTON_TYPES: { LINK: 'link', PRIMARY: 'primary', SECONDARY: 'secondary' },
	Button: ({ item, buttonHandle }: any) => (
		<button type="button" disabled={item.disabled} onClick={buttonHandle}>
			{item.label}
		</button>
	)
}));

vi.mock('../editableData/EditableData', () => ({
	EditableData: ({
		label,
		isDisabled,
		isSingleEdit,
		onSingleEditActive,
		onValueIsValid
	}: any) => (
		<div>
			<span>{label}</span>
			{isDisabled && isSingleEdit && onSingleEditActive ? (
				<button type="button" onClick={onSingleEditActive}>
					edit email
				</button>
			) : !isDisabled && onValueIsValid ? (
				<button
					type="button"
					onClick={() => onValueIsValid('new@example.test')}
				>
					enter valid email
				</button>
			) : null}
		</div>
	)
}));

vi.mock('../overlay/Overlay', () => ({
	OVERLAY_FUNCTIONS: {
		CLOSE: 'close',
		CLOSE_SUCCESS: 'close-success',
		CONFIRM_EDIT: 'confirm-edit',
		DELETE_EMAIL: 'delete-email'
	},
	Overlay: ({
		item,
		handleOverlay
	}: React.ComponentProps<typeof import('../overlay/Overlay').Overlay>) => (
		<div role="dialog">
			<h2>{item.headline}</h2>
			{item.buttonSet?.map((button) => (
				<button
					key={button.label}
					type="button"
					onClick={() => handleOverlay(button.function)}
				>
					{button.label}
				</button>
			))}
		</div>
	)
}));

vi.mock('../../resources/img/illustrations/check.svg', () => ({
	ReactComponent: () => <svg />
}));
vi.mock('../../resources/img/illustrations/x.svg', () => ({
	ReactComponent: () => <svg />
}));

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
	policy.featureAskerEmailEnabled = true;
	apiDeleteEmailMock.mockReset().mockResolvedValue(undefined);
});

describe('AskerAboutMeData', () => {
	it('keeps safe deletion but offers no edit or solicitation when collection is forbidden', async () => {
		policy.featureAskerEmailEnabled = false;
		render(<AskerAboutMeData />);
		expect(screen.queryByText('profile.data.emailInfo')).toBeNull();
		expect(screen.queryByRole('button', { name: 'edit email' })).toBeNull();
		fireEvent.click(
			screen.getByRole('button', {
				name: 'profile.unsetEmail.confirmOverlay.button.confirm'
			})
		);
		fireEvent.click(
			within(screen.getByRole('dialog')).getByRole('button', {
				name: 'profile.unsetEmail.confirmOverlay.button.confirm'
			})
		);
		await waitFor(() =>
			expect(apiDeleteEmailMock).toHaveBeenCalledTimes(1)
		);
		expect(apiPutEmailMock).not.toHaveBeenCalled();
	});
	it('withdraws an in-progress edit when collection is revoked', () => {
		const view = render(<AskerAboutMeData />);
		fireEvent.click(screen.getByRole('button', { name: 'edit email' }));
		fireEvent.click(
			screen.getByRole('button', { name: 'enter valid email' })
		);
		policy.featureAskerEmailEnabled = false;
		view.rerender(<AskerAboutMeData />);
		expect(
			screen.queryByRole('button', {
				name: 'profile.data.edit.button.save'
			})
		).toBeNull();
		expect(screen.queryByRole('button', { name: 'edit email' })).toBeNull();
		expect(apiPutEmailMock).not.toHaveBeenCalled();
	});

	it('allows the asker to retry saving after a generic update failure', async () => {
		apiPutEmailMock.mockRejectedValue(new Error('temporary failure'));

		render(<AskerAboutMeData />);

		fireEvent.click(screen.getByRole('button', { name: 'edit email' }));
		fireEvent.click(
			screen.getByRole('button', { name: 'enter valid email' })
		);
		const saveButton = screen.getByRole('button', {
			name: 'profile.data.edit.button.save'
		});
		fireEvent.click(saveButton);

		await waitFor(() => expect(apiPutEmailMock).toHaveBeenCalledTimes(1));
		fireEvent.click(saveButton);

		await waitFor(() => expect(apiPutEmailMock).toHaveBeenCalledTimes(2));
	});
});

const confirmRemoval = () => {
	fireEvent.click(
		screen.getByRole('button', {
			name: 'profile.unsetEmail.confirmOverlay.button.confirm'
		})
	);
	fireEvent.click(
		within(screen.getByRole('dialog')).getByRole('button', {
			name: 'profile.unsetEmail.confirmOverlay.button.confirm'
		})
	);
};

it('allows safe email removal to be retried after a failed delete', async () => {
	policy.featureAskerEmailEnabled = false;
	apiDeleteEmailMock.mockRejectedValueOnce(new Error('offline'));
	render(<AskerAboutMeData />);
	confirmRemoval();
	await screen.findByRole('heading', {
		name: 'profile.unsetEmail.errorOverlay.headline'
	});
	fireEvent.click(
		within(screen.getByRole('dialog')).getByRole('button', {
			name: 'profile.unsetEmail.errorOverlay.button'
		})
	);
	confirmRemoval();
	await waitFor(() => expect(apiDeleteEmailMock).toHaveBeenCalledTimes(2));
});

it('disables an existing email factor before removing its address when collection is forbidden', async () => {
	policy.featureAskerEmailEnabled = false;
	vi.mocked(apiDeleteTwoFactorAuth).mockResolvedValue(undefined);
	const user = accountPolicyUser({
		email: 'old@example.test',
		twoFactorAuth: {
			isEnabled: true,
			isActive: true,
			type: 'EMAIL',
			secret: '',
			qrCode: '',
			isShown: false
		}
	});
	render(
		<UserDataContext.Provider
			value={{
				userData: user,
				setUserData: vi.fn(),
				reloadUserData: vi.fn().mockResolvedValue(user)
			}}
		>
			<AskerAboutMeData />
		</UserDataContext.Provider>
	);
	confirmRemoval();
	await waitFor(() => expect(apiDeleteEmailMock).toHaveBeenCalledTimes(1));
	expect(
		vi.mocked(apiDeleteTwoFactorAuth).mock.invocationCallOrder[0]
	).toBeLessThan(apiDeleteEmailMock.mock.invocationCallOrder[0]);
});

it('retries the address after an already-successful idempotent factor cleanup', async () => {
	policy.featureAskerEmailEnabled = false;
	vi.mocked(apiDeleteTwoFactorAuth).mockResolvedValue(undefined);
	apiDeleteEmailMock.mockRejectedValueOnce(new Error('offline'));
	const user = accountPolicyUser({
		email: 'old@example.test',
		twoFactorAuth: {
			isEnabled: true,
			isActive: true,
			type: 'EMAIL',
			secret: '',
			qrCode: '',
			isShown: false
		}
	});
	render(
		<UserDataContext.Provider
			value={{
				userData: user,
				setUserData: vi.fn(),
				reloadUserData: vi.fn().mockResolvedValue(user)
			}}
		>
			<AskerAboutMeData />
		</UserDataContext.Provider>
	);
	confirmRemoval();
	await screen.findByRole('heading', {
		name: 'profile.unsetEmail.errorOverlay.headline'
	});
	fireEvent.click(
		within(screen.getByRole('dialog')).getByRole('button', {
			name: 'profile.unsetEmail.errorOverlay.button'
		})
	);
	confirmRemoval();
	await waitFor(() => expect(apiDeleteEmailMock).toHaveBeenCalledTimes(2));
	expect(
		screen.getByRole('heading', {
			name: 'profile.unsetEmail.successOverlay.headline'
		})
	).toBeTruthy();
});
