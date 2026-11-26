// @vitest-environment oriso-jsdom

import * as React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';
import { ConsultantStatistics } from './ConsultantStatistics';

/* The real loader and the real fetchData: only the network, logout and the
   error page are stubbed (FE#2566 review). */

const logout = vi.fn();
vi.mock('../logout/logout', () => ({
	logout: (...args: unknown[]) => logout(...args)
}));

const redirectToErrorPage = vi.fn();
vi.mock('../error/errorHandling', async (importOriginal) => ({
	...(await importOriginal<Record<string, unknown>>()),
	redirectToErrorPage: (...args: unknown[]) => redirectToErrorPage(...args)
}));

vi.mock('../../utils/appConfig', () => ({
	appConfig: { urls: { toLogin: '/login' } }
}));

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

class TestRequest {
	url: string;
	headers: Headers;

	constructor(url: string, init: { headers?: HeadersInit } = {}) {
		this.url = url;
		this.headers = new Headers(init.headers);
	}
}

beforeEach(() => {
	Object.defineProperty(window, 'location', {
		configurable: true,
		writable: true,
		value: {
			...window.location,
			pathname: '/profile/aktivitaeten/statistik'
		}
	});
	vi.stubGlobal('Request', TestRequest);
	document.cookie = 'keycloak=expired-session';
});

afterEach(() => {
	cleanup();
	document.cookie = 'keycloak=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});

describe('ConsultantStatistics with the real endpoint', () => {
	it('logs out on a 401 instead of offering "Erneut versuchen"', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 401 }));

		render(<ConsultantStatistics />);

		await waitFor(() => expect(logout).toHaveBeenCalledTimes(1));
		expect(logout).toHaveBeenCalledWith(true, '/login');
		expect(redirectToErrorPage).not.toHaveBeenCalled();
	});

	it('keeps a server error in the card with a retry, not on the error page', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 503 }));

		render(<ConsultantStatistics />);

		expect(
			await screen.findByRole('button', {
				name: 'profile.statistics.state.retry'
			})
		).toBeDefined();
		expect(logout).not.toHaveBeenCalled();
		expect(redirectToErrorPage).not.toHaveBeenCalled();
	});
});
