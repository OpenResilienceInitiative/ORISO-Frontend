// @vitest-environment oriso-jsdom
import * as React from 'react';
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vite-plus/test';
import { KeyBackupRecoveryPrompt } from './KeyBackupRecoveryPrompt';
import { MatrixClientContext } from '../../globalState/context/MatrixClientContext';
import {
	clearRecoveryRuntimeState,
	setRecoveryRuntimeStatus
} from '../../services/recoveryReminderState';
vi.mock('../../globalState', async () => {
	const React = await import('react');
	return { UserDataContext: React.createContext(null) };
});
vi.mock('react-i18next', async () => {
	const { default: catalogue } = await import(
		'../../resources/i18n/de/common.json'
	);
	return {
		useTranslation: () => ({
			t: (key: string, fallback?: string) =>
				key
					.split('.')
					.reduce<any>((value, part) => value?.[part], catalogue) ??
				fallback ??
				key
		})
	};
});
const logout = vi.hoisted(() => vi.fn());
vi.mock('../logout/logout', () => ({ logout }));
vi.mock('../modal/OrisoDialog', () => ({
	OrisoDialog: ({ children }: { children: React.ReactNode }) => (
		<div role="dialog">{children}</div>
	)
}));
const call = vi.hoisted(() => ({
	current: null as unknown,
	listeners: new Set<() => void>()
}));
vi.mock('../../services/CallManager', () => ({
	callManager: {
		hasActiveCall: () =>
			call.current !== null &&
			(call.current as { state: string }).state !== 'left',
		getWaitingCall: () => null,
		subscribe: (listener: () => void) => {
			call.listeners.add(listener);
			return () => call.listeners.delete(listener);
		}
	}
}));
const userId = '@synthetic:test';
const service = { getClient: () => ({ getUserId: () => userId }) } as any;
afterEach(() => {
	call.current = null;
	call.listeners.clear();
	cleanup();
	clearRecoveryRuntimeState();
});
it('never opens a restore modal before enquiry, including an out-of-sync device', () => {
	setRecoveryRuntimeStatus(userId, 'needs-recovery-key');
	render(
		<MemoryRouter>
			<MatrixClientContext.Provider
				value={{
					matrixClientService: service,
					setMatrixClientService: vi.fn()
				}}
			>
				<KeyBackupRecoveryPrompt />
			</MatrixClientContext.Provider>
		</MemoryRouter>
	);
	expect(screen.queryByRole('dialog')).toBeNull();
	fireEvent.click(
		screen.getByRole('button', { name: 'Verlauf wiederherstellen' })
	);
	expect(screen.getByRole('dialog')).toBeTruthy();
});
it.each(['pending', 'device-ready', 'ready'] as const)(
	'does not interrupt a %s device',
	(status) => {
		setRecoveryRuntimeStatus(userId, status);
		render(
			<MemoryRouter>
				<MatrixClientContext.Provider
					value={{
						matrixClientService: service,
						setMatrixClientService: vi.fn()
					}}
				>
					<KeyBackupRecoveryPrompt />
				</MatrixClientContext.Provider>
			</MemoryRouter>
		);
		expect(screen.queryByRole('dialog')).toBeNull();
		expect(screen.queryByRole('button')).toBeNull();
	}
);

// #1741: the account unlocks with its password; the key dialog would be a dead end.
it('offers a fresh sign-in, not the recovery-key dialog, when the password unlocks the history', () => {
	setRecoveryRuntimeStatus(userId, 'needs-sign-in');
	render(
		<MemoryRouter>
			<MatrixClientContext.Provider
				value={{
					matrixClientService: service,
					setMatrixClientService: vi.fn()
				}}
			>
				<KeyBackupRecoveryPrompt />
			</MatrixClientContext.Provider>
		</MemoryRouter>
	);
	expect(screen.getByText(/erneut mit Ihrem Passwort an/)).toBeTruthy();
	expect(
		screen.queryByRole('button', { name: 'Verlauf wiederherstellen' })
	).toBeNull();
	expect(screen.queryByRole('link')).toBeNull();
	fireEvent.click(
		screen.getByRole('button', { name: 'Abmelden und erneut anmelden' })
	);
	expect(logout).toHaveBeenCalledOnce();
	expect(screen.queryByRole('dialog')).toBeNull();
});

it('keeps the floating sign-out notice off the screen while a call rings or runs', () => {
	setRecoveryRuntimeStatus(userId, 'needs-sign-in');
	call.current = { callId: 'c1', state: 'ringing', isIncoming: true };
	render(
		<MemoryRouter>
			<MatrixClientContext.Provider
				value={{
					matrixClientService: service,
					setMatrixClientService: vi.fn()
				}}
			>
				<KeyBackupRecoveryPrompt />
			</MatrixClientContext.Provider>
		</MemoryRouter>
	);
	// Its "Abmelden und erneut anmelden" rested over the call card's "Beitreten".
	expect(
		screen.queryByRole('button', { name: 'Abmelden und erneut anmelden' })
	).toBeNull();
	// Left: the call stays on record for rejoining, but the notice is back.
	call.current = { callId: 'c1', state: 'left', isIncoming: true };
	act(() => call.listeners.forEach((listener) => listener()));
	expect(
		screen.getByRole('button', { name: 'Abmelden und erneut anmelden' })
	).toBeTruthy();
});
