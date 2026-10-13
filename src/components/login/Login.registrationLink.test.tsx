// @vitest-environment jsdom

import * as React from 'react';
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	LocaleContext,
	TenantContext,
	UserDataContext
} from '../../globalState';
import { GlobalComponentContext } from '../../globalState/provider/GlobalComponentContext';
import { UrlParamsContext } from '../../globalState/provider/UrlParamsProvider';
import { INVITE_LOGIN_STATE } from '../registration/groupInviteEntry/groupInviteEntryState';
import { Login } from './Login';

import { apiGetUserData } from '../../api';
import { redirectToApp } from '../registration/autoLogin';
import { setAppConfig } from '../../utils/appConfig';
import { UserDataInterface } from '../../globalState/interfaces';

const stageLayoutProps = vi.hoisted(() => ({ registrationUrl: '' }));

vi.mock('../../api', async (importOriginal) => ({
	...(await importOriginal<typeof import('../../api')>()),
	apiGetUserData: vi.fn()
}));
vi.mock('../registration/autoLogin', async (importOriginal) => ({
	...(await importOriginal<typeof import('../registration/autoLogin')>()),
	redirectToApp: vi.fn()
}));
const translate = (key: string) => key;

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
	useTranslation: () => ({ t: translate })
}));

beforeEach(() => {
	vi.clearAllMocks();
	setAppConfig({ blockConsultantAppLogin: false } as never);
	window.localStorage.clear();
});

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	stageLayoutProps.registrationUrl = '';
});

const renderInviteLogin = (search = '?gcid=1017&aid=42') =>
	render(
		<MemoryRouter
			initialEntries={[
				{
					pathname: '/login',
					search,
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

describe('authenticated self-help appointment entry uses fresh roles', () => {
	const freshUser = (authority: string) =>
		({
			grantedAuthorities: [authority]
		}) as UserDataInterface;
	const lookup = () => {
		window.localStorage.setItem('auth.keycloak', 'local-test-session');
	};

	it.each([
		['AUTHORIZATION_USER_DEFAULT', { sessionId: 1017 }],
		[
			'AUTHORIZATION_CONSULTANT_DEFAULT',
			{ restorePath: '/sessions/consultant/sessionView/session/1017' }
		]
	])(
		'opens the existing appointment for %s without assigning a group',
		async (authority, target) => {
			lookup();
			vi.mocked(apiGetUserData).mockResolvedValueOnce(
				freshUser(authority)
			);
			renderInviteLogin('?seriesId=1017');
			await waitFor(() =>
				expect(redirectToApp).toHaveBeenCalledWith(undefined, target)
			);
			expect(apiGetUserData).toHaveBeenCalledOnce();
		}
	);

	it('does not redirect an unrelated role or an invalid appointment id', async () => {
		lookup();
		vi.mocked(apiGetUserData).mockResolvedValue(
			freshUser('AUTHORIZATION_ADMIN')
		);
		const view = renderInviteLogin('?seriesId=1017');
		await waitFor(() => expect(apiGetUserData).toHaveBeenCalledOnce());
		expect(redirectToApp).not.toHaveBeenCalled();
		view.unmount();
		vi.mocked(apiGetUserData).mockResolvedValueOnce(
			freshUser('AUTHORIZATION_USER_DEFAULT')
		);
		renderInviteLogin('?seriesId=https://other.invalid');
		await waitFor(() => expect(apiGetUserData).toHaveBeenCalledTimes(2));
		expect(redirectToApp).not.toHaveBeenCalled();
	});

	it('preserves the configured counsellor login block before appointment routing', async () => {
		lookup();
		setAppConfig({ blockConsultantAppLogin: true } as never);
		vi.mocked(apiGetUserData).mockResolvedValueOnce(
			freshUser('AUTHORIZATION_CONSULTANT_DEFAULT')
		);
		renderInviteLogin('?seriesId=1017');
		await screen.findByText('login.warning.failed.consultantBlocked');
		expect(redirectToApp).not.toHaveBeenCalled();
		expect(window.localStorage.getItem('auth.keycloak')).toBeNull();
	});

	it('ignores a lookup that completes after the login screen was left', async () => {
		lookup();
		let resolve!: (user: UserDataInterface) => void;
		vi.mocked(apiGetUserData).mockReturnValueOnce(
			new Promise((done) => {
				resolve = done;
			})
		);
		const view = renderInviteLogin('?seriesId=1017');
		view.unmount();
		await act(async () => resolve(freshUser('AUTHORIZATION_USER_DEFAULT')));
		expect(redirectToApp).not.toHaveBeenCalled();
	});
});
