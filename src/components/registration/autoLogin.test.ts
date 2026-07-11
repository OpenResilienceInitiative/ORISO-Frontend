// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { autoLogin, getPostRegistrationGroupChatId } from './autoLogin';
import { getKeycloakAccessToken } from '../sessionCookie/getKeycloakAccessToken';
import {
	getMatrixAccessToken,
	persistMatrixLoginData
} from '../sessionCookie/getMatrixAccessToken';
import { setTokens } from '../auth/auth';
import { getBudibaseAccessToken } from '../sessionCookie/getBudibaseAccessToken';
import { parseJwt } from '../../utils/parseJWT';
import {
	clearAuthSession,
	isConsultantAccessToken
} from '../auth/consultantLoginBlock';

const mockAppConfig = vi.hoisted(() => ({
	multitenancyWithSingleDomainEnabled: false,
	useTenantService: false,
	blockConsultantAppLogin: false,
	urls: {
		redirectToApp: '/sessions'
	}
}));

vi.mock('../sessionCookie/getKeycloakAccessToken', () => ({
	getKeycloakAccessToken: vi.fn()
}));

vi.mock('../sessionCookie/getMatrixAccessToken', () => ({
	getMatrixAccessToken: vi.fn(),
	persistMatrixLoginData: vi.fn()
}));

vi.mock('../../utils/encryptionHelpers', () => ({
	encodeUsername: vi.fn((username: string) => `encoded:${username}`)
}));

vi.mock('../auth/auth', () => ({
	setTokens: vi.fn()
}));

vi.mock('../../api', () => ({
	FETCH_ERRORS: { UNAUTHORIZED: 'UNAUTHORIZED' }
}));

vi.mock('../sessionCookie/getBudibaseAccessToken', () => ({
	getBudibaseAccessToken: vi.fn()
}));

vi.mock('../../utils/appConfig', () => ({
	appConfig: mockAppConfig
}));

vi.mock('../../utils/parseJWT', () => ({
	parseJwt: vi.fn()
}));

vi.mock('../auth/consultantLoginBlock', () => ({
	clearAuthSession: vi.fn(),
	CONSULTANT_LOGIN_BLOCKED_ERROR: 'CONSULTANT_LOGIN_BLOCKED',
	isConsultantAccessToken: vi.fn()
}));

const keycloakResponse = {
	data: {},
	access_token: 'keycloak-access',
	expires_in: 300,
	refresh_token: 'keycloak-refresh',
	refresh_expires_in: 600
};

const matrixResponse = {
	accessToken: 'matrix-access',
	deviceId: 'ORISO_WEB_DEVICE',
	homeserverUrl: 'https://matrix.oriso-dev.site',
	userId: '@shanzae:matrix.oriso-dev.site'
};

describe('autoLogin', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockAppConfig.multitenancyWithSingleDomainEnabled = false;
		mockAppConfig.useTenantService = false;
		mockAppConfig.blockConsultantAppLogin = false;
		mockAppConfig.urls.redirectToApp = '/sessions';
		vi.mocked(getKeycloakAccessToken).mockResolvedValue(keycloakResponse);
		vi.mocked(getMatrixAccessToken).mockResolvedValue(matrixResponse);
		vi.mocked(isConsultantAccessToken).mockReturnValue(false);
	});

	// The consultant login block (PR #273 originally blocked EVERY counsellor
	// because it keyed on the bare `consultant` realm role). isConsultantAccessToken
	// itself is covered in consultantLoginBlock.test.ts; these lock the autoLogin
	// integration: the block only fires when the flag is on AND the token is a
	// consultant, and it clears the session instead of leaving a half-login.
	describe('consultant app-login block', () => {
		it('blocks and clears the session when the flag is on and the token is a consultant', async () => {
			mockAppConfig.blockConsultantAppLogin = true;
			vi.mocked(isConsultantAccessToken).mockReturnValue(true);

			await expect(
				autoLogin({
					username: 'consultant@example.com',
					password: 'secret!',
					tenantData: { settings: {} } as any
				})
			).rejects.toThrow('CONSULTANT_LOGIN_BLOCKED');

			// Keycloak login sets tokens first; the block then clears the session
			// and aborts before Matrix login proceeds.
			expect(clearAuthSession).toHaveBeenCalledTimes(1);
			expect(getMatrixAccessToken).not.toHaveBeenCalled();
			expect(persistMatrixLoginData).not.toHaveBeenCalled();
		});

		it('allows a consultant when the flag is off', async () => {
			mockAppConfig.blockConsultantAppLogin = false;
			vi.mocked(isConsultantAccessToken).mockReturnValue(true);

			await autoLogin({
				username: 'consultant@example.com',
				password: 'secret!',
				tenantData: { settings: {} } as any
			});

			expect(clearAuthSession).not.toHaveBeenCalled();
			expect(setTokens).toHaveBeenCalled();
		});

		it('allows a non-consultant (asker) even when the flag is on', async () => {
			mockAppConfig.blockConsultantAppLogin = true;
			vi.mocked(isConsultantAccessToken).mockReturnValue(false);

			await autoLogin({
				username: 'asker@example.com',
				password: 'secret!',
				tenantData: { settings: {} } as any
			});

			expect(clearAuthSession).not.toHaveBeenCalled();
			expect(setTokens).toHaveBeenCalled();
		});
	});

	it('logs in with Keycloak, stores auth tokens, and persists Matrix login data', async () => {
		await autoLogin({
			username: 'shanzae@example.com',
			password: 'secret!',
			tenantData: { settings: {} } as any
		});

		expect(getKeycloakAccessToken).toHaveBeenCalledWith(
			'shanzae%40example.com',
			'secret!',
			null
		);
		expect(setTokens).toHaveBeenCalledWith(
			'keycloak-access',
			300,
			'keycloak-refresh',
			600
		);
		expect(getMatrixAccessToken).toHaveBeenCalledWith(
			'shanzae@example.com',
			'secret!'
		);
		expect(persistMatrixLoginData).toHaveBeenCalledWith(matrixResponse);
	});

	it('retries with the legacy encoded username when entered username login is unauthorized', async () => {
		vi.mocked(getKeycloakAccessToken)
			.mockRejectedValueOnce(new Error('UNAUTHORIZED'))
			.mockResolvedValueOnce(keycloakResponse);

		await autoLogin({
			username: 'shanzae@example.com',
			password: 'secret!',
			tenantData: { settings: {} } as any
		});

		expect(getKeycloakAccessToken).toHaveBeenNthCalledWith(
			1,
			'shanzae%40example.com',
			'secret!',
			null
		);
		expect(getKeycloakAccessToken).toHaveBeenNthCalledWith(
			2,
			'encoded:shanzae@example.com',
			'secret!',
			null
		);
	});

	it('throws unauthorized when tenant validation fails', async () => {
		mockAppConfig.useTenantService = true;
		vi.mocked(parseJwt).mockReturnValue({ tenantId: 'tenant-from-token' });

		await expect(
			autoLogin({
				username: 'shanzae@example.com',
				password: 'secret!',
				tenantData: { id: 'selected-tenant', settings: {} } as any
			})
		).rejects.toThrow('UNAUTHORIZED');

		expect(getMatrixAccessToken).not.toHaveBeenCalled();
	});

	it('continues login when Matrix login data cannot be loaded', async () => {
		vi.mocked(getMatrixAccessToken).mockRejectedValue(
			new Error('matrix unavailable')
		);

		await autoLogin({
			username: 'shanzae@example.com',
			password: 'secret!',
			tenantData: { settings: {} } as any
		});

		expect(setTokens).toHaveBeenCalled();
		expect(persistMatrixLoginData).not.toHaveBeenCalled();
	});

	it('loads Budibase access token when feature tools are enabled', async () => {
		await autoLogin({
			username: 'shanzae@example.com',
			password: 'secret!',
			tenantData: {
				settings: {
					featureToolsEnabled: true
				}
			} as any
		});

		expect(getBudibaseAccessToken).toHaveBeenCalledWith(
			'shanzae%40example.com',
			'secret!',
			{ featureToolsEnabled: true }
		);
	});
});

describe('getPostRegistrationGroupChatId', () => {
	it('preserves the group chat deep link through registration', () => {
		expect(
			getPostRegistrationGroupChatId('?gcid=%21room%3Amatrix.localhost')
		).toBe('!room:matrix.localhost');
	});

	it('returns undefined without a group chat deep link', () => {
		expect(
			getPostRegistrationGroupChatId('?topic=counseling')
		).toBeUndefined();
	});

	it.each(['?gcid=', '?gcid=%20%20%20'])(
		'returns undefined for an empty group chat deep link',
		(search) => {
			expect(getPostRegistrationGroupChatId(search)).toBeUndefined();
		}
	);
});
