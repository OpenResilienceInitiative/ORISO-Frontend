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

const renderPanel = (role: 'asker' | 'consultant') =>
	render(
		<UserDataContext.Provider
			value={
				{
					userData: {
						grantedAuthorities: [
							role === 'consultant'
								? 'AUTHORIZATION_CONSULTANT_DEFAULT'
								: 'AUTHORIZATION_USER_DEFAULT'
						]
					}
				} as never
			}
		>
			<NotificationSettingsPanel />
		</UserDataContext.Provider>
	);

const emailLink = () =>
	screen.queryByRole('link', { name: 'profile.notifications.title' });

/** #1979: no link to an e-mail panel the Admin permissions hide. */
describe('NotificationSettingsPanel e-mail link', () => {
	afterEach(() => {
		cleanup();
		tenant.current = null;
	});

	it('omits the link for an advice seeker whose Träger forbids e-mail', () => {
		tenant.current = { settings: { featureAskerEmailEnabled: false } };
		renderPanel('asker');
		expect(emailLink()).toBeNull();
	});

	it('keeps the link for an advice seeker where e-mail is permitted', () => {
		tenant.current = { settings: {} };
		renderPanel('asker');
		expect(emailLink()).not.toBeNull();
	});

	it('keeps the link for counsellors', () => {
		tenant.current = { settings: { featureAskerEmailEnabled: false } };
		renderPanel('consultant');
		expect(emailLink()).not.toBeNull();
	});
});
