// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { autoLogin, handleE2EESetup } from './autoLogin';
import { getKeycloakAccessToken } from '../sessionCookie/getKeycloakAccessToken';
import {
	getMatrixAccessToken,
	persistMatrixLoginData
} from '../sessionCookie/getMatrixAccessToken';
import { setTokens } from '../auth/auth';
import { getBudibaseAccessToken } from '../sessionCookie/getBudibaseAccessToken';
import { parseJwt } from '../../utils/parseJWT';
import { apiRocketChatFetchMyKeys } from '../../api/apiRocketChatFetchMyKeys';
import { apiRocketChatSetUserKeys } from '../../api/apiRocketChatSetUserKeys';
import { apiUpdateUserE2EKeys } from '../../api';
import {
	createAndStoreKeys,
	deriveMasterKeyFromPassword,
	encryptPrivateKey,
	readMasterKeyFromLocalStorage,
	storeKeys,
	writeMasterKeyToLocalStorage
} from '../../utils/encryptionHelpers';

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
	it('creates and stores new E2EE keys when no Rocket.Chat keys exist', async () => {
		vi.mocked(deriveMasterKeyFromPassword).mockResolvedValue(
			'master-key' as any
		);
		vi.mocked(apiRocketChatFetchMyKeys).mockResolvedValue({
			success: true
		});
		vi.mocked(createAndStoreKeys).mockResolvedValue({
			privateKey: 'private-key',
			publicKey: JSON.stringify({ n: 'public-key-material' })
		} as any);
		vi.mocked(encryptPrivateKey).mockResolvedValue(
			'encrypted-private-key' as any
		);
		vi.mocked(apiRocketChatSetUserKeys).mockResolvedValue({});
		vi.mocked(apiUpdateUserE2EKeys).mockResolvedValue({});

		await handleE2EESetup('secret!', 'rc-user-id');

		expect(createAndStoreKeys).toHaveBeenCalled();
		expect(apiRocketChatSetUserKeys).toHaveBeenCalledWith(
			JSON.stringify({ n: 'public-key-material' }),
			'encrypted-private-key'
		);
		expect(apiUpdateUserE2EKeys).toHaveBeenCalledWith(
			'public-key-material'
		);
	});

	it('resets keys and relogs in when encrypted keys cannot be decrypted without a persisted master key', async () => {
		const reloginCallback = vi.fn().mockResolvedValue('relogged');
		vi.mocked(deriveMasterKeyFromPassword).mockResolvedValue(
			'master-key' as any
		);
		vi.mocked(apiRocketChatFetchMyKeys).mockResolvedValue({
			private_key: 'encrypted-private',
			public_key: JSON.stringify({ n: 'stored-public-key' })
		});
		const { decryptPrivateKey } = await import(
			'../../utils/encryptionHelpers'
		);
		const { apiRocketChatResetE2EKey } = await import(
			'../../api/apiRocketChatResetE2EKey'
		);
		vi.mocked(decryptPrivateKey).mockRejectedValue(new Error('bad key'));
		vi.mocked(readMasterKeyFromLocalStorage).mockReturnValue(null);

		await handleE2EESetup('secret!', 'rc-user-id', reloginCallback);

		expect(apiRocketChatResetE2EKey).toHaveBeenCalled();
		expect(writeMasterKeyToLocalStorage).toHaveBeenCalledWith(
			'master-key',
			'rc-user-id'
		);
		expect(reloginCallback).toHaveBeenCalled();
		expect(storeKeys).not.toHaveBeenCalled();
	});
});
