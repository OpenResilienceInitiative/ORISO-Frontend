// @vitest-environment jsdom
import * as React from 'react';
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { KeyBackupRecoveryPrompt } from './KeyBackupRecoveryPrompt';
import { RecoveryKeySaveReminder } from './RecoveryKeySaveReminder';
import { MatrixClientContext } from '../../globalState/context/MatrixClientContext';
import { UserDataContext } from '../../globalState';
import {
	getPendingRecoveryKey,
	resetPendingRecoveryKeyCacheForTests,
	savePendingRecoveryKey
} from '../../services/pendingRecoveryKeyStore';
import {
	clearRecoveryRuntimeState,
	markEnquiryFinalized,
	setRecoveryRuntimeStatus
} from '../../services/recoveryReminderState';
vi.mock('lottie-react', () => ({ default: () => null }));
vi.mock('../../globalState', async () => ({
	UserDataContext: (await import('react')).createContext(null)
}));
vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));
const userId = '@synthetic:test';
/** Both recovery surfaces: the in-flow reminder and the recovery snackbar. */
const notices = () => [
	...screen.queryAllByRole('complementary'),
	...screen.queryAllByTestId('key-backup-recovery-action')
];
const view = (id = userId) => (
	<MemoryRouter>
		<MatrixClientContext.Provider
			value={{
				matrixClientService: {
					getClient: () => ({ getUserId: () => id })
				} as any,
				setMatrixClientService: vi.fn()
			}}
		>
			<RecoveryKeySaveReminder />
			<KeyBackupRecoveryPrompt />
		</MatrixClientContext.Provider>
	</MemoryRouter>
);
beforeEach(() => {
	sessionStorage.clear();
	localStorage.clear();
	resetPendingRecoveryKeyCacheForTests();
});
afterEach(() => {
	cleanup();
	clearRecoveryRuntimeState();
});
it('waits for finalization, shows pending truthfully, updates on setup completion without a modal', () => {
	setRecoveryRuntimeStatus(userId, 'pending');
	render(view());
	expect(notices()).toHaveLength(0);
	act(() => markEnquiryFinalized(userId, 12));
	expect(screen.getByText('encryption.saveReminder.pending')).toBeTruthy();
	act(() => savePendingRecoveryKey(userId, 'synthetic-recovery-code'));
	expect(screen.getByText('encryption.saveReminder.show')).toBeTruthy();
	expect(screen.queryByRole('dialog')).toBeNull();
	fireEvent.click(screen.getByText('encryption.saveReminder.later'));
	expect(getPendingRecoveryKey(userId)).toBe('synthetic-recovery-code');
});
it('survives navigation, isolates identities and clears the parked key only on confirmation', () => {
	markEnquiryFinalized(userId, 12);
	savePendingRecoveryKey(userId, 'synthetic-recovery-code');
	const mounted = render(view());
	mounted.unmount();
	const next = render(view('@other:test'));
	expect(notices()).toHaveLength(0);
	next.rerender(view());
	fireEvent.click(screen.getByText('encryption.saveReminder.show'));
	expect(screen.getByText('synthetic-recovery-code')).toBeTruthy();
	fireEvent.click(screen.getByText('encryption.saveReminder.confirm'));
	expect(getPendingRecoveryKey(userId)).toBeNull();
	expect(notices()).toHaveLength(0);
});

it('never reveals another identity key just because the previous identity had opened theirs', () => {
	markEnquiryFinalized(userId, 1);
	savePendingRecoveryKey(userId, 'first-synthetic-key');
	markEnquiryFinalized('@other:test', 2);
	savePendingRecoveryKey('@other:test', 'other-synthetic-key');
	const mounted = render(view());
	fireEvent.click(screen.getByText('encryption.saveReminder.show'));
	mounted.rerender(view('@other:test'));
	expect(screen.queryByText('other-synthetic-key')).toBeNull();
	expect(screen.getByText('encryption.saveReminder.show')).toBeTruthy();
});

it('defers a pending notice without permanently dismissing the later usable key', () => {
	markEnquiryFinalized(userId, 12);
	setRecoveryRuntimeStatus(userId, 'pending');
	render(view());
	fireEvent.click(screen.getByText('encryption.saveReminder.later'));
	expect(notices()).toHaveLength(0);
	act(() => savePendingRecoveryKey(userId, 'late-synthetic-key'));
	expect(screen.queryByText('late-synthetic-key')).toBeNull();
	expect(screen.queryByRole('dialog')).toBeNull();
	expect(screen.getByText('encryption.saveReminder.show')).toBeTruthy();
});

it('shows one recovery action while retaining enquiry success when setup fails', () => {
	markEnquiryFinalized(userId, 12);
	setRecoveryRuntimeStatus(userId, 'retryable-failure');
	render(view());
	expect(notices()).toHaveLength(1);
	expect(
		screen.getByText('encryption.saveReminder.unavailable')
	).toBeTruthy();
	expect(
		screen.getByText('encryption.keyBackup.dialog.openVault')
	).toBeTruthy();
	act(() => savePendingRecoveryKey(userId, 'synthetic-key'));
	expect(notices()).toHaveLength(1);
	expect(screen.getByText('encryption.saveReminder.show')).toBeTruthy();
	expect(screen.queryByRole('dialog')).toBeNull();
});
it('keeps a dismissed ready-key invitation dismissed across remounts', () => {
	markEnquiryFinalized(userId, 12);
	savePendingRecoveryKey(userId, 'synthetic-key');
	const mounted = render(view());
	fireEvent.click(screen.getByText('encryption.saveReminder.later'));
	mounted.unmount();
	render(view());
	expect(notices()).toHaveLength(0);
	expect(getPendingRecoveryKey(userId)).toBe('synthetic-key');
});

it('keeps busy recovery nonprompting and preserves enquiry success after finalization', () => {
	setRecoveryRuntimeStatus(userId, 'busy');
	render(view());
	expect(notices()).toHaveLength(0);
	act(() => markEnquiryFinalized(userId, 12));
	expect(notices()).toHaveLength(1);
	expect(screen.getByText('encryption.saveReminder.busy')).toBeTruthy();
	expect(
		screen.queryByText('encryption.keyBackup.dialog.openVault')
	).toBeNull();
	expect(
		screen.queryByText('encryption.passwordRecovery.retryable-failure')
	).toBeNull();
	expect(screen.queryByRole('dialog')).toBeNull();
});

it('shows the recovery prompt as a dismissible snackbar that returns on the next mount', () => {
	setRecoveryRuntimeStatus(userId, 'needs-recovery-key');
	const mounted = render(view());
	expect(screen.getByTestId('key-backup-recovery-action')).toBeTruthy();
	expect(screen.queryByRole('complementary')).toBeNull();
	expect(
		screen
			.getByText('encryption.passwordRecovery.settings')
			.closest('a')
			?.getAttribute('href')
	).toBe('/profile/einstellungen/sicherheit');
	fireEvent.click(screen.getByTestId('key-backup-recovery-action-close'));
	expect(screen.queryByTestId('key-backup-recovery-action')).toBeNull();
	mounted.unmount();
	render(view());
	expect(screen.getByTestId('key-backup-recovery-action')).toBeTruthy();
});

it('shows the snackbar again when the recovery status changes after a dismissal', () => {
	setRecoveryRuntimeStatus(userId, 'needs-password');
	render(view());
	fireEvent.click(screen.getByTestId('key-backup-recovery-action-close'));
	expect(screen.queryByTestId('key-backup-recovery-action')).toBeNull();
	act(() => setRecoveryRuntimeStatus(userId, 'needs-recovery-key'));
	expect(
		screen.getByText('encryption.passwordRecovery.needs-recovery-key', {
			exact: false
		})
	).toBeTruthy();
});

// A retry passes through 'pending' and can land on the same status again; the notice is still owed.
it('shows the snackbar again when a retry returns to the status that was dismissed', () => {
	setRecoveryRuntimeStatus(userId, 'needs-recovery-key');
	render(view());
	fireEvent.click(screen.getByTestId('key-backup-recovery-action-close'));
	expect(screen.queryByTestId('key-backup-recovery-action')).toBeNull();
	act(() => setRecoveryRuntimeStatus(userId, 'pending'));
	act(() => setRecoveryRuntimeStatus(userId, 'needs-recovery-key'));
	expect(screen.getByTestId('key-backup-recovery-action')).toBeTruthy();
});

// Both changes can land in one React batch, so the component never renders 'pending' in between.
it('shows the snackbar again when a retry returns to the dismissed status within one batch', () => {
	setRecoveryRuntimeStatus(userId, 'needs-recovery-key');
	render(view());
	fireEvent.click(screen.getByTestId('key-backup-recovery-action-close'));
	expect(screen.queryByTestId('key-backup-recovery-action')).toBeNull();
	act(() => {
		setRecoveryRuntimeStatus(userId, 'pending');
		setRecoveryRuntimeStatus(userId, 'needs-recovery-key');
	});
	expect(screen.getByTestId('key-backup-recovery-action')).toBeTruthy();
});

it('opens the restore dialog from the snackbar action', () => {
	setRecoveryRuntimeStatus(userId, 'needs-recovery-key');
	render(view());
	fireEvent.click(screen.getByTestId('key-backup-recovery-open'));
	expect(screen.getByRole('dialog')).toBeTruthy();
});

const passwordModeView = () => (
	<UserDataContext.Provider
		value={{ userData: { chatRecoveryMode: 'LOGIN_PASSWORD' } } as any}
	>
		{view()}
	</UserDataContext.Provider>
);

it('stays silent in password mode once the login password protects the key, keeping it for Sicherheit', () => {
	markEnquiryFinalized(userId, 12);
	savePendingRecoveryKey(userId, 'synthetic-key');
	setRecoveryRuntimeStatus(userId, 'ready');
	render(passwordModeView());
	expect(screen.queryByRole('complementary')).toBeNull();
	expect(getPendingRecoveryKey(userId)).toBe('synthetic-key');
	act(() => setRecoveryRuntimeStatus(userId, 'device-ready'));
	expect(screen.queryByRole('complementary')).toBeNull();
});

it('still asks for action in password mode when the password could not protect the key', () => {
	markEnquiryFinalized(userId, 12);
	savePendingRecoveryKey(userId, 'synthetic-key');
	setRecoveryRuntimeStatus(userId, 'needs-password');
	render(passwordModeView());
	expect(screen.getByText('encryption.saveReminder.show')).toBeTruthy();
});

it('keeps the key reminder outside password mode, where the key is the only way back', () => {
	markEnquiryFinalized(userId, 12);
	savePendingRecoveryKey(userId, 'synthetic-key');
	setRecoveryRuntimeStatus(userId, 'ready');
	render(view());
	expect(screen.getByText('encryption.saveReminder.show')).toBeTruthy();
});
