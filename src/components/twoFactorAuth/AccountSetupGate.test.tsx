// @vitest-environment jsdom

import * as React from 'react';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	within
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UserDataContext } from '../../globalState';
import { AccountSetupGate } from './AccountSetupGate';

const dialogProps = vi.hoisted(() => ({ current: null as any }));

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

// jsdom has no canvas; the real module is only reachable transitively here.
vi.mock('../animatedIllustration/AnimatedIllustration', () => ({
	CheckAnimation: () => null
}));

vi.mock('./TwoFactorSetupDialog', () => ({
	TwoFactorSetupDialog: (props: any) => {
		dialogProps.current = props;
		return <div data-testid="setup-dialog" />;
	}
}));

vi.mock('../passwordReset/PasswordReset', () => ({
	PasswordReset: () => <div data-testid="password-form" />
}));

const reloadDocument = vi.hoisted(() => vi.fn());
vi.mock('../../utils/reloadDocument', () => ({ reloadDocument }));

const renderGate = (userData: any, onLogout = vi.fn()) => {
	const reloadUserData = vi.fn().mockResolvedValue(undefined);
	reloadDocument.mockClear();

	render(
		<UserDataContext.Provider value={{ userData, reloadUserData } as any}>
			<AccountSetupGate onLogout={onLogout} />
		</UserDataContext.Provider>
	);

	return { onLogout, reloadUserData };
};

const owesPassword = {
	email: 'counsellor@example.com',
	passwordChangeRequired: true,
	twoFactorAuth: { isEnabled: true, isRequired: true, isActive: false }
};

const owesSecondFactor = {
	email: 'counsellor@example.com',
	passwordChangeRequired: false,
	twoFactorAuth: {
		isEnabled: true,
		isRequired: true,
		isActive: false,
		qrCode: 'qr',
		secret: 'secret'
	}
};

afterEach(cleanup);

describe('AccountSetupGate', () => {
	describe('while the password is still the administrator’s choice', () => {
		it('asks for a new password and not yet for a factor', () => {
			renderGate(owesPassword);

			expect(screen.getByTestId('password-form')).not.toBeNull();
			expect(screen.queryByTestId('setup-dialog')).toBeNull();
		});

		it('explains why the account cannot be used yet', () => {
			renderGate(owesPassword);

			expect(
				screen.getAllByText('passwordChange.required.title').length
			).toBeGreaterThan(0);
		});

		it('asks for it in a dialog that Escape does not close', () => {
			renderGate(owesPassword);

			const dialog = screen.getByRole('dialog');
			expect(within(dialog).getByTestId('password-form')).not.toBeNull();

			fireEvent.keyDown(dialog, { key: 'Escape' });

			expect(screen.queryByRole('dialog')).not.toBeNull();
		});

		it('keeps logging out reachable from inside the modal dialog', () => {
			const { onLogout } = renderGate(owesPassword);

			fireEvent.click(
				within(screen.getByRole('dialog')).getByRole('button', {
					name: 'accountSetup.required.logout'
				})
			);

			expect(onLogout).toHaveBeenCalledTimes(1);
		});
	});

	describe('once the password is the user’s own', () => {
		it('moves on to the second factor', () => {
			renderGate(owesSecondFactor);

			expect(screen.getByTestId('setup-dialog')).not.toBeNull();
			expect(screen.queryByTestId('password-form')).toBeNull();
		});

		it('opens the dialog with no way to close or disable it', () => {
			renderGate(owesSecondFactor);

			expect(dialogProps.current.open).toBe(true);
			expect(dialogProps.current.canClose).toBe(false);
			expect(dialogProps.current.canDisable).toBe(false);
		});

		it('passes the enrolment material through to the dialog', () => {
			renderGate(owesSecondFactor);

			expect(dialogProps.current.qrCode).toBe('qr');
			expect(dialogProps.current.secret).toBe('secret');
			expect(dialogProps.current.email).toBe('counsellor@example.com');
		});

		// A document load, not an in-app refresh: the bootstrap that starts live
		// event processing ran with setup still pending and skipped it, so the
		// account needs a clean boot once it is settled. It also removes the
		// stale-profile trap — there is no refresh left to fail silently.
		it('reloads the document after setup so the app boots for a settled account', async () => {
			renderGate(owesSecondFactor);

			await dialogProps.current.onSetupComplete();

			expect(reloadDocument).toHaveBeenCalled();
		});
	});

	describe('on every step', () => {
		it.each([
			['password', owesPassword],
			['second factor', owesSecondFactor]
		])(
			'offers logging out as the only other way on (%s)',
			async (_label, userData) => {
				const { onLogout } = renderGate(userData);

				await userEvent.click(
					screen.getByRole('button', {
						name: 'accountSetup.required.logout'
					})
				);

				expect(onLogout).toHaveBeenCalled();
			}
		);
	});
});
