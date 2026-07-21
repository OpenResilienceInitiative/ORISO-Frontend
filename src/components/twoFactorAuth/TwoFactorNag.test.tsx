// @vitest-environment jsdom

import * as React from 'react';
import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserDataContext } from '../../globalState';
import { OVERLAY_FUNCTIONS } from '../overlay/Overlay';
import { TwoFactorNag } from './TwoFactorNag';

const overlayMock = vi.fn();
const stableMocks = vi.hoisted(() => ({
	openTwoFactorSettings: vi.fn(),
	appConfig: {
		twofactor: {
			startObligatoryHint: new Date(0),
			dateTwoFactorObligatory: new Date(0),
			messages: [
				{
					title: 'reminder-title',
					copy: 'reminder-copy',
					showClose: true
				},
				{
					title: 'mandatory-title',
					copy: 'mandatory-copy',
					showClose: false
				}
			]
		}
	},
	getDevToolbarOption: vi.fn(() => '1'),
	location: { state: {} }
}));

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

vi.mock('react-router-dom', () => ({
	useLocation: () => stableMocks.location
}));

vi.mock('../../hooks/useOpenTwoFactorSettings', () => ({
	useOpenTwoFactorSettings: () => stableMocks.openTwoFactorSettings
}));

vi.mock('../../hooks/useAppConfig', () => ({
	useAppConfig: () => stableMocks.appConfig
}));

vi.mock('../../globalState', async () => {
	const ReactModule = await import('react');

	return {
		UserDataContext: ReactModule.createContext(undefined)
	};
});

vi.mock('../devToolbar/DevToolbar', () => ({
	STORAGE_KEY_2FA: '2fa',
	useDevToolbar: () => ({
		getDevToolbarOption: stableMocks.getDevToolbarOption
	})
}));

vi.mock('../overlay/Overlay', () => ({
	OVERLAY_FUNCTIONS: { CLOSE: 'CLOSE', REDIRECT: 'REDIRECT' },
	Overlay: (props: unknown) => {
		overlayMock(props);
		return null;
	}
}));

vi.mock('./twoFactorNag.styles', () => ({}));

describe('TwoFactorNag', () => {
	beforeEach(() => {
		overlayMock.mockClear();
		stableMocks.openTwoFactorSettings.mockClear();
		stableMocks.appConfig.twofactor.dateTwoFactorObligatory = new Date(0);
	});

	it('opens mandatory two-factor setup directly without showing the reminder', async () => {
		const contextValue = {
			userData: {
				twoFactorAuth: { isActive: false, isEnabled: true }
			}
		} as React.ContextType<typeof UserDataContext>;

		render(
			<UserDataContext.Provider value={contextValue}>
				<TwoFactorNag />
			</UserDataContext.Provider>
		);

		await waitFor(() =>
			expect(stableMocks.openTwoFactorSettings).toHaveBeenCalledOnce()
		);
		expect(overlayMock).not.toHaveBeenCalled();
	});

	it('keeps the dismissible reminder before two-factor setup becomes mandatory', async () => {
		stableMocks.appConfig.twofactor.dateTwoFactorObligatory = new Date(
			Date.now() + 86_400_000
		);
		const contextValue = {
			userData: {
				twoFactorAuth: { isActive: false, isEnabled: true }
			}
		} as React.ContextType<typeof UserDataContext>;

		render(
			<UserDataContext.Provider value={contextValue}>
				<TwoFactorNag />
			</UserDataContext.Provider>
		);

		await waitFor(() => expect(overlayMock).toHaveBeenCalled());
		expect(stableMocks.openTwoFactorSettings).not.toHaveBeenCalled();

		const props = overlayMock.mock.lastCall?.[0] as {
			handleOverlayClose: unknown;
			item: { buttonSet: { function: string }[] };
		};
		expect(props.handleOverlayClose).toEqual(expect.any(Function));
		expect(props.item.buttonSet).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ function: OVERLAY_FUNCTIONS.CLOSE })
			])
		);
	});
});
