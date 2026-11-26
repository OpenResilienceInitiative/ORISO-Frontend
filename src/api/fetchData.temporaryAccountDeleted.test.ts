// @vitest-environment oriso-jsdom
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';

import { fetchData, FETCH_ERRORS, FETCH_METHODS } from './fetchData';
import { setAppConfig } from '../utils/appConfig';

const logout = vi.fn();
vi.mock('../components/logout/logout', () => ({
	logout: (...args: unknown[]) => logout(...args)
}));

const redirectToErrorPage = vi.fn();
vi.mock('../components/error/errorHandling', async (importOriginal) => ({
	...(await importOriginal<
		typeof import('../components/error/errorHandling')
	>()),
	redirectToErrorPage: (...args: unknown[]) => redirectToErrorPage(...args)
}));

const setPathname = (pathname: string) => {
	Object.defineProperty(window, 'location', {
		configurable: true,
		writable: true,
		value: { ...window.location, pathname, reload: vi.fn() }
	});
};

class TestRequest {
	url: string;
	headers: Headers;

	constructor(url: string, init: { headers?: HeadersInit } = {}) {
		this.url = url;
		this.headers = new Headers(init.headers);
	}
}

const deletedGuestAnswer = {
	status: 401,
	headers: new Headers({ 'X-Reason': 'TEMPORARY_ACCOUNT_DELETED' })
};

const LOGIN_WITH_NOTICE =
	'https://app.test.local/login?notice=temporary-account-deleted';

beforeEach(() => {
	document.cookie = 'keycloak=guest-token';
	setPathname('/sessions/user/view');
	setAppConfig({
		urls: { toLogin: 'https://app.test.local/login' }
	} as never);
	vi.stubGlobal('Request', TestRequest);
});

afterEach(() => {
	document.cookie = 'keycloak=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});

describe('fetchData when the guest account was deleted after the conversation (FE#2550)', () => {
	it('signs the guest out and sends them to the login page with the notice', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(deletedGuestAnswer));

		await expect(
			fetchData({
				url: 'https://api.test.local/service/users/data',
				method: FETCH_METHODS.GET
			})
		).rejects.toThrow(FETCH_ERRORS.UNAUTHORIZED);

		expect(logout).toHaveBeenCalledTimes(1);
		expect(logout).toHaveBeenCalledWith(true, LOGIN_WITH_NOTICE);
		expect(redirectToErrorPage).not.toHaveBeenCalled();
	});

	it('does so even when the caller handles other errors itself', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(deletedGuestAnswer));

		await expect(
			fetchData({
				url: 'https://api.test.local/service/users/data',
				method: FETCH_METHODS.GET,
				responseHandling: [FETCH_ERRORS.CATCH_ALL]
			})
		).rejects.toThrow(FETCH_ERRORS.UNAUTHORIZED);

		expect(logout).toHaveBeenCalledWith(true, LOGIN_WITH_NOTICE);
	});

	it('keeps the plain login page for any other 401', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({ status: 401, headers: new Headers() })
		);

		await expect(
			fetchData({
				url: 'https://api.test.local/service/users/data',
				method: FETCH_METHODS.GET,
				responseHandling: [FETCH_ERRORS.BAD_REQUEST]
			})
		).rejects.toThrow(FETCH_ERRORS.UNAUTHORIZED);

		expect(logout).toHaveBeenCalledWith(
			true,
			'https://app.test.local/login'
		);
	});

	/* On the link page the guest may want to knock again: the stale token is
	   dropped and the call repeated anonymously, without leaving the page. */
	it('does not pull a guest away from a public page', async () => {
		setPathname('/registration');
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(deletedGuestAnswer)
			.mockResolvedValueOnce({
				status: 200,
				json: () => Promise.resolve({ ok: true })
			});
		vi.stubGlobal('fetch', fetchMock);

		await expect(
			fetchData({
				url: 'https://api.test.local/service/registration',
				method: FETCH_METHODS.GET
			})
		).resolves.toEqual({ ok: true });

		expect(logout).not.toHaveBeenCalled();
	});
});
