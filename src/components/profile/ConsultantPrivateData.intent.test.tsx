// @vitest-environment jsdom
// Place beside ConsultantPrivateData.tsx for the hosted counterfactual gate.
import * as React from 'react';
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ConsultantPrivateData } from './ConsultantPrivateData';

const { putEmail } = vi.hoisted(() => ({ putEmail: vi.fn() }));
vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));
vi.mock('../../globalState', async () => {
	const ReactModule = await import('react');
	return {
		UserDataContext: ReactModule.createContext({
			userData: {
				userName: 'test-counsellor',
				email: 'old@example.test',
				twoFactorAuth: { isActive: false }
			},
			reloadUserData: vi.fn().mockResolvedValue(undefined)
		})
	};
});
vi.mock('../../hooks/useAppConfig', () => ({
	useAppConfig: () => ({
		twofactor: { dateTwoFactorObligatory: new Date('2999-01-01') }
	})
}));
vi.mock('../../hooks/useOpenTwoFactorSettings', () => ({
	useOpenTwoFactorSettings: () => vi.fn()
}));
vi.mock('../../api', () => ({
	apiPutEmail: (...args: unknown[]) => putEmail(...args),
	apiDeleteTwoFactorAuth: vi.fn(),
	FETCH_ERRORS: { X_REASON: 'x-reason' },
	X_REASON: { EMAIL_NOT_AVAILABLE: 'email-not-available' }
}));
vi.mock('../headline/Headline', () => ({
	Headline: ({ text }) => <h2>{text}</h2>
}));
vi.mock('../text/Text', () => ({ Text: ({ text }) => <p>{text}</p> }));
vi.mock('../button/Button', () => ({
	BUTTON_TYPES: { LINK: 'link' },
	Button: ({ item, buttonHandle }) => (
		<button disabled={item.disabled} onClick={buttonHandle}>
			{item.label}
		</button>
	)
}));
vi.mock('../editableData/EditableData', () => ({
	EditableData: ({ isDisabled, onValueIsValid }) =>
		isDisabled ? null : (
			<button onClick={() => onValueIsValid('new@example.test')}>
				enter-valid-email
			</button>
		)
}));
vi.mock('../overlay/Overlay', () => ({
	OVERLAY_FUNCTIONS: {},
	Overlay: () => null
}));
vi.mock('../../resources/img/icons/pen.svg', () => ({
	ReactComponent: () => <svg />
}));

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

it('starts a fresh consultant email intent after explicit Cancel and re-entering the cancelled value', async () => {
	putEmail.mockRejectedValue(new TypeError('reply lost'));
	render(<ConsultantPrivateData />);
	fireEvent.click(screen.getByRole('button'));
	fireEvent.click(screen.getByRole('button', { name: 'enter-valid-email' }));
	await act(async () => {
		fireEvent.click(
			screen.getByRole('button', {
				name: 'profile.data.edit.button.save'
			})
		);
	});
	await waitFor(() => expect(putEmail).toHaveBeenCalledTimes(1));
	fireEvent.click(
		screen.getByRole('button', { name: 'profile.data.edit.button.cancel' })
	);
	fireEvent.click(screen.getByRole('button'));
	fireEvent.click(screen.getByRole('button', { name: 'enter-valid-email' }));
	await act(async () => {
		fireEvent.click(
			screen.getByRole('button', {
				name: 'profile.data.edit.button.save'
			})
		);
	});
	await waitFor(() => expect(putEmail).toHaveBeenCalledTimes(2));
	const [first, next] = putEmail.mock.calls;
	expect(next[0]).toBe(first[0]);
	expect(next[1].id, 'account-intent-consultant-cancel-reopen').not.toBe(
		first[1].id
	);
});
