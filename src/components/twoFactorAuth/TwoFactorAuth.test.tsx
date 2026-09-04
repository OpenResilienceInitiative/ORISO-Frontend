// @vitest-environment jsdom

import * as React from 'react';
import { act, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserDataContext } from '../../globalState';
import { TwoFactorAuth } from './TwoFactorAuth';

const setupDialogMock = vi.fn();
const backupDialogMock = vi.fn();
const locationState = vi.hoisted(() => ({
	current: { openTwoFactor: true } as Record<string, unknown>
}));

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

vi.mock('react-router-dom', () => ({
	useLocation: () => ({
		state: locationState.current
	})
}));

vi.mock('../../hooks/useAppConfig', () => ({
	useAppConfig: () => ({
		twofactor: { dateTwoFactorObligatory: new Date(0) }
	})
}));

vi.mock('../../globalState', async () => {
	const ReactModule = await import('react');

	return {
		UserDataContext: ReactModule.createContext(undefined)
	};
});

vi.mock('../button/Button', () => ({
	BUTTON_TYPES: { LINK_INLINE: 'LINK_INLINE' },
	Button: () => null
}));
vi.mock('../headline/Headline', () => ({ Headline: () => null }));
vi.mock('../Switch', () => ({ Switch: () => null }));
vi.mock('../text/Text', () => ({ Text: () => null }));
vi.mock('../../resources/img/icons', () => ({ PenIcon: () => null }));
vi.mock('./twoFactorAuth.styles', () => ({}));
vi.mock('./TwoFactorSetupDialog', () => ({
	TwoFactorSetupDialog: (props: unknown) => {
		setupDialogMock(props);
		return null;
	}
}));
vi.mock('../profile/EncryptionSettings/BackupKeyAfterTwoFactorDialog', () => ({
	BackupKeyAfterTwoFactorDialog: (props: unknown) => {
		backupDialogMock(props);
		return null;
	}
}));

describe('TwoFactorAuth', () => {
	beforeEach(() => {
		setupDialogMock.mockClear();
		backupDialogMock.mockClear();
		locationState.current = { openTwoFactor: true };
	});

	it('keeps mandatory two-factor authentication setup dismissible', () => {
		const contextValue = {
			userData: {
				email: 'consultant@example.org',
				twoFactorAuth: {
					isActive: true,
					type: 'APP'
				}
			},
			reloadUserData: vi.fn()
		} as React.ContextType<typeof UserDataContext>;

		render(
			<UserDataContext.Provider value={contextValue}>
				<TwoFactorAuth />
			</UserDataContext.Provider>
		);

		expect(setupDialogMock).toHaveBeenLastCalledWith(
			expect.objectContaining({
				canDisable: true,
				canClose: true,
				open: true
			})
		);
	});

	it('opens the backup-key step after 2FA when navigated with showBackupKey', async () => {
		locationState.current = { openTwoFactor: true, showBackupKey: true };
		const reloadUserData = vi.fn().mockResolvedValue(undefined);
		const contextValue = {
			userData: {
				email: 'asker@example.org',
				twoFactorAuth: {
					isActive: false,
					type: 'APP'
				}
			},
			reloadUserData
		} as React.ContextType<typeof UserDataContext>;

		render(
			<UserDataContext.Provider value={contextValue}>
				<TwoFactorAuth />
			</UserDataContext.Provider>
		);

		const setupProps = setupDialogMock.mock.calls.at(-1)?.[0] as {
			onSetupComplete: () => Promise<void>;
			onClose: () => void;
		};
		await act(async () => {
			await setupProps.onSetupComplete();
			setupProps.onClose();
		});

		expect(backupDialogMock).toHaveBeenLastCalledWith(
			expect.objectContaining({ open: true })
		);
	});

	it('does not open the backup-key step after ordinary profile 2FA', async () => {
		const reloadUserData = vi.fn().mockResolvedValue(undefined);
		const contextValue = {
			userData: {
				email: 'consultant@example.org',
				twoFactorAuth: {
					isActive: false,
					type: 'APP'
				}
			},
			reloadUserData
		} as React.ContextType<typeof UserDataContext>;

		render(
			<UserDataContext.Provider value={contextValue}>
				<TwoFactorAuth />
			</UserDataContext.Provider>
		);

		const setupProps = setupDialogMock.mock.calls.at(-1)?.[0] as {
			onSetupComplete: () => Promise<void>;
			onClose: () => void;
		};
		await act(async () => {
			await setupProps.onSetupComplete();
			setupProps.onClose();
		});

		expect(backupDialogMock).toHaveBeenLastCalledWith(
			expect.objectContaining({ open: false })
		);
	});
});
