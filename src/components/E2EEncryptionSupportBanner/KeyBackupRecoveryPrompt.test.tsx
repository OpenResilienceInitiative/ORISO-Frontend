// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
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
vi.mock('../modal/OrisoDialog', () => ({
	OrisoDialog: ({ children }: { children: React.ReactNode }) => (
		<div role="dialog">{children}</div>
	)
}));
const userId = '@synthetic:test';
const service = { getClient: () => ({ getUserId: () => userId }) } as any;
afterEach(() => {
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
	fireEvent.click(screen.getByRole('button', { name: 'Tresor öffnen' }));
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
