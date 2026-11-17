// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import {
	ActiveSessionContext,
	LocaleContext,
	UserDataContext
} from '../globalState';
import { AddonSessionMenuItems } from './AddonSessionMenuItems';
import { useCaseAddonApps } from './addonRegistry';
import { AvailableAddon } from './addonTypes';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, options?: { count?: number }) =>
			options?.count != null ? `${key}:${options.count}` : key
	})
}));

vi.mock('./addonRegistry', async (importOriginal) => ({
	...(await importOriginal<typeof import('./addonRegistry')>()),
	useCaseAddonApps: vi.fn()
}));

const addon: AvailableAddon = {
	name: 'digisucht-tools',
	version: '1.0.0',
	entry: '/e.js',
	apiBase: '/api',
	apps: [
		{
			id: 'goals',
			title: { de: 'Ziele', en: 'Goals' },
			description: { de: 'Ziele festhalten und teilen' },
			slots: ['asker.session-menu', 'consultant.session-menu'],
			badge: 2
		}
	]
};

const Search = () => (
	<output data-testid="search">{useLocation().search}</output>
);

const renderMenu = (roles: string[], onSelect = vi.fn()) => {
	vi.mocked(useCaseAddonApps).mockReturnValue([
		{ addon, app: addon.apps[0] }
	]);
	render(
		<MemoryRouter
			initialEntries={['/sessions/user/view/session/42?channel=team']}
		>
			<UserDataContext.Provider
				value={
					{
						userData: {
							userId: 'u1',
							userRoles: roles,
							grantedAuthorities: roles.includes('consultant')
								? ['AUTHORIZATION_CONSULTANT_DEFAULT']
								: ['AUTHORIZATION_USER_DEFAULT']
						}
					} as never
				}
			>
				<LocaleContext.Provider value={{ locale: 'de' } as never}>
					<ActiveSessionContext.Provider
						value={
							{
								activeSession: { item: { id: 42, agencyId: 5 } }
							} as never
						}
					>
						<AddonSessionMenuItems onSelect={onSelect} />
						<Search />
					</ActiveSessionContext.Provider>
				</LocaleContext.Provider>
			</UserDataContext.Provider>
		</MemoryRouter>
	);
	return onSelect;
};

describe('AddonSessionMenuItems', () => {
	afterEach(cleanup);

	it('lists the client apps of the session with title, description and badge', () => {
		renderMenu(['user']);

		expect(useCaseAddonApps).toHaveBeenCalledWith('asker.session-menu', {
			agencyId: 5,
			sessionId: 42
		});
		const entry = screen.getByRole('button', { name: /Ziele/ });
		expect(entry.textContent).toContain('Ziele festhalten und teilen');
		expect(
			screen.getByRole('img', { name: 'addons.badge:2' })
		).toBeTruthy();
	});

	it('asks for the counsellor slot for counsellors', () => {
		renderMenu(['consultant']);

		expect(useCaseAddonApps).toHaveBeenLastCalledWith(
			'consultant.session-menu',
			{ agencyId: 5, sessionId: 42 }
		);
	});

	it('closes the menu and opens the app beside the chat instead of a channel', () => {
		const onSelect = renderMenu(['user']);

		fireEvent.click(screen.getByRole('button', { name: /Ziele/ }));

		expect(onSelect).toHaveBeenCalledTimes(1);
		expect(screen.getByTestId('search').textContent).toBe(
			'?addon=digisucht-tools%2Fgoals'
		);
	});
});
