// @vitest-environment jsdom

import * as React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UserDataContext } from '../../../globalState';
import { NotificationSettingsPanel } from './index';

const tenant = vi.hoisted(() => ({ current: null as unknown }));
vi.mock('../../../globalState/provider/TenantProvider', () => ({
	useTenant: () => tenant.current
}));
vi.mock('../../../hooks/useAppConfig', () => ({
	useAppConfig: () => ({ releaseToggles: { enableNewNotifications: true } })
}));
vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));
vi.mock('./DisplayFilterProfileSection', () => ({
	DisplayFilterProfileSection: () => null
}));
vi.mock('./DoNotDisturbControl', () => ({ DoNotDisturbControl: () => null }));

const renderPanel = (temporaryAccount?: boolean) =>
	render(
		<UserDataContext.Provider
			value={
				{
					userData: {
						grantedAuthorities: ['AUTHORIZATION_USER_DEFAULT'],
						temporaryAccount
					}
				} as never
			}
		>
			<NotificationSettingsPanel />
		</UserDataContext.Provider>
	);

/** UserService#1662: a temporary account gets no browser pop-ups and no e-mail. */
describe('NotificationSettingsPanel for a temporary account', () => {
	afterEach(() => {
		cleanup();
		tenant.current = null;
	});

	it('hides the browser opt-in, its preview and the e-mail link', () => {
		tenant.current = { settings: {} };
		renderPanel(true);
		expect(
			screen.queryByText('profile.notificationSettings.browser.title')
		).toBeNull();
		expect(
			screen.queryByText('profile.notificationSettings.preview.title')
		).toBeNull();
		expect(
			screen.queryByRole('link', { name: 'profile.notifications.title' })
		).toBeNull();
		// In-app settings stay.
		expect(
			screen.getByText('profile.notificationSettings.globalMute')
		).toBeTruthy();
	});

	it('shows them again once the account is kept', () => {
		tenant.current = { settings: {} };
		renderPanel(false);
		// jsdom has no Notification API: the browser row shows its hint.
		expect(
			screen.getByText('profile.notificationSettings.preview.title')
		).toBeTruthy();
		expect(
			screen.getByRole('link', { name: 'profile.notifications.title' })
		).toBeTruthy();
	});
});
