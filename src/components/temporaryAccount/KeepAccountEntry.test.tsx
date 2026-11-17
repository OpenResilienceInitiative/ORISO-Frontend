// @vitest-environment oriso-jsdom
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { UserDataContext } from '../../globalState/context/UserDataContext';
import {
	KeepAccountEntry,
	isKeepableTemporaryAccount
} from './KeepAccountEntry';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));
/* The dialog has its own tests; here it only reports a kept account. */
vi.mock('./KeepAccountDialog', () => ({
	KeepAccountDialog: ({ onKept, onClose, userName }: any) => (
		<div role="dialog" aria-label={`keep ${userName}`}>
			<button type="button" onClick={() => onKept('kept')}>
				kept
			</button>
			<button type="button" onClick={onClose}>
				close
			</button>
		</div>
	)
}));

const ASKER = 'AUTHORIZATION_USER_DEFAULT';
const user = (overrides: Record<string, unknown> = {}) =>
	({
		userId: 'u-1',
		userName: 'eule_mika_4821',
		grantedAuthorities: [ASKER],
		userRoles: ['user'],
		temporaryAccount: true,
		...overrides
	}) as any;

const renderEntry = (
	userData = user(),
	reloadUserData = vi.fn().mockResolvedValue(undefined)
) => {
	render(
		<UserDataContext.Provider
			value={{ userData, setUserData: vi.fn(), reloadUserData }}
		>
			<KeepAccountEntry />
		</UserDataContext.Provider>
	);
	return reloadUserData;
};

afterEach(cleanup);

describe('KeepAccountEntry (UserService#1662)', () => {
	it('is offered to an asker with a temporary account only', () => {
		expect(isKeepableTemporaryAccount(user())).toBe(true);
		expect(
			isKeepableTemporaryAccount(user({ temporaryAccount: false }))
		).toBe(false);
		expect(
			isKeepableTemporaryAccount(user({ temporaryAccount: undefined }))
		).toBe(false);
		expect(
			isKeepableTemporaryAccount(
				user({
					grantedAuthorities: ['AUTHORIZATION_CONSULTANT_DEFAULT']
				})
			)
		).toBe(false);
		expect(isKeepableTemporaryAccount(null as any)).toBe(false);
	});

	it('shows nothing for a permanent account', () => {
		renderEntry(user({ temporaryAccount: false }));
		expect(
			screen.queryByRole('button', {
				name: 'guestAccountMode.keep.action'
			})
		).toBeNull();
	});

	it('opens the dialog and refreshes the user data once the account is kept and the dialog closes', () => {
		const reload = renderEntry();
		expect(
			screen.getByText('guestAccountMode.keep.actionDescription')
		).toBeTruthy();
		fireEvent.click(
			screen.getByRole('button', { name: 'guestAccountMode.keep.action' })
		);
		expect(
			screen.getByRole('dialog', { name: 'keep eule_mika_4821' })
		).toBeTruthy();
		fireEvent.click(screen.getByRole('button', { name: 'kept' }));
		expect(reload).not.toHaveBeenCalled();
		fireEvent.click(screen.getByRole('button', { name: 'close' }));
		expect(reload).toHaveBeenCalledTimes(1);
		expect(screen.queryByRole('dialog')).toBeNull();
	});

	it('does not refresh anything when the dialog is closed without keeping', () => {
		const reload = renderEntry();
		fireEvent.click(
			screen.getByRole('button', { name: 'guestAccountMode.keep.action' })
		);
		fireEvent.click(screen.getByRole('button', { name: 'close' }));
		expect(reload).not.toHaveBeenCalled();
	});
});
