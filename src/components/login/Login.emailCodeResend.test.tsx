// @vitest-environment jsdom

import * as React from 'react';
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen
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
import { FETCH_ERRORS, FetchErrorWithOptions } from '../../api';
import { autoLogin } from '../registration/autoLogin';
import { setAppConfig } from '../../utils/appConfig';
import { Login } from './Login';

/*
 * ORISO-UserService#1338, slice 2: the e-mail code step of the app login.
 * Keycloak answers a password grant without a code with a 400 challenge and
 * mails a code; asking again without a code mails a new one. These tests
 * drive the real Login screen and stub only the token request.
 */

vi.mock('../registration/autoLogin', async (importOriginal) => ({
	...(await importOriginal<typeof import('../registration/autoLogin')>()),
	autoLogin: vi.fn(),
	redirectToApp: vi.fn()
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

// Interpolated values are appended so the countdown is observable.
const translate = (key: string, options?: Record<string, unknown>) =>
	options?.time ? `${key} ${options.time}` : key;
vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: translate })
}));

const RESEND = 'twoFactorAuth.activate.email.resend.new';
const COUNTDOWN = 'twoFactorAuth.activate.email.resend.countdown';
const SENT = 'twoFactorAuth.activate.email.resend.sent';

const emailChallenge = (extra: Record<string, unknown> = {}) =>
	new FetchErrorWithOptions(FETCH_ERRORS.BAD_REQUEST, {
		data: {
			error: 'invalid_grant',
			error_description: 'Missing totp',
			otpType: 'EMAIL',
			...extra
		}
	});

const flush = () =>
	act(async () => {
		await vi.advanceTimersByTimeAsync(0);
	});

const elapse = (ms: number) =>
	act(async () => {
		await vi.advanceTimersByTimeAsync(ms);
	});

const renderLogin = () =>
	render(
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
						value={
							{ userData: null, reloadUserData: vi.fn() } as any
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

/** Signs in with username and password and lands on the e-mail code step. */
const reachEmailCodeStep = async (challenge = emailChallenge()) => {
	vi.mocked(autoLogin).mockRejectedValueOnce(challenge);
	const view = renderLogin();
	fireEvent.change(
		view.container.querySelector('#username') as HTMLInputElement,
		{ target: { value: 'berater@example.org' } }
	);
	const password = view.container.querySelector(
		'#passwordInput'
	) as HTMLInputElement;
	fireEvent.change(password, { target: { value: 'secret' } });
	fireEvent.keyUp(password, { key: 'Enter' });
	await flush();
	expect(autoLogin).toHaveBeenCalledTimes(1);
	return view;
};

const resendButton = () =>
	screen.getByRole('button', {
		name: new RegExp(`^(${RESEND}|${COUNTDOWN})`)
	});

const status = () => screen.getByRole('status');

beforeEach(() => {
	vi.useFakeTimers();
	vi.mocked(autoLogin).mockReset();
	setAppConfig({ blockConsultantAppLogin: false } as never);
	window.localStorage.clear();
});

afterEach(() => {
	cleanup();
	vi.useRealTimers();
	vi.restoreAllMocks();
});

describe('Login e-mail code: resend link (#1338)', () => {
	it('counts down 30 s after the first mail and sends nothing while it runs', async () => {
		await reachEmailCodeStep();

		expect(resendButton().textContent).toBe(`${COUNTDOWN} 0:30`);
		expect(resendButton().getAttribute('aria-disabled')).toBe('true');

		fireEvent.click(resendButton());
		fireEvent.click(resendButton());
		await flush();
		expect(autoLogin).toHaveBeenCalledTimes(1);

		await elapse(3000);
		expect(resendButton().textContent).toBe(`${COUNTDOWN} 0:27`);

		await elapse(27000);
		expect(resendButton().textContent).toBe(RESEND);
		expect(resendButton().getAttribute('aria-disabled')).not.toBe('true');
	});

	it('sends one new code on the first click and ignores a quick second click', async () => {
		await reachEmailCodeStep();
		await elapse(30000);

		vi.mocked(autoLogin).mockRejectedValueOnce(emailChallenge());
		fireEvent.click(resendButton());
		fireEvent.click(resendButton());
		await flush();
		fireEvent.click(resendButton());
		await flush();

		expect(autoLogin).toHaveBeenCalledTimes(2);
		expect(vi.mocked(autoLogin).mock.calls[1][0]).not.toHaveProperty('otp');
		expect(resendButton().textContent).toBe(`${COUNTDOWN} 0:30`);
	});

	it('says "sent" only after the server has answered with the challenge', async () => {
		await reachEmailCodeStep();
		await elapse(30000);

		let answer!: (error: unknown) => void;
		vi.mocked(autoLogin).mockReturnValueOnce(
			new Promise((_, reject) => {
				answer = reject;
			})
		);
		fireEvent.click(resendButton());
		await flush();
		expect(status().textContent).not.toContain(SENT);

		await act(async () => answer(emailChallenge()));
		await flush();
		expect(status().textContent).toContain(SENT);
	});

	it('shows an error instead of "sent" when the request fails, and allows a retry', async () => {
		await reachEmailCodeStep();
		await elapse(30000);

		vi.mocked(autoLogin).mockRejectedValueOnce(new Error('keycloakLogin'));
		fireEvent.click(resendButton());
		await flush();

		expect(status().textContent).not.toContain(SENT);
		expect(status().textContent).toContain(
			'twoFactorAuth.activate.email.resend.failed'
		);
		expect(resendButton().textContent).toBe(RESEND);
	});

	it('explains the limit when the server refuses with 429', async () => {
		await reachEmailCodeStep();
		await elapse(30000);

		vi.mocked(autoLogin).mockRejectedValueOnce(
			new Error(FETCH_ERRORS.TOO_MANY_REQUESTS)
		);
		fireEvent.click(resendButton());
		await flush();

		expect(status().textContent).toContain(
			'twoFactorAuth.activate.email.resend.tooMany'
		);
		expect(status().textContent).not.toContain(SENT);
	});

	/*
	 * Review of ORISO-Admin#1124, same defect here: after the mail cap,
	 * Keycloak answers 429 with otpType EMAIL and the remaining wait. The
	 * code from the last mail still works.
	 */
	const codeLimit = (resendAvailableInSeconds = 745) =>
		new FetchErrorWithOptions(FETCH_ERRORS.TOO_MANY_REQUESTS, {
			data: {
				error: 'invalid_grant',
				error_description: 'Too many codes requested',
				otpType: 'EMAIL',
				resendAvailableInSeconds
			}
		});

	it('shows the code field with the server wait when the first sign-in hits the code limit', async () => {
		const view = await reachEmailCodeStep(codeLimit());

		expect(
			view.container.querySelector('.loginForm__otp--active')
		).not.toBeNull();
		expect(resendButton().textContent).toBe(`${COUNTDOWN} 12:25`);
		expect(resendButton().getAttribute('aria-disabled')).toBe('true');
		expect(status().textContent).toContain(
			'twoFactorAuth.activate.email.resend.tooMany'
		);
		expect(
			screen.queryByText('login.warning.failed.tooManyRequests')
		).toBeNull();
	});

	it('counts down the server wait, not 30 s, when a resend meets the code limit', async () => {
		await reachEmailCodeStep();
		await elapse(30000);

		vi.mocked(autoLogin).mockRejectedValueOnce(codeLimit());
		fireEvent.click(resendButton());
		await flush();

		expect(status().textContent).toContain(
			'twoFactorAuth.activate.email.resend.tooMany'
		);
		expect(resendButton().textContent).toBe(`${COUNTDOWN} 12:25`);
	});

	it('uses the wait time the server sends with the challenge', async () => {
		await reachEmailCodeStep(
			emailChallenge({ resendAvailableInSeconds: 12 })
		);

		expect(resendButton().textContent).toBe(`${COUNTDOWN} 0:12`);
		await elapse(12000);
		expect(resendButton().textContent).toBe(RESEND);
	});

	it('states that only the most recently sent code is valid', async () => {
		await reachEmailCodeStep();

		expect(
			screen.getByText('twoFactorAuth.activate.email.resend.onlyLatest')
		).toBeTruthy();
	});
});
