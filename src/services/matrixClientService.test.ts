import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getMatrixAccessToken } from '../components/sessionCookie/getMatrixAccessToken';
import { buildMatrixCryptoStorePrefix } from './matrixCrypto';
import { MatrixClientService } from './matrixClientService';

const mockedMatrixClient = vi.hoisted(() => ({
	initRustCrypto: vi.fn(),
	on: vi.fn(),
	removeAllListeners: vi.fn(),
	getRoom: vi.fn(),
	joinRoom: vi.fn(),
	sendMessage: vi.fn(),
	startClient: vi.fn(),
	stopClient: vi.fn()
}));

vi.mock('../components/sessionCookie/getMatrixAccessToken', () => ({
	createMatrixClient: vi.fn(() => mockedMatrixClient),
	getMatrixAccessToken: vi.fn(),
	persistMatrixLoginData: vi.fn()
}));

vi.hoisted(() => {
	process.env.REACT_APP_KEYCLOAK_REALM = 'oriso';
	Object.defineProperty(globalThis, 'window', {
		value: {
			Cypress: undefined,
			clearTimeout: globalThis.clearTimeout,
			location: {
				hostname: 'app.oriso-dev.site'
			},
			setTimeout: globalThis.setTimeout
		},
		configurable: true
	});
	Object.defineProperty(globalThis, 'localStorage', {
		value: {
			getItem: () => null
		},
		configurable: true
	});
});

const setClient = (
	service: MatrixClientService,
	client: Record<string, unknown>
) => {
	(service as unknown as { client: Record<string, unknown> }).client = client;
};

describe('MatrixClientService', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockedMatrixClient.initRustCrypto.mockResolvedValue(undefined);
		vi.stubGlobal('localStorage', {
			getItem: vi.fn(() => null)
		});
	});

	it('initializes Rust crypto before registering sync and starting the client', async () => {
		const callOrder: string[] = [];
		mockedMatrixClient.initRustCrypto.mockImplementation(async () => {
			callOrder.push('crypto');
		});
		mockedMatrixClient.on.mockImplementation(() => {
			callOrder.push('listener');
		});
		mockedMatrixClient.startClient.mockImplementation(() => {
			callOrder.push('start');
		});
		const service = new MatrixClientService();

		await service.initializeClient({
			userId: '@alice:matrix.localhost',
			accessToken: 'access-token',
			deviceId: 'DEVICE_ONE',
			homeserverUrl: 'http://matrix.localhost:18008'
		});

		expect(callOrder).toEqual(['crypto', 'listener', 'start']);
		expect(mockedMatrixClient.initRustCrypto).toHaveBeenCalledWith({
			useIndexedDB: true,
			cryptoDatabasePrefix: buildMatrixCryptoStorePrefix(
				'@alice:matrix.localhost',
				'DEVICE_ONE'
			)
		});
	});

	it('surfaces Rust crypto failures without leaving a client running', async () => {
		mockedMatrixClient.initRustCrypto.mockRejectedValueOnce(
			new Error('crypto store unavailable')
		);
		const service = new MatrixClientService();

		await expect(
			service.initializeClient({
				userId: '@alice:matrix.localhost',
				accessToken: 'access-token',
				deviceId: 'DEVICE_ONE',
				homeserverUrl: 'http://matrix.localhost:18008'
			})
		).rejects.toThrow('crypto store unavailable');

		expect(mockedMatrixClient.on).not.toHaveBeenCalled();
		expect(mockedMatrixClient.startClient).not.toHaveBeenCalled();
		expect(service.getClient()).toBeNull();
	});

	it('waits for replacement-client crypto initialization during token refresh', async () => {
		let resolveCrypto: (() => void) | undefined;
		mockedMatrixClient.initRustCrypto.mockReturnValueOnce(
			new Promise<void>((resolve) => {
				resolveCrypto = resolve;
			})
		);
		vi.mocked(getMatrixAccessToken).mockResolvedValueOnce({
			userId: '@alice:matrix.localhost',
			accessToken: 'replacement-token',
			deviceId: 'DEVICE_ONE',
			homeserverUrl: 'http://matrix.localhost:18008'
		});
		const service = new MatrixClientService();

		let refreshCompleted = false;
		const refresh = service.refreshMatrixToken().then(() => {
			refreshCompleted = true;
		});
		await new Promise((resolve) => globalThis.setTimeout(resolve, 0));

		expect(refreshCompleted).toBe(false);
		expect(mockedMatrixClient.startClient).not.toHaveBeenCalled();
		resolveCrypto?.();
		await refresh;
		expect(mockedMatrixClient.startClient).toHaveBeenCalledOnce();
	});

	it('contains a failed fire-and-forget refresh from the sync listener', async () => {
		let syncListener:
			| ((
					state: string,
					previous: string | null,
					error?: unknown
			  ) => void)
			| undefined;
		mockedMatrixClient.on.mockImplementation((_event, listener) => {
			syncListener = listener;
		});
		vi.mocked(getMatrixAccessToken).mockRejectedValueOnce(
			new Error('refresh failed')
		);
		const service = new MatrixClientService();
		await service.initializeClient({
			userId: '@alice:matrix.localhost',
			accessToken: 'expired-token',
			deviceId: 'DEVICE_ONE',
			homeserverUrl: 'http://matrix.localhost:18008'
		});

		syncListener?.('ERROR', null, {
			httpStatus: 401,
			message: 'Access token has expired'
		});
		await new Promise((resolve) => globalThis.setTimeout(resolve, 0));

		expect(getMatrixAccessToken).toHaveBeenCalledOnce();
	});

	it('sends Matrix messages in migration rooms without native Matrix encryption state', async () => {
		const sendMessage = vi.fn(() =>
			Promise.resolve({ event_id: '$event' })
		);
		const service = new MatrixClientService();
		setClient(service, {
			sendMessage,
			isRoomEncrypted: () => false,
			getRoom: () => ({
				hasEncryptionStateEvent: () => false,
				currentState: {
					getStateEvents: () => null
				}
			})
		});

		await expect(
			service.sendMessage('!room:example.org', 'Hello Matrix')
		).resolves.toEqual({ event_id: '$event' });
		expect(sendMessage).toHaveBeenCalledWith('!room:example.org', {
			msgtype: 'm.text',
			body: 'Hello Matrix'
		});
	});

	it('joins a newly accepted room that is not yet present in the running client', async () => {
		const callOrder: string[] = [];
		const joinRoom = vi.fn(async () => {
			callOrder.push('join');
			return { roomId: '!room:example.org' };
		});
		const sendMessage = vi.fn(async () => {
			callOrder.push('send');
			return { event_id: '$event' };
		});
		const service = new MatrixClientService();
		setClient(service, {
			getRoom: () => null,
			joinRoom,
			sendMessage
		});

		await service.sendMessage('!room:example.org', 'Hello after accept');

		expect(joinRoom).toHaveBeenCalledWith('!room:example.org');
		expect(sendMessage).toHaveBeenCalled();
		expect(callOrder).toEqual(['join', 'send']);
	});

	it('refreshes an expired token during join and retries join before sending', async () => {
		const expiredError = {
			errcode: 'M_UNKNOWN',
			httpStatus: 401,
			message: 'Access token has expired'
		};
		const firstJoin = vi.fn(() => Promise.reject(expiredError));
		const service = new MatrixClientService();
		setClient(service, {
			getRoom: () => null,
			joinRoom: firstJoin,
			sendMessage: vi.fn(),
			stopClient: vi.fn(),
			removeAllListeners: vi.fn()
		});
		vi.mocked(getMatrixAccessToken).mockResolvedValueOnce({
			userId: '@alice:matrix.localhost',
			accessToken: 'replacement-token',
			deviceId: 'DEVICE_ONE',
			homeserverUrl: 'http://matrix.localhost:18008'
		});
		mockedMatrixClient.getRoom.mockReturnValue(null);
		mockedMatrixClient.joinRoom.mockResolvedValue({
			roomId: '!room:example.org'
		});
		mockedMatrixClient.sendMessage.mockResolvedValue({
			event_id: '$event'
		});

		await expect(
			service.sendMessage('!room:example.org', 'Hello after refresh')
		).resolves.toEqual({ event_id: '$event' });

		expect(firstJoin).toHaveBeenCalledOnce();
		expect(getMatrixAccessToken).toHaveBeenCalledOnce();
		expect(mockedMatrixClient.joinRoom).toHaveBeenCalledWith(
			'!room:example.org'
		);
		expect(mockedMatrixClient.sendMessage).toHaveBeenCalledOnce();
	});

	it('sends typing state in migration rooms without native Matrix encryption state', async () => {
		const sendTyping = vi.fn(() => Promise.resolve());
		const service = new MatrixClientService();
		setClient(service, {
			sendTyping,
			isRoomEncrypted: () => false,
			getRoom: () => ({
				hasEncryptionStateEvent: () => false,
				currentState: {
					getStateEvents: () => null
				}
			})
		});

		await expect(
			service.sendTyping('!room:example.org', true)
		).resolves.toBeUndefined();
		expect(sendTyping).toHaveBeenCalledWith(
			'!room:example.org',
			true,
			30000
		);
	});
});
