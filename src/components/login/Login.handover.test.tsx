// @vitest-environment oriso-jsdom

import * as React from 'react';
import {
	act,
	cleanup,
	fireEvent,
	render,
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
import { apiPatchUserData } from '../../api/apiPatchUserData';
import { autoLogin, redirectToApp } from '../registration/autoLogin';
import { setAppConfig } from '../../utils/appConfig';
import { FETCH_ERRORS } from '../../api/fetchData';
import { TWO_FACTOR_TYPES } from '../twoFactorAuth/twoFactorAuthConstants';
import { Login } from './Login';
import {
	isLoginHandoverActive,
	LOGIN_HANDOVER_STORAGE_KEY,
	resetLoginHandoverForTests
} from '../app/loginHandover';

/*
 * Login flicker: after "Login" the page went red → white (tenant switch
 * modal) → red (login form during Matrix token and user data) → white
 * (document load) → app. Once the credentials are accepted one handover
 * screen must cover everything until the app is ready, and the user data
 * must load in parallel with the Matrix token instead of after it.
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
vi.mock('../app/appChunks', () => ({
	warmAppChunks: vi.fn(),
	warmCryptoEngine: vi.fn()
}));
vi.mock('../twoFactorAuth/TwoFactorAuthResendMail', () => ({
	TwoFactorAuthResendMail: ({ onResend }: any) => (
		<button type="button" data-cy="test-resend" onClick={() => onResend()}>
			resend
		</button>
	)
}));
vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

const signIn = (reloadUserData: ReturnType<typeof vi.fn>) => {
	const view = render(
		<MemoryRouter initialEntries={['/login']}>
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
	return view;
};

const counsellor = {
	userId: 'counsellor-1',
	preferredLanguage: 'de',
	grantedAuthorities: ['AUTHORIZATION_CONSULTANT_DEFAULT']
};

beforeEach(() => {
	vi.mocked(autoLogin).mockReset();
	vi.mocked(redirectToApp).mockReset();
	vi.mocked(apiPatchUserData)
		.mockReset()
		.mockResolvedValue({} as never);
	setAppConfig({ blockConsultantAppLogin: false } as never);
	window.localStorage.clear();
	window.sessionStorage.clear();
	resetLoginHandoverForTests(false);
});

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	resetLoginHandoverForTests(false);
});

describe('Login hands over behind one loading screen', () => {
	it('ignores an old success after the browser restores the form for another submission', async () => {
		let finishOlder!: () => void;
		vi.mocked(autoLogin)
			.mockImplementationOnce(
				() =>
					new Promise<void>((resolve) => {
						finishOlder = resolve;
					})
			)
			.mockReturnValueOnce(new Promise(() => undefined));
		const reloadUserData = vi.fn().mockResolvedValue(counsellor);
		const view = signIn(reloadUserData);
		const older = vi.mocked(autoLogin).mock.calls[0][0];
		fireEvent(
			window,
			Object.assign(new Event('pageshow'), { persisted: true })
		);
		expect(older.isCurrentAttempt?.()).toBe(false);
		fireEvent.keyUp(view.container.querySelector('#passwordInput')!, {
			key: 'Enter'
		});
		expect(autoLogin).toHaveBeenCalledTimes(2);
		await act(async () => finishOlder());
		expect(reloadUserData).not.toHaveBeenCalled();
		expect(redirectToApp).not.toHaveBeenCalled();
		expect(
			view.container
				.querySelector('.loginForm__pane')
				?.hasAttribute('inert')
		).toBe(true);
	});

	it('covers the page from accepted credentials until the document load', async () => {
		let releaseMatrix: () => void = () => undefined;
		vi.mocked(autoLogin).mockImplementation((async (props: any) => {
			props.onCredentialsAccepted?.();
			// The Matrix token is still loading.
			await new Promise<void>((resolve) => {
				releaseMatrix = resolve;
			});
		}) as never);
		const reloadUserData = vi.fn().mockResolvedValue(counsellor);
		let markAtRedirect: string | null = null;
		vi.mocked(redirectToApp).mockImplementation(() => {
			markAtRedirect = sessionStorage.getItem(LOGIN_HANDOVER_STORAGE_KEY);
		});

		signIn(reloadUserData);

		await waitFor(() => expect(isLoginHandoverActive()).toBe(true));
		// User data is already on its way while the Matrix token loads.
		expect(reloadUserData).toHaveBeenCalledTimes(1);

		releaseMatrix();
		await waitFor(() => expect(redirectToApp).toHaveBeenCalled());
		// postLogin reused that request instead of asking again.
		expect(reloadUserData).toHaveBeenCalledTimes(1);
		// The next document continues the screen.
		expect(markAtRedirect).not.toBeNull();
		expect(isLoginHandoverActive()).toBe(true);
	});

	it('shows the form again when the credentials are refused', async () => {
		vi.mocked(autoLogin).mockRejectedValue(new Error('401') as never);
		signIn(vi.fn());

		await waitFor(() => expect(autoLogin).toHaveBeenCalled());
		await waitFor(() => expect(isLoginHandoverActive()).toBe(false));
		expect(sessionStorage.getItem(LOGIN_HANDOVER_STORAGE_KEY)).toBeNull();
	});

	it('shows the form again when the user data cannot be loaded', async () => {
		vi.mocked(autoLogin).mockImplementation((async (props: any) => {
			props.onCredentialsAccepted?.();
		}) as never);
		const reloadUserData = vi.fn().mockRejectedValue(new Error('500'));

		signIn(reloadUserData);

		await waitFor(() => expect(reloadUserData).toHaveBeenCalled());
		await waitFor(() => expect(isLoginHandoverActive()).toBe(false));
		expect(redirectToApp).not.toHaveBeenCalled();
	});

	it('keeps a newer attempt covered when an older one fails late', async () => {
		const emailCodeRequired = Object.assign(
			new Error(FETCH_ERRORS.BAD_REQUEST),
			{ options: { data: { otpType: TWO_FACTOR_TYPES.EMAIL } } }
		);
		let rejectOlder: (error: unknown) => void = () => undefined;
		vi.mocked(autoLogin)
			// Password only: the realm asks for the e-mail code.
			.mockRejectedValueOnce(emailCodeRequired as never)
			// The code is submitted; its answer is still out.
			.mockImplementationOnce(
				() =>
					new Promise<void>((_, reject) => {
						rejectOlder = reject;
					}) as never
			)
			// A resend meanwhile is accepted and starts the handover.
			.mockImplementationOnce((async (props: any) => {
				props.onCredentialsAccepted?.();
				await new Promise(() => undefined);
			}) as never);

		const view = signIn(
			vi.fn().mockReturnValue(new Promise(() => undefined))
		);
		const otp = await waitFor(() => {
			const field = view.container.querySelector('#otp');
			expect(field).not.toBeNull();
			return field as HTMLInputElement;
		});
		fireEvent.change(otp, { target: { value: '123456' } });
		fireEvent.keyUp(otp, { key: 'Enter' });
		await waitFor(() => expect(autoLogin).toHaveBeenCalledTimes(2));

		fireEvent.click(
			view.container.querySelector('[data-cy="test-resend"]') as Element
		);
		await waitFor(() => expect(isLoginHandoverActive()).toBe(true));

		rejectOlder(new Error(FETCH_ERRORS.BAD_REQUEST));
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(isLoginHandoverActive()).toBe(true);
	});
});
