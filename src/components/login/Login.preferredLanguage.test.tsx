// @vitest-environment oriso-jsdom

import * as React from 'react';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import {
	LocaleContext,
	TenantContext,
	UserDataContext
} from '../../globalState';
import { GlobalComponentContext } from '../../globalState/provider/GlobalComponentContext';
import { UrlParamsContext } from '../../globalState/provider/UrlParamsProvider';
import { apiPatchUserData } from '../../api/apiPatchUserData';
import { autoLogin, redirectToApp } from '../registration/autoLogin';
import { setAppConfig } from '../../utils/appConfig';
import { Login } from './Login';

/*
 * #1844: the app applies the profile language after sign-in. A language picked
 * on the login screen that equals the browser default was never saved, so a
 * new counsellor account (stored as German) switched the screen to German.
 */

vi.mock('../registration/autoLogin', async (importOriginal) => ({
	...(await importOriginal<typeof import('../registration/autoLogin')>()),
	autoLogin: vi.fn(),
	redirectToApp: vi.fn()
}));
vi.mock('../../api/apiPatchUserData', () => ({
	apiPatchUserData: vi.fn()
}));
vi.mock('../stageLayout/StageLayout', () => ({
	StageLayout: ({ children }: any) => <div>{children}</div>
}));
vi.mock('./LoginSecurityExplainer', () => ({
	LoginSecurityExplainer: () => null
}));
vi.mock('../../hooks/useAppConfig', () => ({
	useAppConfig: () => ({ urls: { toRegistration: '' } })
}));
vi.mock('lottie-react', () => ({ default: () => null }));
vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

const signIn = (locale: string, profileLanguage: string) => {
	const reloadUserData = vi.fn().mockResolvedValue({
		userId: 'counsellor-1',
		preferredLanguage: profileLanguage,
		grantedAuthorities: ['AUTHORIZATION_CONSULTANT_DEFAULT']
	});
	const view = render(
		<MemoryRouter initialEntries={['/login']}>
			<LocaleContext.Provider
				value={
					{
						locale,
						// The browser default: the same language as the screen.
						initLocale: locale,
						selectableLocales: []
					} as any
				}
			>
				<TenantContext.Provider value={{ tenant: null } as any}>
					<UserDataContext.Provider
						value={{ userData: null, reloadUserData } as any}
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
	fireEvent.change(
		view.container.querySelector('#username') as HTMLInputElement,
		{ target: { value: 'counsellor@example.org' } }
	);
	const password = view.container.querySelector(
		'#passwordInput'
	) as HTMLInputElement;
	fireEvent.change(password, { target: { value: 'secret' } });
	fireEvent.keyUp(password, { key: 'Enter' });
};

beforeEach(() => {
	vi.mocked(autoLogin)
		.mockReset()
		.mockResolvedValue(undefined as never);
	vi.mocked(redirectToApp).mockReset();
	vi.mocked(apiPatchUserData)
		.mockReset()
		.mockResolvedValue({} as never);
	setAppConfig({ blockConsultantAppLogin: false } as never);
	window.localStorage.clear();
	window.sessionStorage.clear();
});

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

describe('Login keeps the language of the login screen (#1844)', () => {
	it('saves a language picked on the login screen, even when it equals the browser default', async () => {
		window.sessionStorage.setItem('localeChosen', 'en');
		signIn('en', 'de');

		await waitFor(() => expect(redirectToApp).toHaveBeenCalled());
		expect(apiPatchUserData).toHaveBeenCalledWith({
			preferredLanguage: 'en'
		});
	});

	it('keeps the profile language when the screen only shows the detected browser language', async () => {
		signIn('en', 'de');

		await waitFor(() => expect(redirectToApp).toHaveBeenCalled());
		expect(apiPatchUserData).not.toHaveBeenCalled();
	});

	it('leaves the profile alone when it already matches', async () => {
		signIn('de', 'de');

		await waitFor(() => expect(redirectToApp).toHaveBeenCalled());
		expect(apiPatchUserData).not.toHaveBeenCalled();
	});
});
