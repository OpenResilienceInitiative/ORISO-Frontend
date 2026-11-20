// @vitest-environment jsdom
import * as React from 'react';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UserDataContext } from '../../globalState';
import { LiveChatConversionPage } from './LiveChatConversionPage';

const mocks = vi.hoisted(() => ({
	status: vi.fn(),
	convert: vi.fn(),
	prepare: vi.fn(),
	seal: vi.fn(),
	getReadyClient: vi.fn(),
	client: { getUserId: () => '@guest:example.test' } as {
		getUserId: () => string;
	},
	matrixSubject: 'guest-a',
	replacementOnHold: false,
	dialogProps: vi.fn()
}));
vi.mock('react-router-dom', () => ({
	useLocation: () => ({ state: { topicId: 17 } })
}));
vi.mock('../sessionCookie/getMatrixAccessToken', () => ({
	getCurrentAuthSubject: () => 'guest-a'
}));
vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (_key: string, fallback: string) => fallback })
}));
vi.mock('./liveChatConversionApi', () => ({
	getConversionStatus: mocks.status,
	convertLiveChatAccount: mocks.convert
}));
vi.mock('./prepareGuestRecovery', () => ({
	prepareGuestRecovery: mocks.prepare
}));
vi.mock('../../services/authenticatedChatRecovery', () => ({
	sealRecoveryUnderFirstPassword: mocks.seal
}));
vi.mock('../../globalState/context/MatrixClientContext', () => ({
	useMatrixClient: () => ({
		matrixClientService: {
			getClient: () => mocks.client,
			getReadyClient: mocks.getReadyClient,
			getStaleDeviceRecoveryVersion: () => 0,
			getAuthenticatedSubject: () => mocks.matrixSubject,
			holdTokenRefreshDuring: (f: () => Promise<unknown>) => {
				if (mocks.replacementOnHold)
					mocks.client = { getUserId: () => '@guest:example.test' };
				return f();
			}
		}
	})
}));
vi.mock('../profile/EncryptionSettings/RecoveryKeySaveStep', () => ({
	RecoveryKeySaveStep: ({
		recoveryKey,
		onConfirm
	}: {
		recoveryKey: string;
		onConfirm: () => void;
	}) => (
		<div>
			<span>{recoveryKey}</span>
			<button onClick={onConfirm}>Confirm saved key</button>
		</div>
	)
}));
vi.mock('../profile/NewRequestDialog/NewRequestDialog', () => ({
	NewRequestDialog: (props: { open: boolean }) => {
		mocks.dialogProps(props);
		return props.open ? <div>Written request dialog</div> : null;
	}
}));
vi.mock('../furtherCounselling/useFurtherCounsellingPrefill', () => ({
	useFurtherCounsellingPrefill: () => ({
		prefilledPostcode: '10115',
		knownAgencyIds: [42]
	})
}));

const mount = (account: Record<string, unknown> = {}) =>
	render(
		<UserDataContext.Provider
			value={
				{
					userData: {
						userName: 'guest-name',
						userId: 'guest-a',
						...account
					}
				} as never
			}
		>
			<LiveChatConversionPage />
		</UserDataContext.Provider>
	);

describe('Live Chat conversion', () => {
	afterEach(() => cleanup());
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.client = { getUserId: () => '@guest:example.test' };
		mocks.matrixSubject = 'guest-a';
		mocks.replacementOnHold = false;
		localStorage.setItem('matrix_session_subject', 'guest-a');
		mocks.prepare.mockResolvedValue('synthetic-key');
		mocks.seal.mockResolvedValue('ready');
		mocks.getReadyClient.mockImplementation(async () => mocks.client);
	});
	it('shows a loading state while the account status is pending', () => {
		mocks.status.mockReturnValue(new Promise(() => {}));
		mount();
		expect(screen.getByRole('status')).toBeTruthy();
		expect(
			screen.queryByRole('button', { name: 'Prepare recovery key' })
		).toBeNull();
	});
	it('requires saved recovery key and reuses the pending conversion intent', async () => {
		mocks.status.mockResolvedValue({
			userId: 'guest-a',
			username: 'guest-name',
			state: 'PROMOTION_PENDING',
			intentId: 'existing-intent'
		});
		mocks.convert.mockResolvedValue('guest-name');
		mount();
		fireEvent.click(
			await screen.findByRole('button', { name: 'Prepare recovery key' })
		);
		await screen.findByText('synthetic-key');
		expect(screen.queryByLabelText('Password')).toBeNull();
		fireEvent.click(
			screen.getByRole('button', { name: 'Confirm saved key' })
		);
		fireEvent.change(screen.getByLabelText('Password'), {
			target: { value: 'chosen-password-123' }
		});
		fireEvent.change(screen.getByLabelText('Repeat password'), {
			target: { value: 'chosen-password-123' }
		});
		expect(mocks.convert).not.toHaveBeenCalled();
		fireEvent.click(
			screen.getByRole('button', { name: 'Create my account' })
		);
		await waitFor(() =>
			expect(mocks.convert).toHaveBeenCalledWith(
				'guest-a',
				'existing-intent',
				'chosen-password-123'
			)
		);
		mocks.status.mockResolvedValue({
			userId: 'guest-a',
			username: 'guest-name',
			state: 'PROMOTED',
			intentId: 'existing-intent'
		});
		fireEvent.click(
			await screen.findByRole('button', {
				name: 'Start a written request'
			})
		);
		expect(await screen.findByText('Written request dialog')).toBeTruthy();
	});
	it('asks a finished guest to sign in again after promotion', async () => {
		mocks.status.mockResolvedValue({
			userId: 'guest-a',
			username: 'guest-name',
			state: 'ANONYMOUS_FINISHED',
			intentId: null,
			finishedOrigin: false
		});
		mocks.convert.mockResolvedValue('guest-name');
		mount();
		fireEvent.click(
			await screen.findByRole('button', { name: 'Prepare recovery key' })
		);
		fireEvent.click(
			await screen.findByRole('button', { name: 'Confirm saved key' })
		);
		fireEvent.change(screen.getByLabelText('Password'), {
			target: { value: 'chosen-password-123' }
		});
		fireEvent.change(screen.getByLabelText('Repeat password'), {
			target: { value: 'chosen-password-123' }
		});
		fireEvent.click(
			screen.getByRole('button', { name: 'Create my account' })
		);
		expect(
			await screen.findByText(
				'Sign in again with this login name and your new password.'
			)
		).toBeTruthy();
		expect(
			screen
				.getByRole('link', { name: 'Go to sign in' })
				.getAttribute('href')
		).toBe('/login');
		expect(screen.queryByText('Written request dialog')).toBeNull();
	});
	it('uses the current Matrix client after the token-refresh hold begins', async () => {
		mocks.status.mockResolvedValue({
			userId: 'guest-a',
			username: 'guest-name',
			state: 'ELIGIBLE',
			intentId: null
		});
		mocks.replacementOnHold = true;
		mount();
		fireEvent.click(
			await screen.findByRole('button', { name: 'Prepare recovery key' })
		);
		await screen.findByText('synthetic-key');
		expect(mocks.prepare).toHaveBeenCalledWith(mocks.client, '');
	});
	it('does not ask for another login after the promoted user signs in again', async () => {
		mocks.status.mockResolvedValue({
			userId: 'guest-a',
			username: 'guest-name',
			state: 'PROMOTED',
			intentId: 'intent',
			finishedOrigin: true
		});
		mount();
		expect(
			await screen.findByRole('button', {
				name: 'Start a written request'
			})
		).toBeTruthy();
		expect(
			screen.queryByText(
				'Sign in again with this login name and your new password.'
			)
		).toBeNull();
	});

	it('opens the request dialog with the recommended topic and the prefill after conversion (FE#2251)', async () => {
		mocks.status.mockResolvedValue({
			userId: 'guest-a',
			username: 'guest-name',
			state: 'PROMOTED',
			intentId: 'intent'
		});
		mount();
		fireEvent.click(
			await screen.findByRole('button', {
				name: 'Start a written request'
			})
		);
		await screen.findByText('Written request dialog');
		expect(mocks.dialogProps).toHaveBeenLastCalledWith(
			expect.objectContaining({
				open: true,
				preselectedTopicId: 17,
				prefilledPostcode: '10115',
				knownAgencyIds: [42]
			})
		);
	});

	it('does not promise a preserved chat to an unrelated registered account', async () => {
		mocks.status.mockResolvedValue({
			userId: 'guest-a',
			username: 'regular-name',
			state: 'ALREADY_REGISTERED',
			intentId: null,
			finishedOrigin: false
		});
		mount();
		expect(
			await screen.findByText(
				'You can start a written request from this account.'
			)
		).toBeTruthy();
		expect(
			screen.queryByText(/Your Live Chat stays in this account/)
		).toBeNull();
		expect(mocks.convert).not.toHaveBeenCalled();
	});
	it('rechecks a pending finish and permits preparation only when finished', async () => {
		mocks.status
			.mockResolvedValueOnce({
				userId: 'guest-a',
				username: 'guest-name',
				state: 'FINISH_PENDING',
				intentId: null
			})
			.mockResolvedValue({
				userId: 'guest-a',
				username: 'guest-name',
				state: 'ANONYMOUS_FINISHED',
				intentId: null
			});
		mount();
		expect(
			await screen.findByRole('button', { name: 'Try again' })
		).toBeTruthy();
		expect(mocks.prepare).not.toHaveBeenCalled();
		fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
		expect(
			await screen.findByRole('button', { name: 'Prepare recovery key' })
		).toBeTruthy();
	});
	it('never promotes if the existing recovery key cannot be verified', async () => {
		mocks.status.mockResolvedValue({
			userId: 'guest-a',
			username: 'guest-name',
			state: 'ELIGIBLE',
			intentId: null
		});
		mocks.prepare.mockRejectedValue(new Error('unavailable'));
		mount();
		fireEvent.click(
			await screen.findByRole('button', { name: 'Prepare recovery key' })
		);
		await screen.findByText(/recovery key is not available/i);
		expect(mocks.convert).not.toHaveBeenCalled();
	});
	it('does not touch recovery or convert after the signed-in account changes', async () => {
		mocks.status
			.mockResolvedValueOnce({
				userId: 'guest-a',
				state: 'ELIGIBLE',
				intentId: null
			})
			.mockResolvedValue({
				userId: 'guest-b',
				username: 'guest-b-name',
				state: 'ELIGIBLE',
				intentId: null
			});
		mount();
		fireEvent.click(
			await screen.findByRole('button', { name: 'Prepare recovery key' })
		);
		await screen.findByText(/recovery key is not available/i);
		expect(mocks.prepare).not.toHaveBeenCalled();
		expect(mocks.convert).not.toHaveBeenCalled();
	});
	it('does not submit if the Matrix client changed after recovery was prepared', async () => {
		mocks.status.mockResolvedValue({
			userId: 'guest-a',
			username: 'guest-name',
			state: 'ELIGIBLE',
			intentId: null
		});
		mount();
		fireEvent.click(
			await screen.findByRole('button', { name: 'Prepare recovery key' })
		);
		await screen.findByText('synthetic-key');
		fireEvent.click(
			screen.getByRole('button', { name: 'Confirm saved key' })
		);
		mocks.client = { getUserId: () => '@different:example.test' };
		fireEvent.change(screen.getByLabelText('Password'), {
			target: { value: 'chosen-password-123' }
		});
		fireEvent.change(screen.getByLabelText('Repeat password'), {
			target: { value: 'chosen-password-123' }
		});
		fireEvent.click(
			screen.getByRole('button', { name: 'Create my account' })
		);
		await screen.findByText(/recovery key is not available/i);
		expect(
			screen.getByRole('button', { name: 'Prepare recovery key' })
		).toBeTruthy();
		expect(mocks.convert).not.toHaveBeenCalled();
	});
	it('does not invoke recovery when the Matrix client belongs to another account', async () => {
		mocks.status.mockResolvedValue({
			userId: 'guest-a',
			username: 'guest-name',
			state: 'ELIGIBLE',
			intentId: null
		});
		mocks.matrixSubject = 'guest-b';
		mount();
		fireEvent.click(
			await screen.findByRole('button', { name: 'Prepare recovery key' })
		);
		await screen.findByText(/recovery key is not available/i);
		expect(mocks.prepare).not.toHaveBeenCalled();
		expect(mocks.convert).not.toHaveBeenCalled();
	});
	it('does not invoke recovery after the session changes to a forbidden role', async () => {
		mocks.status
			.mockResolvedValueOnce({
				userId: 'guest-a',
				state: 'ELIGIBLE',
				intentId: null
			})
			.mockRejectedValue(new Error('403'));
		mount();
		fireEvent.click(
			await screen.findByRole('button', { name: 'Prepare recovery key' })
		);
		await screen.findByText(/recovery key is not available/i);
		expect(mocks.prepare).not.toHaveBeenCalled();
		expect(mocks.convert).not.toHaveBeenCalled();
	});

	/* The first click on "Prepare recovery key" failed intermittently on Dev
	   (US#1601 runs 2, 3, 6): it used the client before its first full sync. */
	it('prepares recovery only on the synced Matrix client', async () => {
		mocks.status.mockResolvedValue({
			userId: 'guest-a',
			username: 'guest-name',
			state: 'ELIGIBLE',
			intentId: null
		});
		const synced = { getUserId: () => '@guest:example.test' };
		mocks.client = { getUserId: () => '@guest:example.test' };
		mocks.getReadyClient.mockImplementation(async () => {
			mocks.client = synced;
			return synced;
		});
		mount();
		fireEvent.click(
			await screen.findByRole('button', { name: 'Prepare recovery key' })
		);
		await screen.findByText('synthetic-key');
		expect(mocks.prepare).toHaveBeenCalledWith(synced, '');
	});

	/* FE#2334: with LOGIN_PASSWORD recovery the chat history is sealed under
	   the password the guest chooses; nobody is shown a recovery key. */
	describe('when the account recovers its chat with the login password', () => {
		const passwordRecovery = {
			chatRecoveryMode: 'LOGIN_PASSWORD',
			chatRecoveryPolicyRevision: 3
		};
		const eligible = {
			userId: 'guest-a',
			username: 'guest-name',
			state: 'ELIGIBLE',
			intentId: null
		};
		const choosePassword = async () => {
			fireEvent.change(await screen.findByLabelText('Password'), {
				target: { value: 'chosen-password-1234' }
			});
			fireEvent.change(screen.getByLabelText('Repeat password'), {
				target: { value: 'chosen-password-1234' }
			});
			fireEvent.click(
				screen.getByRole('button', { name: 'Create my account' })
			);
		};

		it('seals the history under the new password without showing a key', async () => {
			mocks.status.mockResolvedValue(eligible);
			mocks.convert.mockResolvedValue('anon_17');
			mount(passwordRecovery);
			await choosePassword();

			await screen.findByText('Your account is ready');
			expect(
				screen.queryByRole('button', { name: 'Prepare recovery key' })
			).toBeNull();
			expect(screen.queryByText('synthetic-key')).toBeNull();
			expect(mocks.prepare).toHaveBeenCalledWith(mocks.client, '');
			expect(mocks.convert).toHaveBeenCalledWith(
				'guest-a',
				expect.any(String),
				'chosen-password-1234'
			);
			expect(mocks.seal).toHaveBeenCalledWith(
				mocks.client,
				{ mode: 'LOGIN_PASSWORD', revision: 3 },
				'chosen-password-1234',
				expect.any(Function)
			);
			const [prepared] = mocks.prepare.mock.invocationCallOrder;
			const [converted] = mocks.convert.mock.invocationCallOrder;
			const [sealed] = mocks.seal.mock.invocationCallOrder;
			expect(prepared).toBeLessThan(converted);
			expect(converted).toBeLessThan(sealed);
		});

		it('does not convert when the history cannot be backed up first', async () => {
			mocks.status.mockResolvedValue(eligible);
			mocks.prepare.mockRejectedValue(new Error('setup failed'));
			mount(passwordRecovery);
			await choosePassword();

			await screen.findByText(/chat history could not be secured/i);
			expect(mocks.convert).not.toHaveBeenCalled();
			expect(mocks.seal).not.toHaveBeenCalled();
		});

		it('falls back to the recovery key when the password seal fails', async () => {
			mocks.status.mockResolvedValue(eligible);
			mocks.convert.mockResolvedValue('anon_17');
			mocks.seal.mockResolvedValue('retryable-failure');
			mount(passwordRecovery);
			await choosePassword();

			await screen.findByText('synthetic-key');
			fireEvent.click(
				screen.getByRole('button', { name: 'Confirm saved key' })
			);
			await screen.findByText('Your account is ready');
		});
	});
});
