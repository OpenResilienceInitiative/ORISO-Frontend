// @vitest-environment oriso-jsdom
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
import { KeepAccountDialog } from './KeepAccountDialog';
import { keepTemporaryAccount } from './keepTemporaryAccount';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, options?: { name?: string }) =>
			options?.name ? `${key}:${options.name}` : key
	})
}));
vi.mock('./keepTemporaryAccount', () => ({
	keepTemporaryAccount: vi.fn()
}));

const GOOD = 'Sonnenblume-2026-Lang!';
const account = {
	chatRecoveryMode: 'LOGIN_PASSWORD',
	chatRecoveryPolicyRevision: 2
};

const renderDialog = (onClose = vi.fn(), onKept = vi.fn()) => {
	render(
		<KeepAccountDialog
			open
			userName="eule_mika_4821"
			account={account}
			onClose={onClose}
			onKept={onKept}
		/>
	);
	return { onClose, onKept };
};

const password = () =>
	screen.getByLabelText('guestAccountMode.keep.password') as HTMLInputElement;
const repeat = () =>
	screen.getByLabelText('guestAccountMode.keep.repeat') as HTMLInputElement;
const submit = () =>
	screen.getByRole('button', {
		name: 'guestAccountMode.keep.submit'
	}) as HTMLButtonElement;

const fill = (first: string, second = first) => {
	fireEvent.change(password(), { target: { value: first } });
	fireEvent.change(repeat(), { target: { value: second } });
};

afterEach(cleanup);
beforeEach(() => {
	vi.mocked(keepTemporaryAccount).mockReset();
});

describe('KeepAccountDialog (UserService#1662)', () => {
	it('asks for a password only, and names the login name', () => {
		renderDialog();
		expect(
			screen.getByText('guestAccountMode.keep.loginName:eule_mika_4821')
		).toBeTruthy();
		expect(password().type).toBe('password');
		expect(repeat().type).toBe('password');
		expect(screen.queryByLabelText(/mail/i)).toBeNull();
		expect(submit().disabled).toBe(true);
	});

	it('keeps the submit closed until the password policy passes and both match', () => {
		renderDialog();
		fill('kurz');
		expect(submit().disabled).toBe(true);
		fill(GOOD, `${GOOD}x`);
		expect(submit().disabled).toBe(true);
		expect(screen.getByText('guestAccountMode.keep.mismatch')).toBeTruthy();
		fill(GOOD);
		expect(submit().disabled).toBe(false);
	});

	it('keeps the account, then says so and hands the result over', async () => {
		vi.mocked(keepTemporaryAccount).mockResolvedValue('kept');
		const { onKept } = renderDialog();
		fill(GOOD);
		fireEvent.click(submit());
		await screen.findByText('guestAccountMode.keep.success');
		expect(keepTemporaryAccount).toHaveBeenCalledWith(GOOD, account);
		expect(onKept).toHaveBeenCalledWith('kept');
	});

	it('says when the chat history still needs the recovery key', async () => {
		vi.mocked(keepTemporaryAccount).mockResolvedValue('recoveryPending');
		renderDialog();
		fill(GOOD);
		fireEvent.click(submit());
		await screen.findByText('guestAccountMode.keep.recoveryPending');
	});

	it.each([
		['BAD_REQUEST', 'guestAccountMode.keep.error.badRequest'],
		['FORBIDDEN', 'guestAccountMode.keep.error.forbidden'],
		['NO_MATCH', 'guestAccountMode.keep.error.notFound'],
		['CONFLICT', 'guestAccountMode.keep.error.conflict'],
		['TIMEOUT', 'guestAccountMode.keep.error.generic']
	])('explains a %s refusal and stays open', async (reason, message) => {
		vi.mocked(keepTemporaryAccount).mockRejectedValue(new Error(reason));
		const { onKept, onClose } = renderDialog();
		fill(GOOD);
		fireEvent.click(submit());
		await screen.findByText(message);
		expect(onKept).not.toHaveBeenCalled();
		expect(onClose).not.toHaveBeenCalled();
		await waitFor(() => expect(submit().disabled).toBe(false));
	});
});
