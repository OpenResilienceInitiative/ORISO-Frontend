// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	EVENT_PRE_LOGOUT,
	logout,
	PRE_LOGOUT_HANDLERS_TIMEOUT_MS,
	teardownLocalSession
} from './logout';
import {
	addEventListener,
	removeEventListener
} from '../../utils/eventHandler';
import {
	getMatrixClientService,
	setMatrixClientServiceRef
} from '../../services/matrixClientRegistry';
import type { MatrixClientService } from '../../services/matrixClientService';
import { getMatrixAccessToken } from '../sessionCookie/getMatrixAccessToken';
import { fetchData } from '../../api/fetchData';
import { clearLiveChatAvailabilityPreference } from '../../utils/liveChatAvailabilityStorage';

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
vi.mock('../../services/matrixKeyBackupService', () => ({
	clearSecretStorageKeys: vi.fn(),
	secretStorageKeyCallback: vi.fn(async () => null)
}));
vi.mock('../../services/loginRecoveryHandoff', () => ({
	clearLoginRecoveryPassword: vi.fn()
}));
vi.mock('../../services/recoveryReminderState', () => ({
	clearRecoveryRuntimeState: vi.fn()
}));
vi.mock('../../utils/appConfig', () => ({
	appConfig: { urls: { toLogin: '/login', toEntry: '/' } }
}));
vi.mock('../../resources/scripts/endpoints', () => ({
	endpoints: {
		matrixAccessToken: 'https://api.example.test/service/matrix/me/token',
		keycloakLogout: 'https://api.example.test/auth/logout'
	}
}));
vi.mock('../../resources/scripts/runtimeConfig', () => ({
	getCookieDomain: vi.fn(() => undefined),
	getMatrixHomeserverUrl: vi.fn(() => 'https://matrix.example.test')
}));
vi.mock('matrix-js-sdk', () => ({
	createClient: vi.fn((config) => ({ config }))
}));
vi.mock('../../api/fetchData', () => ({
	FETCH_ERRORS: { CATCH_ALL: 'CATCH_ALL', CONFLICT: 'CONFLICT' },
	FETCH_METHODS: { GET: 'GET' },
	fetchData: vi.fn()
}));

const OLD_DEVICE = 'ORISO_WEB_OLDDEVICE';

const fakeMatrixService = () =>
	({
		logout: vi.fn().mockResolvedValue(undefined),
		stopAndCleanup: vi.fn()
	}) as unknown as MatrixClientService & { logout: ReturnType<typeof vi.fn> };

describe('teardownLocalSession', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		localStorage.clear();
		sessionStorage.clear();
		document.cookie = 'keycloak=old-access;path=/';
		document.cookie = 'refreshToken=old-refresh;path=/';
		localStorage.setItem('auth.access_token_valid_until', '1');
		localStorage.setItem('auth.refresh_token_valid_until', '1');
		localStorage.setItem('matrix_access_token', 'syt_old');
		localStorage.setItem('matrix_user_id', '@old:hs');
		localStorage.setItem('matrix_device_id', OLD_DEVICE);
		localStorage.setItem('matrix_device_id:@old:hs', OLD_DEVICE);
		localStorage.setItem('matrix_token_expires_at', '1');
	});

	afterEach(() => {
		setMatrixStorageClean();
		setMatrixClientServiceRef(null);
	});

	const setMatrixStorageClean = () => {
		localStorage.clear();
		['keycloak', 'refreshToken'].forEach((name) => {
			document.cookie = `${name}=;path=/;expires=Thu, 01 Jan 1970 00:00:00 GMT`;
		});
	};

	it('signs the Matrix client out, forgets it and drops every token, synchronously', () => {
		const matrixService = fakeMatrixService();
		setMatrixClientServiceRef(matrixService);

		teardownLocalSession();

		expect(matrixService.logout).toHaveBeenCalledTimes(1);
		expect(getMatrixClientService()).toBeNull();
		expect(document.cookie).not.toContain('keycloak=');
		expect(document.cookie).not.toContain('refreshToken=');
		expect(
			localStorage.getItem('auth.access_token_valid_until')
		).toBeNull();
		expect(
			localStorage.getItem('auth.refresh_token_valid_until')
		).toBeNull();
		expect(localStorage.getItem('matrix_access_token')).toBeNull();
		expect(localStorage.getItem('matrix_user_id')).toBeNull();
		expect(localStorage.getItem('matrix_device_id')).toBeNull();
		expect(localStorage.getItem('matrix_token_expires_at')).toBeNull();
	});

	// #1485 review: the live-chat preference, its acknowledgement and its
	// loss record belong to the session; an auth or bootstrap failure tears
	// down without logout(), and the next counsellor must not inherit them.
	it('clears the session-bound live-chat state', () => {
		teardownLocalSession();

		expect(clearLiveChatAvailabilityPreference).toHaveBeenCalledTimes(1);
	});

	it('is idempotent, so the auth guard and logout() can both call it', () => {
		setMatrixClientServiceRef(fakeMatrixService());

		teardownLocalSession();
		expect(() => teardownLocalSession()).not.toThrow();

		expect(getMatrixClientService()).toBeNull();
		expect(document.cookie).not.toContain('keycloak=');
	});

	it('lets a fresh login start with a clean Matrix registry and a new device', async () => {
		setMatrixClientServiceRef(fakeMatrixService());
		teardownLocalSession();

		// Fresh sign-in: the backend echoes whatever device the client asks for.
		vi.mocked(fetchData).mockImplementation(async ({ url }) => {
			const requested = new URL(url).searchParams.get('deviceId');
			return {
				accessToken: 'syt_new',
				userId: '@old:hs',
				deviceId: requested
			};
		});

		const loginData = await getMatrixAccessToken();

		// Nothing of the old session is inherited: no client waiting in the
		// registry, and a device id that is not the old one.
		expect(getMatrixClientService()).toBeNull();
		const requestedUrl = vi.mocked(fetchData).mock.calls[0][0].url;
		expect(new URL(requestedUrl).searchParams.get('deviceId')).not.toBe(
			OLD_DEVICE
		);
		expect(loginData.deviceId).not.toBe(OLD_DEVICE);
		expect(loginData.deviceId).toMatch(/^ORISO_WEB_/);
		expect(localStorage.getItem('matrix_device_id:@old:hs')).toBe(
			loginData.deviceId
		);
	});

	it('does not let a hanging pre-logout handler keep the session alive', async () => {
		vi.useFakeTimers();
		const neverSettles = () => new Promise<never>(() => undefined);
		addEventListener(EVENT_PRE_LOGOUT, neverSettles);
		try {
			const signingOut = logout(false);

			await vi.advanceTimersByTimeAsync(
				PRE_LOGOUT_HANDLERS_TIMEOUT_MS - 1
			);
			expect(document.cookie).toContain('keycloak=old-access');

			await vi.advanceTimersByTimeAsync(1);
			await signingOut;

			expect(document.cookie).not.toContain('keycloak=');
			expect(localStorage.getItem('matrix_access_token')).toBeNull();
		} finally {
			removeEventListener(EVENT_PRE_LOGOUT, neverSettles);
			vi.useRealTimers();
		}
	});
});
