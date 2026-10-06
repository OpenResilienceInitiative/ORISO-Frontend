// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../api/apiLogoutKeycloak', () => ({
	apiKeycloakLogout: vi.fn().mockResolvedValue(undefined)
}));
vi.mock('../../api/apiSetLiveChatAvailability', () => ({
	apiSetLiveChatAvailability: vi.fn().mockResolvedValue(undefined)
}));
vi.mock('../../utils/liveChatAvailabilityStorage', () => ({
	clearLiveChatAvailabilityPreference: vi.fn()
}));
vi.mock('../../utils/tenantSettingsHelper', () => ({
	getTenantSettings: () => ({
		featureAppointmentsEnabled: false,
		featureToolsEnabled: false
	})
}));
vi.mock('../budibase/budibaseLogout', () => ({ budibaseLogout: vi.fn() }));
vi.mock('./calcomLogout', () => ({ calcomLogout: vi.fn() }));
vi.mock('../sessionCookie/accessSessionCookie', () => ({
	getValueFromCookie: vi.fn(() => 'access-token'),
	removeAllCookies: vi.fn()
}));
vi.mock('../sessionCookie/accessSessionLocalStorage', () => ({
	removeTokenExpiryFromLocalStorage: vi.fn()
}));
vi.mock('../../utils/appConfig', () => ({
	appConfig: { urls: { toEntry: '/' } }
}));
vi.mock('../../utils/eventHandler', () => ({
	callEventListeners: vi.fn().mockResolvedValue(false)
}));
vi.mock('../../services/matrixClientRegistry', () => ({
	getMatrixClientService: () => ({
		logout: vi.fn().mockResolvedValue(undefined)
	}),
	setMatrixClientServiceRef: vi.fn()
}));

const flush = async () => {
	for (let i = 0; i < 10; i++) {
		await Promise.resolve();
	}
};

describe('logout storage sweep (#1071)', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.clearAllMocks();
		localStorage.clear();
		sessionStorage.clear();
	});

	// The AC for #1071 task 3: on the shared PCs counselling agencies run,
	// nothing user-scoped may be readable by the next person after sign-out.
	it('drops app-scoped Web Storage when the session ends', async () => {
		localStorage.setItem('oriso.chatDrafts.v1', '{"k":{"text":"secret"}}');
		localStorage.setItem('oriso.recentEmojis', '["👋"]');
		localStorage.setItem('oriso.enquiry.42', '{"text":"half typed"}');
		localStorage.setItem('i18nextLng', 'de');
		sessionStorage.setItem('registrationSession', '{"username":"ned"}');

		const { logout } = await import('./logout');
		await logout(false);
		await flush();

		expect(localStorage.getItem('oriso.chatDrafts.v1')).toBeNull();
		expect(localStorage.getItem('oriso.recentEmojis')).toBeNull();
		expect(localStorage.getItem('oriso.enquiry.42')).toBeNull();
		expect(sessionStorage.getItem('registrationSession')).toBeNull();
		// Not user-scoped: the next person keeps the interface language.
		expect(localStorage.getItem('i18nextLng')).toBe('de');
	});

	it('expires leftover Matrix SSO handoff cookies', async () => {
		const written: string[] = [];
		vi.spyOn(document, 'cookie', 'set').mockImplementation((value) => {
			written.push(value);
		});

		const { logout } = await import('./logout');
		await logout(false);
		await flush();

		[
			'matrix_sso_user_id',
			'matrix_sso_access_token',
			'matrix_sso_device_id',
			'matrix_sso_hs_url'
		].forEach((name) => {
			expect(
				written.some(
					(entry) =>
						entry.startsWith(`${name}=;`) &&
						entry.includes('expires=Thu, 01 Jan 1970')
				)
			).toBe(true);
		});
	});

	it('tears the local session down without waiting for live-chat availability', async () => {
		const { apiSetLiveChatAvailability } = await import(
			'../../api/apiSetLiveChatAvailability'
		);
		const { removeAllCookies } = await import(
			'../sessionCookie/accessSessionCookie'
		);
		vi.mocked(apiSetLiveChatAvailability).mockImplementationOnce(
			() => new Promise(() => undefined)
		);

		const { logout } = await import('./logout');
		void logout(false);
		await flush();

		expect(removeAllCookies).toHaveBeenCalledTimes(1);
	});

	it('aborts pre-logout work when its deadline expires', async () => {
		vi.useFakeTimers();
		let signal: AbortSignal | undefined;
		const { callEventListeners } = await import('../../utils/eventHandler');
		vi.mocked(callEventListeners).mockImplementationOnce(
			(_name: string, receivedSignal?: AbortSignal) => {
				signal = receivedSignal;
				return new Promise(() => undefined);
			}
		);

		const { logout, PRE_LOGOUT_HANDLERS_TIMEOUT_MS } = await import(
			'./logout'
		);
		const signingOut = logout(false);
		await vi.advanceTimersByTimeAsync(PRE_LOGOUT_HANDLERS_TIMEOUT_MS);
		await signingOut;

		expect(signal?.aborted).toBe(true);
		vi.useRealTimers();
	});

	it('aborts server logout requests at the logout deadline', async () => {
		vi.useFakeTimers();
		const { apiSetLiveChatAvailability } = await import(
			'../../api/apiSetLiveChatAvailability'
		);
		const { apiKeycloakLogout } = await import(
			'../../api/apiLogoutKeycloak'
		);
		const rejectWhenAborted = (signal?: AbortSignal) =>
			new Promise<never>((_resolve, reject) => {
				signal?.addEventListener('abort', () =>
					reject(new DOMException('aborted', 'AbortError'))
				);
			});
		vi.mocked(apiSetLiveChatAvailability).mockImplementationOnce(
			(_available, signal) => rejectWhenAborted(signal)
		);
		vi.mocked(apiKeycloakLogout).mockImplementationOnce((signal) =>
			rejectWhenAborted(signal)
		);

		const { logout, LOGOUT_REQUEST_TIMEOUT_MS } = await import('./logout');
		await logout(false);
		const availabilitySignal = vi.mocked(apiSetLiveChatAvailability).mock
			.calls[0][1];
		const keycloakSignal = vi.mocked(apiKeycloakLogout).mock.calls[0][0];

		expect(availabilitySignal?.aborted).toBe(false);
		expect(keycloakSignal?.aborted).toBe(false);
		await vi.advanceTimersByTimeAsync(LOGOUT_REQUEST_TIMEOUT_MS);
		expect(availabilitySignal?.aborted).toBe(true);
		expect(keycloakSignal?.aborted).toBe(true);
		vi.useRealTimers();
	});
});
