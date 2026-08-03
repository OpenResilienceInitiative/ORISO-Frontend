// @vitest-environment jsdom

import * as React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserDataContext } from '../../globalState';
import { OVERLAY_FUNCTIONS } from '../overlay/Overlay';
import { TWO_FACTOR_NAG_DISMISSED_KEY, TwoFactorNag } from './TwoFactorNag';

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

type OverlayProps = {
	handleOverlayClose: unknown;
	handleOverlay: (buttonFunction: string) => void;
	item: { headline: string; buttonSet: { function: string }[] };
};

const contextValue = {
	userData: {
		twoFactorAuth: { isActive: false, isEnabled: true }
	}
} as React.ContextType<typeof UserDataContext>;

const renderNag = () =>
	render(
		<UserDataContext.Provider value={contextValue}>
			<TwoFactorNag />
		</UserDataContext.Provider>
	);

describe('TwoFactorNag', () => {
	beforeEach(() => {
		overlayMock.mockClear();
		stableMocks.openTwoFactorSettings.mockClear();
		stableMocks.appConfig.twofactor.dateTwoFactorObligatory = new Date(0);
		sessionStorage.clear();
	});

	it('shows the obligatory nag on top of the current view instead of redirecting (#841)', async () => {
		renderNag();

		await waitFor(() => expect(overlayMock).toHaveBeenCalled());
		expect(stableMocks.openTwoFactorSettings).not.toHaveBeenCalled();

		const props = overlayMock.mock.lastCall?.[0] as OverlayProps;
		expect(props.item.headline).toEqual('mandatory-title');
		// The obligatory nag must stay dismissible: a non-closable overlay
		// blocks every view underneath it.
		expect(props.handleOverlayClose).toEqual(expect.any(Function));
		expect(props.item.buttonSet).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ function: OVERLAY_FUNCTIONS.CLOSE })
			])
		);
	});

	it('persists dismissal for the browser session so a reload does not re-open the nag', async () => {
		const { unmount } = renderNag();

		await waitFor(() => expect(overlayMock).toHaveBeenCalled());
		const props = overlayMock.mock.lastCall?.[0] as OverlayProps;

		act(() => props.handleOverlay(OVERLAY_FUNCTIONS.CLOSE));
		expect(sessionStorage.getItem(TWO_FACTOR_NAG_DISMISSED_KEY)).toEqual(
			'true'
		);

		// Fresh mount simulates a full page load in the same browser session
		unmount();
		overlayMock.mockClear();
		renderNag();

		await act(async () => Promise.resolve());
		expect(overlayMock).not.toHaveBeenCalled();
		expect(stableMocks.openTwoFactorSettings).not.toHaveBeenCalled();
	});

	it('opens two-factor settings only via the primary button and persists dismissal', async () => {
		renderNag();

		await waitFor(() => expect(overlayMock).toHaveBeenCalled());
		const props = overlayMock.mock.lastCall?.[0] as OverlayProps;

		act(() => props.handleOverlay(OVERLAY_FUNCTIONS.REDIRECT));
		expect(stableMocks.openTwoFactorSettings).toHaveBeenCalledOnce();
		expect(sessionStorage.getItem(TWO_FACTOR_NAG_DISMISSED_KEY)).toEqual(
			'true'
		);
	});

	it('keeps the dismissible reminder before two-factor setup becomes mandatory', async () => {
		stableMocks.appConfig.twofactor.dateTwoFactorObligatory = new Date(
			Date.now() + 86_400_000
		);

		renderNag();

		await waitFor(() => expect(overlayMock).toHaveBeenCalled());
		expect(stableMocks.openTwoFactorSettings).not.toHaveBeenCalled();

		const props = overlayMock.mock.lastCall?.[0] as OverlayProps;
		expect(props.item.headline).toEqual('reminder-title');
		expect(props.handleOverlayClose).toEqual(expect.any(Function));
		expect(props.item.buttonSet).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ function: OVERLAY_FUNCTIONS.CLOSE })
			])
		);
	});
});
