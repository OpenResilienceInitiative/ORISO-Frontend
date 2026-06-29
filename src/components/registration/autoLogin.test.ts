// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { autoLogin } from './autoLogin';
import { getKeycloakAccessToken } from '../sessionCookie/getKeycloakAccessToken';
import {
	getMatrixAccessToken,
	persistMatrixLoginData
} from '../sessionCookie/getMatrixAccessToken';
import { setTokens } from '../auth/auth';

vi.mock('../sessionCookie/getKeycloakAccessToken', () => ({
	getKeycloakAccessToken: vi.fn()
}));

vi.mock('../sessionCookie/getMatrixAccessToken', () => ({
	getMatrixAccessToken: vi.fn(),
	persistMatrixLoginData: vi.fn()
}));

vi.mock('../sessionCookie/getRocketchatAccessToken', () => ({
	getRocketchatAccessToken: vi.fn()
}));

vi.mock('../sessionCookie/accessSessionCookie', () => ({
	setValueInCookie: vi.fn()
}));

vi.mock('../../utils/generateCsrfToken', () => ({
	generateCsrfToken: vi.fn()
}));

vi.mock('../../utils/encryptionHelpers', () => ({
	createAndStoreKeys: vi.fn(),
	decryptPrivateKey: vi.fn(),
	deriveMasterKeyFromPassword: vi.fn(),
	encodeUsername: vi.fn((username: string) => `encoded:${username}`),
	encryptForParticipant: vi.fn(),
	encryptPrivateKey: vi.fn(),
	getTmpMasterKey: vi.fn(),
	importRawEncryptionKey: vi.fn(),
	readMasterKeyFromLocalStorage: vi.fn(),
	storeKeys: vi.fn(),
	writeMasterKeyToLocalStorage: vi.fn()
}));

vi.mock('../auth/auth', () => ({
	setTokens: vi.fn()
}));

vi.mock('../../api', () => ({
	FETCH_ERRORS: { UNAUTHORIZED: 'UNAUTHORIZED' },
	apiUpdateUserE2EKeys: vi.fn()
}));

vi.mock('../../api/apiRocketChatFetchMyKeys', () => ({
	apiRocketChatFetchMyKeys: vi.fn()
}));

vi.mock('../../api/apiRocketChatSetUserKeys', () => ({
	apiRocketChatSetUserKeys: vi.fn()
}));

vi.mock('../../api/apiRocketChatSubscriptionsGet', () => ({
	apiRocketChatSubscriptionsGet: vi.fn()
}));

vi.mock('../../api/apiRocketChatRoomsGet', () => ({
	apiRocketChatRoomsGet: vi.fn()
}));

vi.mock('../../api/apiRocketChatUpdateGroupKey', () => ({
	apiRocketChatUpdateGroupKey: vi.fn()
}));

vi.mock('../../api/apiRocketChatResetE2EKey', () => ({
	apiRocketChatResetE2EKey: vi.fn()
}));

vi.mock('../sessionCookie/getBudibaseAccessToken', () => ({
	getBudibaseAccessToken: vi.fn()
}));

vi.mock('../../utils/appConfig', () => ({
	appConfig: {
		multitenancyWithSingleDomainEnabled: false,
		useTenantService: false,
		urls: {
			redirectToApp: '/sessions'
		}
	}
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
});
