import {
	createClient,
	ClientEvent,
	MatrixEventEvent,
	RoomEvent
} from 'matrix-js-sdk';
import { logger } from 'matrix-js-sdk/lib/logger.js';
import { decodeRecoveryKey } from 'matrix-js-sdk/lib/crypto-api/recovery-key.js';

const baseUrl = process.env.MATRIX_SMOKE_BASE_URL ?? 'http://localhost:18008';
const timeoutMs = 30_000;

logger.setLevel('silent', false);

const withTimeout = async (promise, label) => {
	let timeout;
	try {
		return await Promise.race([
			promise,
			new Promise((_, reject) => {
				timeout = setTimeout(
					() => reject(new Error(`Timed out waiting for ${label}`)),
					timeoutMs
				);
			})
		]);
	} finally {
		clearTimeout(timeout);
	}
};

const silentLogger = {
	trace() {},
	debug() {},
	info() {},
	warn() {},
	error(...args) {
		console.error(...args);
	},
	getChild() {
		return this;
	}
};

const registerDevice = async (localpart, displayName) => {
	const response = await fetch(`${baseUrl}/_matrix/client/v3/register`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			auth: { type: 'm.login.dummy' },
			username: localpart,
			password: `local-only-${localpart}`,
			initial_device_display_name: displayName
		})
	});

	if (!response.ok) {
		throw new Error(
			`Matrix registration failed with HTTP ${response.status}`
		);
	}

	const registration = await response.json();
	if (
		!registration.user_id ||
		!registration.device_id ||
		!registration.access_token
	) {
		throw new Error('Matrix registration response is incomplete');
	}

	return registration;
};

const loginDevice = async (localpart, password, displayName) => {
	const response = await fetch(`${baseUrl}/_matrix/client/v3/login`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			type: 'm.login.password',
			identifier: { type: 'm.id.user', user: localpart },
			password,
			initial_device_display_name: displayName
		})
	});
	if (!response.ok) {
		throw new Error(`Matrix login failed with HTTP ${response.status}`);
	}
	return response.json();
};

const createSecretStorageCallbacks = (seededPrivateKey = null) => {
	let keyId = null;
	let privateKey = seededPrivateKey;
	return {
		cacheSecretStorageKey(id, _keyInfo, key) {
			keyId = id;
			privateKey = new Uint8Array(key);
		},
		async getSecretStorageKey({ keys }) {
			const requestedKeyId =
				(keyId && keys[keyId] && keyId) || Object.keys(keys)[0];
			return requestedKeyId && privateKey
				? [requestedKeyId, privateKey]
				: null;
		}
	};
};

const passwordUiAuth = (userId, password) => async (makeRequest) => {
	try {
		return await makeRequest(null);
	} catch (error) {
		return makeRequest({
			type: 'm.login.password',
			identifier: { type: 'm.id.user', user: userId },
			password,
			session: error?.data?.session
		});
	}
};

const startEncryptedClient = async (registration, cryptoCallbacks = {}) => {
	const client = createClient({
		baseUrl,
		userId: registration.user_id,
		deviceId: registration.device_id,
		accessToken: registration.access_token,
		logger: silentLogger,
		cryptoCallbacks
	});

	await client.initRustCrypto({ useIndexedDB: false });
	const prepared = new Promise((resolve, reject) => {
		const onSync = (state, _previousState, error) => {
			if (state === 'PREPARED') {
				client.off(ClientEvent.Sync, onSync);
				resolve();
			} else if (state === 'ERROR') {
				client.off(ClientEvent.Sync, onSync);
				reject(error ?? new Error('Matrix sync failed'));
			}
		};
		client.on(ClientEvent.Sync, onSync);
	});
	client.startClient({ initialSyncLimit: 20 });
	await withTimeout(prepared, `initial sync for ${registration.user_id}`);
	return client;
};

const waitForKeyBackup = (registration) =>
	withTimeout(
		(async () => {
			for (;;) {
				const response = await fetch(
					`${baseUrl}/_matrix/client/v3/room_keys/version`,
					{
						headers: {
							Authorization: `Bearer ${registration.access_token}`
						}
					}
				);
				if (response.ok) {
					const info = await response.json();
					if (Number(info.count) > 0) return info;
				}
				await new Promise((resolve) => setTimeout(resolve, 200));
			}
		})(),
		'uploaded Matrix key backup'
	);

const waitForRoom = (client, roomId) =>
	withTimeout(
		new Promise((resolve) => {
			const existing = client.getRoom(roomId);
			if (existing) {
				resolve(existing);
				return;
			}

			const onRoom = (room) => {
				if (room.roomId === roomId) {
					client.off(ClientEvent.Room, onRoom);
					resolve(room);
				}
			};
			client.on(ClientEvent.Room, onRoom);
		}),
		`room ${roomId}`
	);

const waitForEncryptedMessage = (client, roomId, expectedBody) =>
	withTimeout(
		new Promise((resolve) => {
			const finishIfDecrypted = (event) => {
				if (
					event.getWireType() === 'm.room.encrypted' &&
					event.getType() === 'm.room.message' &&
					event.getContent()?.body === expectedBody
				) {
					client.off(RoomEvent.Timeline, inspect);
					resolve(event);
				}
			};

			const inspect = (event, room) => {
				if (
					room?.roomId !== roomId ||
					event.getWireType() !== 'm.room.encrypted'
				) {
					return;
				}

				finishIfDecrypted(event);
				event.once(MatrixEventEvent.Decrypted, () =>
					finishIfDecrypted(event)
				);
			};
			client.on(RoomEvent.Timeline, inspect);
		}),
		'encrypted and decrypted Matrix message'
	);

const waitForHistoricDecryption = (client, roomId, expectedBody) =>
	withTimeout(
		new Promise((resolve) => {
			const inspect = () => {
				const event = client
					.getRoom(roomId)
					?.getLiveTimeline()
					.getEvents()
					.find(
						(candidate) =>
							candidate.getWireType() === 'm.room.encrypted' &&
							candidate.getType() === 'm.room.message' &&
							candidate.getContent()?.body === expectedBody
					);
				if (event) {
					clearInterval(interval);
					resolve(event);
				}
			};
			const interval = setInterval(inspect, 100);
			inspect();
		}),
		'historic decryption on a fresh device'
	);

const suffix = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
let alice;
let bob;
let bobSecondDevice;

try {
	const aliceRegistration = await registerDevice(
		`megolm_alice_${suffix}`,
		'Megolm smoke Alice'
	);
	const bobLocalpart = `megolm_bob_${suffix}`;
	const bobPassword = `local-only-${bobLocalpart}`;
	const bobRegistration = await registerDevice(
		bobLocalpart,
		'Megolm smoke Bob'
	);
	const bobSecretStorageCallbacks = createSecretStorageCallbacks();
	alice = await startEncryptedClient(aliceRegistration);
	bob = await startEncryptedClient(
		bobRegistration,
		bobSecretStorageCallbacks
	);

	const { room_id: roomId } = await alice.createRoom({
		name: `Megolm smoke ${suffix}`,
		preset: 'private_chat',
		invite: [bobRegistration.user_id],
		initial_state: [
			{
				type: 'm.room.encryption',
				state_key: '',
				content: { algorithm: 'm.megolm.v1.aes-sha2' }
			}
		]
	});

	await waitForRoom(bob, roomId);
	await bob.joinRoom(roomId);
	const body = `Megolm transport proof ${suffix}`;
	const received = waitForEncryptedMessage(bob, roomId, body);
	await alice.sendMessage(roomId, { msgtype: 'm.text', body });
	await received;

	const bobCrypto = bob.getCrypto();
	await bobCrypto.bootstrapCrossSigning({
		setupNewCrossSigning: true,
		authUploadDeviceSigningKeys: passwordUiAuth(
			bobRegistration.user_id,
			bobPassword
		)
	});
	if (!(await bobCrypto.isCrossSigningReady())) {
		throw new Error(
			'Cross-signing did not become ready on the first device'
		);
	}
	let recoveryKey;
	await bobCrypto.bootstrapSecretStorage({
		setupNewSecretStorage: true,
		setupNewKeyBackup: true,
		createSecretStorageKey: async () => {
			recoveryKey = await bobCrypto.createRecoveryKeyFromPassphrase(
				`recovery-${suffix}`
			);
			return recoveryKey;
		}
	});
	await waitForKeyBackup(bobRegistration);
	if (!recoveryKey?.encodedPrivateKey) {
		throw new Error('SDK did not create an encoded recovery key');
	}

	const secondRegistration = await loginDevice(
		bobLocalpart,
		bobPassword,
		'Megolm smoke Bob recovery device'
	);
	const recoveredPrivateKey = decodeRecoveryKey(
		recoveryKey.encodedPrivateKey
	);
	bobSecondDevice = await startEncryptedClient(
		secondRegistration,
		createSecretStorageCallbacks(recoveredPrivateKey)
	);
	await waitForRoom(bobSecondDevice, roomId);
	const secondCrypto = bobSecondDevice.getCrypto();
	await secondCrypto.loadSessionBackupPrivateKeyFromSecretStorage();
	const restoreResult = await secondCrypto.restoreKeyBackup();
	if (restoreResult.imported < 1) {
		throw new Error('Fresh device restored no Megolm sessions');
	}
	await bobCrypto.getUserDeviceInfo([bobRegistration.user_id], true);
	await bobCrypto.crossSignDevice(secondRegistration.device_id);
	await secondCrypto.bootstrapCrossSigning({ setupNewCrossSigning: false });
	if (!(await secondCrypto.isCrossSigningReady())) {
		throw new Error('Cross-signing recovery did not become ready');
	}
	await waitForHistoricDecryption(bobSecondDevice, roomId, body);

	const encryptionState = alice
		.getRoom(roomId)
		?.currentState.getStateEvents('m.room.encryption', '');
	if (
		!encryptionState ||
		encryptionState.getContent()?.algorithm !== 'm.megolm.v1.aes-sha2'
	) {
		throw new Error('Room is missing the Megolm encryption state');
	}

	console.log('Matrix Megolm smoke: PASS');
} finally {
	for (const client of [alice, bob, bobSecondDevice]) {
		client?.stopClient();
		client?.removeAllListeners();
	}
}

// The SDK's aborted long-poll fetches can retain Node handles after the clients
// and Rust crypto machines have been stopped. This is a one-shot smoke command.
process.exit(0);
