// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiGetEventNotifications } from './apiEventNotifications';
import { redirectToErrorPage } from '../components/error/errorHandling';
import { logout } from '../components/logout/logout';

vi.mock('../components/error/errorHandling', async (importOriginal) => ({
	...(await importOriginal<
		typeof import('../components/error/errorHandling')
	>()),
	redirectToErrorPage: vi.fn()
}));
vi.mock('../components/logout/logout', () => ({ logout: vi.fn() }));
vi.mock('../utils/appConfig', () => ({
	appConfig: { urls: { toLogin: '/login' } }
}));

describe('notification feed HTTP recovery', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		window.history.replaceState(
			{},
			'',
			'/sessions/consultant/sessionPreview'
		);
		vi.stubGlobal(
			'Request',
			class {
				constructor(
					public url: string,
					public init?: RequestInit
				) {}
			}
		);
	});
	afterEach(() => vi.unstubAllGlobals());

	it.each([502, 503, 504])(
		'keeps navigation intact after HTTP %s and permits the next poll',
		async (status) => {
			const feed = { items: [], page: 0, perPage: 50, unreadCount: 0 };
			vi.stubGlobal(
				'fetch',
				vi
					.fn()
					.mockResolvedValueOnce({ status })
					.mockResolvedValueOnce({
						status: 200,
						json: async () => feed
					})
			);
			await expect(apiGetEventNotifications()).rejects.toThrow();
			expect(redirectToErrorPage).not.toHaveBeenCalled();
			expect(logout).not.toHaveBeenCalled();
			await expect(apiGetEventNotifications()).resolves.toEqual(feed);
		}
	);

	it('still invokes authentication handling when the protected feed returns 401', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 401 }));
		await expect(apiGetEventNotifications()).rejects.toThrow(
			'UNAUTHORIZED'
		);
		expect(logout).toHaveBeenCalledWith(true, '/login');
	});
});
