// @vitest-environment oriso-jsdom

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
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';
import {
	LocaleContext,
	TenantContext,
	UserDataContext
} from '../../globalState';
import { GlobalComponentContext } from '../../globalState/provider/GlobalComponentContext';
import { UrlParamsContext } from '../../globalState/provider/UrlParamsProvider';
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

const renderLogin = (search: string) =>
	render(
		<MemoryRouter
			initialEntries={[
				{
					pathname: '/login',
					search
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

describe('Login after a deleted guest account was signed out (FE#2550)', () => {
	it('says that the guest account was deleted after the conversation', () => {
		renderLogin('?notice=temporary-account-deleted');

		expect(screen.getByRole('status').textContent).toBe(
			'temporaryAccount.signedOutNotice'
		);
	});

	it('shows no such notice on an ordinary visit', () => {
		renderLogin('');

		expect(screen.queryByRole('status')).toBeNull();
	});

	it('ignores an unknown notice', () => {
		renderLogin('?notice=anything');

		expect(screen.queryByRole('status')).toBeNull();
	});
});
