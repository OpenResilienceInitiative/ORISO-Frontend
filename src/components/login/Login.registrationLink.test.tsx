// @vitest-environment jsdom

import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	LocaleContext,
	TenantContext,
	UserDataContext
} from '../../globalState';
import { GlobalComponentContext } from '../../globalState/provider/GlobalComponentContext';
import { UrlParamsContext } from '../../globalState/provider/UrlParamsProvider';
import { INVITE_LOGIN_STATE } from '../registration/groupInviteEntry/groupInviteEntryState';
import { Login } from './Login';

const stageLayoutProps = vi.hoisted(() => ({ registrationUrl: '' }));

vi.mock('../stageLayout/StageLayout', () => ({
	StageLayout: ({ children, registrationUrl }: any) => {
		stageLayoutProps.registrationUrl = registrationUrl;
		return <div>{children}</div>;
	}
}));

vi.mock('./LoginSecurityExplainer', () => ({
	LoginSecurityExplainer: () => null
}));

vi.mock('../../hooks/useAppConfig', () => ({
	useAppConfig: () => ({
		urls: { toRegistration: 'https://app.oriso-dev.site/registration' }
	})
}));

vi.mock('lottie-react', () => ({ default: () => null }));

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	stageLayoutProps.registrationUrl = '';
});

const renderInviteLogin = () =>
	render(
		<MemoryRouter
			initialEntries={[
				{
					pathname: '/login',
					search: '?gcid=1017&aid=42',
					// The newcomer chose "log in" on the entry screen, so the
					// form renders instead of redirecting back to that screen.
					state: INVITE_LOGIN_STATE
				}
			]}
		>
			<LocaleContext.Provider
				value={
					{
						locale: 'de',
						initLocale: 'de',
						selectableLocales: []
					} as any
				}
			>
				<TenantContext.Provider value={{ tenant: null } as any}>
					<UserDataContext.Provider
						value={
							{
								userData: null,
								reloadUserData: vi.fn()
							} as any
						}
					>
						<GlobalComponentContext.Provider
							value={{ Stage: () => null } as any}
						>
							<UrlParamsContext.Provider
								value={
									{ consultant: null, loaded: true } as any
								}
							>
								<Login />
							</UrlParamsContext.Provider>
						</GlobalComponentContext.Provider>
					</UserDataContext.Provider>
				</TenantContext.Provider>
			</LocaleContext.Provider>
		</MemoryRouter>
	);

const expectInvite = (url: string) => {
	const params = new URL(url).searchParams;
	expect(params.get('gcid')).toBe('1017');
	expect(params.get('aid')).toBe('42');
};

describe('Login registration keeps the group invitation (#1499)', () => {
	it('opens registration with the group and its agency', () => {
		const open = vi.spyOn(window, 'open').mockImplementation(() => null);
		renderInviteLogin();

		fireEvent.click(
			screen.getByRole('button', { name: 'login.register.linkLabel' })
		);

		expect(open).toHaveBeenCalledTimes(1);
		expectInvite(open.mock.calls[0][0] as string);
	});

	it('hands the same invitation URL to the stage layout link', () => {
		renderInviteLogin();

		expectInvite(stageLayoutProps.registrationUrl);
	});
});
