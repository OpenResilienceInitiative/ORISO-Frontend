import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DeviceIsolationModeKind } from 'matrix-js-sdk/lib/crypto-api';
import {
	clearPersistedMatrixDeviceId,
	createMatrixClient,
	getMatrixAccessToken,
	persistMatrixLoginData
} from '../components/sessionCookie/getMatrixAccessToken';
import { buildMatrixCryptoStorePrefix } from './matrixCrypto';
import {
	MatrixClientService,
	isMatrixExpiredTokenError
} from './matrixClientService';

const mockedCrypto = vi.hoisted(() => ({
	setDeviceIsolationMode: vi.fn()
}));

const mockedMatrixClient = vi.hoisted(() => ({
	initRustCrypto: vi.fn(),
	on: vi.fn(),
	off: vi.fn(),
	removeAllListeners: vi.fn(),
	getRoom: vi.fn(),
	getCrypto: vi.fn(),
	joinRoom: vi.fn(),
	sendMessage: vi.fn(),
	startClient: vi.fn(),
	stopClient: vi.fn()
}));

vi.mock('../components/sessionCookie/getMatrixAccessToken', () => ({
	clearPersistedMatrixDeviceId: vi.fn(),
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
		mockedMatrixClient.getCrypto.mockReturnValue(mockedCrypto);
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

	it('keeps invisible crypto (verified-only) for a non-anonymous user when the toggle is on', async () => {
		const { setAppConfig } = await import('../utils/appConfig');
		setAppConfig({
			releaseToggles: { enableInvisibleCrypto: true }
		} as any);
		const service = new MatrixClientService();

		await service.initializeClient({
			userId: '@consultant:matrix.localhost',
			accessToken: 'access-token',
			deviceId: 'DEVICE_ONE',
			homeserverUrl: 'http://matrix.localhost:18008'
		});

		expect(mockedCrypto.setDeviceIsolationMode).toHaveBeenCalledTimes(1);
		expect(mockedCrypto.setDeviceIsolationMode.mock.calls[0][0].kind).toBe(
			DeviceIsolationModeKind.OnlySignedDevicesIsolationMode
		);
		setAppConfig(null as any);
	});

	it('shares to all devices for an anonymous live-chat user even when invisible crypto is on (#774)', async () => {
		const { setAppConfig } = await import('../utils/appConfig');
		setAppConfig({
			releaseToggles: { enableInvisibleCrypto: true }
		} as any);
		const service = new MatrixClientService();

		await service.initializeClient({
			userId: '@anon_abc:matrix.localhost',
			accessToken: 'access-token',
			deviceId: 'DEVICE_ANON',
			homeserverUrl: 'http://matrix.localhost:18008',
			isAnonymous: true
		});

		expect(mockedCrypto.setDeviceIsolationMode).toHaveBeenCalledTimes(1);
		expect(mockedCrypto.setDeviceIsolationMode.mock.calls[0][0].kind).toBe(
			DeviceIsolationModeKind.AllDevicesIsolationMode
		);
		setAppConfig(null as any);
	});

	it('preserves the anonymous flag across a token refresh so decryption keeps working (#774)', async () => {
		const { setAppConfig } = await import('../utils/appConfig');
		setAppConfig({
			releaseToggles: { enableInvisibleCrypto: true }
		} as any);
		const service = new MatrixClientService();

		await service.initializeClient({
			userId: '@anon_abc:matrix.localhost',
			accessToken: 'access-token',
			deviceId: 'DEVICE_ANON',
			homeserverUrl: 'http://matrix.localhost:18008',
			isAnonymous: true
		});
		expect(mockedCrypto.setDeviceIsolationMode.mock.calls[0][0].kind).toBe(
			DeviceIsolationModeKind.AllDevicesIsolationMode
		);

		// A token refresh returns only transport fields (no isAnonymous).
		vi.mocked(getMatrixAccessToken).mockResolvedValueOnce({
			userId: '@anon_abc:matrix.localhost',
			accessToken: 'refreshed-token',
			deviceId: 'DEVICE_ANON',
			homeserverUrl: 'http://matrix.localhost:18008'
		});
		await service.refreshMatrixToken();

		// The refreshed client must still share to all devices, not fall back to
		// verified-only isolation and re-break decryption.
		const lastCall = mockedCrypto.setDeviceIsolationMode.mock.calls.at(-1);
		expect(lastCall?.[0].kind).toBe(
			DeviceIsolationModeKind.AllDevicesIsolationMode
		);
		setAppConfig(null as any);
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

	it('recovers once with a fresh device when Rust crypto reports an OTK conflict', async () => {
		const syncListeners: Array<
			(state: string, previous: string | null, error?: unknown) => void
		> = [];
		mockedMatrixClient.on.mockImplementation((event, listener) => {
			if (event === 'sync') {
				syncListeners.push(listener);
			}
		});
		vi.mocked(getMatrixAccessToken).mockResolvedValueOnce({
			userId: '@alice:matrix.localhost',
			accessToken: 'fresh-token',
			deviceId: 'DEVICE_TWO',
			homeserverUrl: 'http://matrix.localhost:18008'
		});
		const service = new MatrixClientService();
		await service.initializeClient({
			userId: '@alice:matrix.localhost',
			accessToken: 'stale-token',
			deviceId: 'DEVICE_ONE',
			homeserverUrl: 'http://matrix.localhost:18008'
		});
		const errorObserver = vi.mocked(createMatrixClient).mock.calls[0]?.[1];

		errorObserver?.(
			'Failed to process outgoing request 0: M_UNKNOWN: MatrixError: [400] One time key signed_curve25519:AAAAAAAAAAQ already exists.'
		);
		errorObserver?.(
			'Failed to process outgoing request 0: M_UNKNOWN: MatrixError: [400] One time key signed_curve25519:AAAAAAAAAAQ already exists.'
		);
		await vi.waitFor(() => {
			expect(createMatrixClient).toHaveBeenCalledTimes(2);
		});
		syncListeners.at(-1)?.('PREPARED', null);

		expect(clearPersistedMatrixDeviceId).toHaveBeenCalledOnce();
		expect(clearPersistedMatrixDeviceId).toHaveBeenCalledWith(
			'@alice:matrix.localhost'
		);
		expect(getMatrixAccessToken).toHaveBeenCalledOnce();
		expect(persistMatrixLoginData).toHaveBeenCalledWith(
			expect.objectContaining({ deviceId: 'DEVICE_TWO' })
		);
		expect(createMatrixClient).toHaveBeenLastCalledWith(
			expect.objectContaining({ deviceId: 'DEVICE_TWO' }),
			expect.any(Function)
		);
	});

	it('blocks outbound sends until the recovered client reaches PREPARED', async () => {
		const syncListeners: Array<
			(state: string, previous: string | null, error?: unknown) => void
		> = [];
		mockedMatrixClient.on.mockImplementation((event, listener) => {
			if (event === 'sync') {
				syncListeners.push(listener);
			}
		});
		mockedMatrixClient.sendMessage.mockResolvedValue({ event_id: '$sent' });
		vi.mocked(getMatrixAccessToken).mockResolvedValueOnce({
			userId: '@alice:matrix.localhost',
			accessToken: 'fresh-token',
			deviceId: 'DEVICE_TWO',
			homeserverUrl: 'http://matrix.localhost:18008'
		});
		const service = new MatrixClientService();
		await service.initializeClient({
			userId: '@alice:matrix.localhost',
			accessToken: 'stale-token',
			deviceId: 'DEVICE_ONE',
			homeserverUrl: 'http://matrix.localhost:18008'
		});
		const errorObserver = vi.mocked(createMatrixClient).mock.calls[0]?.[1];

		errorObserver?.(
			'Failed to process outgoing request 0: M_UNKNOWN: MatrixError: [400] One time key signed_curve25519:AAAAAAAAAAQ already exists.'
		);
		const send = service.sendMessage('!room:matrix.localhost', 'hello');
		await vi.waitFor(() => {
			expect(createMatrixClient).toHaveBeenCalledTimes(2);
		});

		expect(mockedMatrixClient.sendMessage).not.toHaveBeenCalled();
		syncListeners.at(-1)?.('PREPARED', null);
		await send;
		expect(mockedMatrixClient.sendMessage).toHaveBeenCalledOnce();
	});

	it('exposes only the recovered PREPARED client to encryption setup (#839)', async () => {
		const syncListeners: Array<
			(state: string, previous: string | null, error?: unknown) => void
		> = [];
		mockedMatrixClient.on.mockImplementation((event, listener) => {
			if (event === 'sync') {
				syncListeners.push(listener);
			}
		});
		vi.mocked(getMatrixAccessToken).mockResolvedValueOnce({
			userId: '@alice:matrix.localhost',
			accessToken: 'fresh-token',
			deviceId: 'DEVICE_TWO',
			homeserverUrl: 'http://matrix.localhost:18008'
		});
		const service = new MatrixClientService();
		await service.initializeClient({
			userId: '@alice:matrix.localhost',
			accessToken: 'stale-token',
			deviceId: 'DEVICE_ONE',
			homeserverUrl: 'http://matrix.localhost:18008'
		});
		const errorObserver = vi.mocked(createMatrixClient).mock.calls[0]?.[1];

		errorObserver?.(
			'Failed to process outgoing request 0: M_UNKNOWN: MatrixError: [400] One time key signed_curve25519:AAAAAAAAAAQ already exists.'
		);
		const readyClient = service.getReadyClient();
		let settled = false;
		void readyClient.finally(() => {
			settled = true;
		});
		await vi.waitFor(() => {
			expect(createMatrixClient).toHaveBeenCalledTimes(2);
		});

		expect(settled).toBe(false);
		syncListeners.at(-1)?.('PREPARED', null);
		await expect(readyClient).resolves.toBe(mockedMatrixClient);
	});

	it('keeps waiting when stale-device recovery starts during the initial readiness wait (#839)', async () => {
		const syncListeners: Array<
			(state: string, previous: string | null, error?: unknown) => void
		> = [];
		mockedMatrixClient.on.mockImplementation((event, listener) => {
			if (event === 'sync') syncListeners.push(listener);
		});
		vi.mocked(getMatrixAccessToken).mockResolvedValueOnce({
			userId: '@alice:matrix.localhost',
			accessToken: 'fresh-token',
			deviceId: 'DEVICE_TWO',
			homeserverUrl: 'http://matrix.localhost:18008'
		});
		const service = new MatrixClientService();
		await service.initializeClient({
			userId: '@alice:matrix.localhost',
			accessToken: 'stale-token',
			deviceId: 'DEVICE_ONE',
			homeserverUrl: 'http://matrix.localhost:18008'
		});
		const errorObserver = vi.mocked(createMatrixClient).mock.calls[0]?.[1];

		const readyClient = service.getReadyClient();
		errorObserver?.(
			'Failed to process outgoing request 0: M_UNKNOWN: MatrixError: [400] One time key signed_curve25519:AAAAAAAAAAQ already exists.'
		);
		await vi.waitFor(() =>
			expect(createMatrixClient).toHaveBeenCalledTimes(2)
		);
		syncListeners.at(-1)?.('PREPARED', null);

		await expect(readyClient).resolves.toBe(mockedMatrixClient);
	});

	it('fails a recovered-client readiness wait immediately when that client is replaced', async () => {
		const service = new MatrixClientService();
		const recoveredClient = {
			...mockedMatrixClient
		};
		const replacementClient = {
			...mockedMatrixClient
		};
		setClient(service, recoveredClient);

		const wait = (
			service as unknown as {
				waitForClientPrepared: (
					client: Record<string, unknown>,
					timeoutMs: number
				) => Promise<void>;
			}
		).waitForClientPrepared(recoveredClient, 30_000);

		setClient(service, replacementClient);
		(
			service as unknown as {
				notifySyncStateListeners: () => void;
			}
		).notifySyncStateListeners();

		await expect(wait).rejects.toThrow(
			'Recovered Matrix client was replaced before reaching PREPARED'
		);
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

	it('removes the rejected Matrix local echo before the UI offers a fresh retry', async () => {
		const failedLocalEcho = {
			getTxnId: () => 'txn-failed-send'
		};
		const sendError = new Error('network unavailable');
		const sendMessage = vi.fn(() => Promise.reject(sendError));
		const cancelPendingEvent = vi.fn();
		const service = new MatrixClientService();
		setClient(service, {
			makeTxnId: () => 'txn-failed-send',
			sendMessage,
			cancelPendingEvent,
			getRoom: () => ({
				timeline: [failedLocalEcho]
			})
		});

		await expect(
			service.sendMessage('!room:example.org', 'Retry me once')
		).rejects.toBe(sendError);

		expect(sendMessage).toHaveBeenCalledWith(
			'!room:example.org',
			{ msgtype: 'm.text', body: 'Retry me once' },
			'txn-failed-send'
		);
		expect(cancelPendingEvent).toHaveBeenCalledOnce();
		expect(cancelPendingEvent).toHaveBeenCalledWith(failedLocalEcho);
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
