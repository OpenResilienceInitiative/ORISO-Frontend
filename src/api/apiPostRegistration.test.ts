// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { apiPostRegistration } from './apiPostRegistration';
import { autoLogin } from '../components/registration/autoLogin';
import { fetchData } from './fetchData';

vi.mock('./fetchData', () => ({
	FETCH_ERRORS: { CATCH_ALL_WITH_RESPONSE: 'catch-all-with-response' },
	FETCH_METHODS: { POST: 'POST' },
	fetchData: vi.fn(() => Promise.resolve())
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
});
