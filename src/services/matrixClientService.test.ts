import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getMatrixAccessToken } from '../components/sessionCookie/getMatrixAccessToken';
import { buildMatrixCryptoStorePrefix } from './matrixCrypto';
import {
	MatrixClientService,
	isMatrixExpiredTokenError
} from './matrixClientService';

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

	it('refreshes the token when sync fails with M_UNKNOWN_TOKEN (invalidated access token)', async () => {
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
		const service = new MatrixClientService();
		await service.initializeClient({
			userId: '@alice:matrix.localhost',
			accessToken: 'invalidated-token',
			deviceId: 'DEVICE_ONE',
			homeserverUrl: 'http://matrix.localhost:18008'
		});
		vi.mocked(getMatrixAccessToken).mockClear();
		vi.mocked(getMatrixAccessToken).mockRejectedValueOnce(
			new Error('refresh failed')
		);

		// Exact shape delivered by matrix-js-sdk sync state ERROR when Synapse
		// rejects an invalidated token: ISyncStateData wrapping a MatrixError.
		syncListener?.('ERROR', null, {
			error: {
				errcode: 'M_UNKNOWN_TOKEN',
				data: {
					errcode: 'M_UNKNOWN_TOKEN',
					error: 'Invalid access token passed.'
				},
				httpStatus: 401,
				message: 'MatrixError: [401] Invalid access token passed.'
			}
		});
		await new Promise((resolve) => globalThis.setTimeout(resolve, 0));

		expect(getMatrixAccessToken).toHaveBeenCalledOnce();
	});

	it('notifies client-change subscribers when a token refresh swaps the client', async () => {
		const service = new MatrixClientService();
		const seenClients: unknown[] = [];
		service.onClientChange((client) => {
			seenClients.push(client);
		});

		await service.initializeClient({
			userId: '@alice:matrix.localhost',
			accessToken: 'first-token',
			deviceId: 'DEVICE_ONE',
			homeserverUrl: 'http://matrix.localhost:18008'
		});
		await service.initializeClient({
			userId: '@alice:matrix.localhost',
			accessToken: 'second-token',
			deviceId: 'DEVICE_ONE',
			homeserverUrl: 'http://matrix.localhost:18008'
		});
		service.stopAndCleanup();

		// One notification per new client instance, one for the final teardown.
		expect(seenClients).toEqual([
			mockedMatrixClient,
			mockedMatrixClient,
			null
		]);
	});

	it('unsubscribes client-change listeners via the returned detach function', async () => {
		const service = new MatrixClientService();
		const listener = vi.fn();
		const detach = service.onClientChange(listener);
		detach();

		await service.initializeClient({
			userId: '@alice:matrix.localhost',
			accessToken: 'first-token',
			deviceId: 'DEVICE_ONE',
			homeserverUrl: 'http://matrix.localhost:18008'
		});

		expect(listener).not.toHaveBeenCalled();
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

	it('edits a message via m.replace, targeting the original event', async () => {
		const sendMessage = vi.fn(() =>
			Promise.resolve({ event_id: '$edit:example.org' })
		);
		const service = new MatrixClientService();
		setClient(service, { sendMessage });

		await expect(
			service.editMessage(
				'!room:example.org',
				'$orig:example.org',
				'korrigiert'
			)
		).resolves.toEqual({ event_id: '$edit:example.org' });
		expect(sendMessage).toHaveBeenCalledWith('!room:example.org', {
			'msgtype': 'm.text',
			'body': '* korrigiert',
			'm.new_content': { msgtype: 'm.text', body: 'korrigiert' },
			'm.relates_to': {
				rel_type: 'm.replace',
				event_id: '$orig:example.org'
			}
		});
	});

	it('sends a reaction via m.annotation using sendEvent', async () => {
		const sendEvent = vi.fn(() =>
			Promise.resolve({ event_id: '$reaction:example.org' })
		);
		const service = new MatrixClientService();
		setClient(service, { sendEvent });

		await expect(
			service.sendReaction('!room:example.org', '$msg:example.org', '👍')
		).resolves.toEqual({ event_id: '$reaction:example.org' });
		expect(sendEvent).toHaveBeenCalledWith(
			'!room:example.org',
			'm.reaction',
			{
				'm.relates_to': {
					rel_type: 'm.annotation',
					event_id: '$msg:example.org',
					key: '👍'
				}
			}
		);
	});

	it('redacts an event (used to un-react)', async () => {
		const redactEvent = vi.fn(() =>
			Promise.resolve({ event_id: '$redaction:example.org' })
		);
		const service = new MatrixClientService();
		setClient(service, { redactEvent });

		await expect(
			service.redactEvent('!room:example.org', '$reaction:example.org')
		).resolves.toEqual({ event_id: '$redaction:example.org' });
		expect(redactEvent).toHaveBeenCalledWith(
			'!room:example.org',
			'$reaction:example.org'
		);
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

describe('isMatrixExpiredTokenError', () => {
	it('recognizes a Synapse M_UNKNOWN_TOKEN error (invalidated access token)', () => {
		expect(
			isMatrixExpiredTokenError({
				errcode: 'M_UNKNOWN_TOKEN',
				data: {
					errcode: 'M_UNKNOWN_TOKEN',
					error: 'Invalid access token passed.'
				},
				httpStatus: 401,
				message: 'MatrixError: [401] Invalid access token passed.'
			})
		).toBe(true);
	});

	it('recognizes M_UNKNOWN_TOKEN inside the sync state ERROR wrapper', () => {
		expect(
			isMatrixExpiredTokenError({
				error: {
					errcode: 'M_UNKNOWN_TOKEN',
					data: {
						errcode: 'M_UNKNOWN_TOKEN',
						error: 'Invalid access token passed.'
					},
					httpStatus: 401,
					message: 'MatrixError: [401] Invalid access token passed.'
				}
			})
		).toBe(true);
	});

	it('does not treat a 403 M_FORBIDDEN as an expired token', () => {
		expect(
			isMatrixExpiredTokenError({
				errcode: 'M_FORBIDDEN',
				httpStatus: 403,
				message: 'MatrixError: [403] You are not invited to this room.'
			})
		).toBe(false);
	});
});
