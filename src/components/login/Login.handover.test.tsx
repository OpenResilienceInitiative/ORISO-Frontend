// @vitest-environment jsdom
import * as React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LocaleContext } from '../../globalState/context/LocaleContext';
import { UserDataContext } from '../../globalState/context/UserDataContext';
import { TenantContext } from '../../globalState/provider/TenantProvider';
import { GlobalComponentContext } from '../../globalState/provider/GlobalComponentContext';
import { UrlParamsContext } from '../../globalState/provider/UrlParamsProvider';
import { Login } from './Login';

const { autoLogin, redirectToApp } = vi.hoisted(() => ({
	autoLogin: vi.fn(() => Promise.resolve()),
	redirectToApp: vi.fn()
}));

vi.mock('../../globalState', async () => {
	const [{ LocaleContext }, { UserDataContext }, { TenantContext }] =
		await Promise.all([
			import('../../globalState/context/LocaleContext'),
			import('../../globalState/context/UserDataContext'),
			import('../../globalState/provider/TenantProvider')
		]);
	const AUTHORITIES = {
		CONSULTANT_DEFAULT: 'AUTHORIZATION_CONSULTANT_DEFAULT',
		ASKER_DEFAULT: 'AUTHORIZATION_USER_DEFAULT'
	};
	return {
		LocaleContext,
		UserDataContext,
		TenantContext,
		AUTHORITIES,
		hasUserAuthority: (
			authority: string,
			userData?: { grantedAuthorities?: string[] }
		) => Boolean(userData?.grantedAuthorities?.includes(authority))
	};
});

vi.mock('../registration/autoLogin', async (importOriginal) => ({
	...(await importOriginal<typeof import('../registration/autoLogin')>()),
	autoLogin,
	redirectToApp
}));

vi.mock('../../utils/appConfig', () => ({
	appConfig: {
		blockConsultantAppLogin: false,
		urls: { redirectToApp: '/app' }
	}
}));

vi.mock('../../hooks/useAppConfig', () => ({
	useAppConfig: () => ({
		blockConsultantAppLogin: false,
		urls: {
			redirectToApp: '/app',
			toRegistration: '/registration'
		}
	})
}));

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

vi.mock('../../utils/useIsFirstVisit', () => ({ default: () => false }));
vi.mock('../../utils/tenantSettingsHelper', () => ({
	getTenantSettings: () => ({ featureToolsEnabled: false })
}));

vi.mock('../stageLayout/StageLayout', () => ({
	StageLayout: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	)
}));

vi.mock('../form/OrisoTextField', () => ({
	OrisoTextField: ({
		id,
		name,
		type,
		value,
		onChange,
		inputProps
	}: React.InputHTMLAttributes<HTMLInputElement> & {
		inputProps?: React.InputHTMLAttributes<HTMLInputElement>;
	}) => (
		<input
			id={id}
			name={name}
			type={type}
			value={value}
			onChange={onChange}
			{...inputProps}
		/>
	)
}));

vi.mock('../button/Button', () => ({
	BUTTON_TYPES: { PRIMARY: 'PRIMARY' },
	Button: ({
		buttonHandle,
		disabled,
		item
	}: {
		buttonHandle?: () => void;
		disabled?: boolean;
		item: { label?: string };
	}) => (
		<button disabled={disabled} onClick={buttonHandle}>
			{item.label}
		</button>
	)
}));

vi.mock('../text/Text', () => ({
	Text: ({ text }: { text: string }) => <span>{text}</span>
}));
vi.mock('./LoginSecurityExplainer', () => ({
	LoginSecurityExplainer: () => null
}));
vi.mock('../twoFactorAuth/TwoFactorAuthResendMail', () => ({
	TwoFactorAuthResendMail: () => null
}));

const user = {
	userId: 'fresh-login-user',
	preferredLanguage: 'de',
	formalLanguage: false,
	grantedAuthorities: []
};

describe('successful login hand-over', () => {
	beforeEach(() => {
		autoLogin.mockClear();
		redirectToApp.mockClear();
	});

	it('loads /app as a document after authentication instead of leaving the login route mounted', async () => {
		const reloadUserData = vi.fn().mockResolvedValue(user);

		render(
			<LocaleContext.Provider
				value={{
					locale: 'de',
					initLocale: 'de',
					setLocale: vi.fn(),
					locales: ['de'],
					selectableLocales: ['de']
				}}
			>
				<TenantContext.Provider
					value={{
						tenant: { settings: {} } as any,
						setTenant: vi.fn()
					}}
				>
					<UserDataContext.Provider
						value={{
							userData: null,
							setUserData: vi.fn(),
							reloadUserData
						}}
					>
						<GlobalComponentContext.Provider
							value={{ Stage: () => null }}
						>
							<UrlParamsContext.Provider
								value={{
									agency: null,
									consultingType: null,
									consultant: null,
									topic: null,
									loaded: true,
									slugFallback: undefined,
									zipcode: undefined
								}}
							>
								<MemoryRouter initialEntries={['/login']}>
									<Routes>
										<Route
											path="/login"
											element={<Login />}
										/>
										<Route
											path="/app"
											element={
												<div>authenticated app</div>
											}
										/>
									</Routes>
								</MemoryRouter>
							</UrlParamsContext.Provider>
						</GlobalComponentContext.Provider>
					</UserDataContext.Provider>
				</TenantContext.Provider>
			</LocaleContext.Provider>
		);

		fireEvent.change(screen.getByLabelText('login.user.label'), {
			target: { value: 'valid-user' }
		});
		fireEvent.change(screen.getByLabelText('login.password.label'), {
			target: { value: 'valid-password' }
		});
		fireEvent.click(
			screen.getByRole('button', { name: 'login.button.label' })
		);

		await waitFor(() => expect(reloadUserData).toHaveBeenCalledOnce());
		expect(redirectToApp).toHaveBeenCalledWith(null, {
			restorePath: null
		});
	});
});
