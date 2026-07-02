// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { autoLogin } from './autoLogin';
import { getKeycloakAccessToken } from '../sessionCookie/getKeycloakAccessToken';
import {
	getMatrixAccessToken,
	persistMatrixLoginData
} from '../sessionCookie/getMatrixAccessToken';
import { setTokens } from '../auth/auth';
import { getBudibaseAccessToken } from '../sessionCookie/getBudibaseAccessToken';
import { parseJwt } from '../../utils/parseJWT';

const mockAppConfig = vi.hoisted(() => ({
	multitenancyWithSingleDomainEnabled: false,
	useTenantService: false,
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
		mockAppConfig.urls.redirectToApp = '/sessions';
		vi.mocked(getKeycloakAccessToken).mockResolvedValue(keycloakResponse);
		vi.mocked(getMatrixAccessToken).mockResolvedValue(matrixResponse);
	});

	it('logs in with Keycloak, stores auth tokens, and persists Matrix login data', async () => {
		await autoLogin({
			username: 'shanzae@example.com',
			password: 'secret!',
			tenantData: { settings: {} } as any
		});

		expect(getKeycloakAccessToken).toHaveBeenCalledWith(
			'encoded:shanzae@example.com',
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

	it('retries with the entered username when encoded username login is unauthorized', async () => {
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
			'encoded:shanzae@example.com',
			'secret!',
			null
		);
		expect(getKeycloakAccessToken).toHaveBeenNthCalledWith(
			2,
			'shanzae%40example.com',
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
			'encoded:shanzae@example.com',
			'secret!',
			{ featureToolsEnabled: true }
		);
	});
});
