// @vitest-environment jsdom

import * as React from 'react';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AskerAboutMeData } from './AskerAboutMeData';

const apiPutEmailMock = vi.fn();

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

vi.mock('../../api/apiDeleteEmail', () => ({ apiDeleteEmail: vi.fn() }));

vi.mock('../twoFactorAuth/twoFactorAuthConstants', () => ({
	TWO_FACTOR_TYPES: { EMAIL: 'email' }
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
		onSingleEditActive,
		onValueIsValid
	}: any) => (
		<div>
			<span>{label}</span>
			{isDisabled && onSingleEditActive ? (
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
	Overlay: () => null
}));

vi.mock('../../resources/img/illustrations/check.svg', () => ({
	ReactComponent: () => <svg />
}));
vi.mock('../../resources/img/illustrations/x.svg', () => ({
	ReactComponent: () => <svg />
}));

describe('AskerAboutMeData', () => {
	afterEach(() => {
		cleanup();
		vi.clearAllMocks();
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
