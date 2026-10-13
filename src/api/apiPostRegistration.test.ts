// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import {
	accountExistsAfterTimeout,
	apiPostRegistration,
	REGISTRATION_TIMEOUT_MS
} from './apiPostRegistration';
import { autoLogin } from '../components/registration/autoLogin';
import { fetchData } from './fetchData';
import { apiGetIsUsernameAvailable } from './apiGetIsUsernameAvailable';

vi.mock('./fetchData', () => ({
	FETCH_ERRORS: {
		CATCH_ALL_WITH_RESPONSE: 'catch-all-with-response',
		TIMEOUT: 'TIMEOUT'
	},
	FETCH_METHODS: { POST: 'POST' },
	fetchData: vi.fn(() => Promise.resolve())
}));

vi.mock('./apiGetIsUsernameAvailable', () => ({
	apiGetIsUsernameAvailable: vi.fn()
}));

vi.mock('../components/registration/autoLogin', () => ({
	autoLogin: vi.fn(() => Promise.resolve())
}));

vi.mock('../components/sessionCookie/accessSessionCookie', () => ({
	removeAllCookies: vi.fn()
}));

vi.mock('../globalState', () => ({
	COOKIE_KEY: 'sessionCookie'
}));

describe('apiPostRegistration', () => {
	it('url-encodes the backend password while keeping the raw password for auto-login', async () => {
		const password = '%hNHFAQ?N9%+H+n8';

		await apiPostRegistration(
			'/service/users/askers/new',
			{
				username: 'tender_frog_784',
				password,
				agencyId: '3',
				postcode: '12043',
				termsAccepted: 'true',
				consultingType: '0'
			},
			false,
			{} as any
		);

		expect(fetchData).toHaveBeenCalledWith(
			expect.objectContaining({
				method: 'POST',
				bodyData: expect.any(String)
			})
		);

		const body = JSON.parse(
			vi.mocked(fetchData).mock.calls[0][0].bodyData as string
		);
		expect(body.password).toBe(encodeURIComponent(password));
		expect(autoLogin).toHaveBeenCalledWith(
			expect.objectContaining({
				username: 'tender_frog_784',
				password
			})
		);
	});

	it('normalizes regional preferredLanguage values before posting', async () => {
		await apiPostRegistration(
			'/service/users/askers/new',
			{
				username: 'tender_frog_784',
				password: 'TestPass123!',
				agencyId: '3',
				postcode: '12043',
				termsAccepted: 'true',
				consultingType: '0',
				preferredLanguage: 'en-IN'
			},
			false,
			{} as any
		);

		const body = JSON.parse(
			vi.mocked(fetchData).mock.calls.at(-1)?.[0].bodyData as string
		);
		expect(body.preferredLanguage).toBe('en');
	});

	it('waits longer than the 30 s default, because a large centre makes sign-up slow', async () => {
		await apiPostRegistration(
			'/service/users/askers/new',
			{ username: 'tender_frog_784', password: 'TestPass123!' },
			false,
			{} as any
		);

		expect(vi.mocked(fetchData).mock.calls.at(-1)?.[0].timeout).toBe(
			REGISTRATION_TIMEOUT_MS
		);
		expect(REGISTRATION_TIMEOUT_MS).toBeGreaterThan(30_000);
	});
});

describe('accountExistsAfterTimeout', () => {
	const timeout = new Error('TIMEOUT');

	it('reports the account when the timed-out sign-up already took the User-ID', async () => {
		vi.mocked(apiGetIsUsernameAvailable).mockResolvedValueOnce(false);

		await expect(
			accountExistsAfterTimeout(timeout, 'tender_frog_784')
		).resolves.toBe(true);
		expect(apiGetIsUsernameAvailable).toHaveBeenCalledWith(
			'tender_frog_784'
		);
	});

	it('keeps the form when the User-ID is still free', async () => {
		vi.mocked(apiGetIsUsernameAvailable).mockResolvedValueOnce(true);

		await expect(
			accountExistsAfterTimeout(timeout, 'tender_frog_784')
		).resolves.toBe(false);
	});

	it('keeps the form when the check itself fails', async () => {
		vi.mocked(apiGetIsUsernameAvailable).mockRejectedValueOnce(
			new Error('down')
		);

		await expect(
			accountExistsAfterTimeout(timeout, 'tender_frog_784')
		).resolves.toBe(false);
	});

	it('does not check for any other failure', async () => {
		vi.mocked(apiGetIsUsernameAvailable).mockClear();

		await expect(
			accountExistsAfterTimeout(new Error('BAD_REQUEST'), 'x')
		).resolves.toBe(false);
		await expect(accountExistsAfterTimeout(timeout, '')).resolves.toBe(
			false
		);
		expect(apiGetIsUsernameAvailable).not.toHaveBeenCalled();
	});
});
