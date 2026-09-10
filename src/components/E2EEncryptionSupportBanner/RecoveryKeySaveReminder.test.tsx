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
import { RecoveryKeySaveReminder } from './RecoveryKeySaveReminder';
import { MatrixClientContext } from '../../globalState/context/MatrixClientContext';
import {
	getPendingRecoveryKey,
	savePendingRecoveryKey
} from '../../services/pendingRecoveryKeyStore';
import {
	clearRecoveryRuntimeState,
	markEnquiryFinalized,
	setRecoveryRuntimeStatus
} from '../../services/recoveryReminderState';
vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));
const userId = '@synthetic:test';
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
		</MatrixClientContext.Provider>
	</MemoryRouter>
);
beforeEach(() => {
	sessionStorage.clear();
	localStorage.clear();
});
afterEach(() => {
	cleanup();
	clearRecoveryRuntimeState();
});
it('waits for finalization, shows pending truthfully, updates on setup completion without a modal', () => {
	setRecoveryRuntimeStatus(userId, 'pending');
	render(view());
	expect(screen.queryByRole('complementary')).toBeNull();
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
	expect(screen.queryByRole('complementary')).toBeNull();
	next.rerender(view());
	fireEvent.click(screen.getByText('encryption.saveReminder.show'));
	expect(screen.getByText('synthetic-recovery-code')).toBeTruthy();
	fireEvent.click(screen.getByText('encryption.saveReminder.confirm'));
	expect(getPendingRecoveryKey(userId)).toBeNull();
	expect(screen.queryByRole('complementary')).toBeNull();
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
	const mounted = render(view());
	fireEvent.click(screen.getByText('encryption.saveReminder.later'));
	expect(screen.queryByRole('complementary')).toBeNull();
	mounted.unmount();
	act(() => savePendingRecoveryKey(userId, 'late-synthetic-key'));
	render(view());
	expect(screen.getByText('encryption.saveReminder.show')).toBeTruthy();
});
