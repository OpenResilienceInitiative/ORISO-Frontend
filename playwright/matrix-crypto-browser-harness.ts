import { ClientEvent, createClient, MatrixClient } from 'matrix-js-sdk';
import { buildMatrixCryptoStorePrefix } from '../src/services/matrixCrypto';

const baseUrl = 'http://localhost:18008';
const stateKey = 'oriso-matrix-browser-reload-smoke';
const status = document.querySelector<HTMLElement>(
	'[data-testid="matrix-crypto-status"]'
)!;

interface ReloadState {
	accessToken: string;
	deviceId: string;
	eventId: string;
	expectedBody: string;
	roomId: string;
	userId: string;
}

const withTimeout = async <T>(
	promise: Promise<T>,
	label: string
): Promise<T> => {
	let timeout: ReturnType<typeof setTimeout>;
	try {
		return await Promise.race([
			promise,
			new Promise<T>((_, reject) => {
				timeout = setTimeout(
					() => reject(new Error(`Timed out waiting for ${label}`)),
					20_000
				);
			})
		]);
	} finally {
		clearTimeout(timeout!);
	}
};

const startClient = async (state: {
	accessToken: string;
	deviceId: string;
	userId: string;
}): Promise<MatrixClient> => {
	const client = createClient({
		baseUrl,
		accessToken: state.accessToken,
		deviceId: state.deviceId,
		userId: state.userId
	});
	await client.initRustCrypto({
		useIndexedDB: true,
		cryptoDatabasePrefix: buildMatrixCryptoStorePrefix(
			state.userId,
			state.deviceId
		)
	});
	const prepared = new Promise<void>((resolve, reject) => {
		const onSync = (
			syncState: string,
			_previous: string | null,
			data?: any
		) => {
			if (syncState === 'PREPARED') {
				client.off(ClientEvent.Sync, onSync);
				resolve();
			} else if (syncState === 'ERROR') {
				client.off(ClientEvent.Sync, onSync);
				reject(data?.error ?? new Error('Matrix sync failed'));
			}
		};
		client.on(ClientEvent.Sync, onSync);
	});
	client.startClient({ initialSyncLimit: 20 });
	await withTimeout(prepared, 'Matrix PREPARED state');
	return client;
};

const register = async () => {
	const suffix = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
	const localpart = `browser_reload_${suffix}`;
	const response = await fetch(`${baseUrl}/_matrix/client/v3/register`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			auth: { type: 'm.login.dummy' },
			username: localpart,
			password: `local-only-${localpart}`,
			initial_device_display_name: 'Browser reload smoke'
		})
	});
	if (!response.ok)
		throw new Error(`Registration failed: ${response.status}`);
	return response.json();
};

const waitForHistoricEvent = (client: MatrixClient, state: ReloadState) =>
	withTimeout(
		new Promise<void>((resolve) => {
			const inspect = () => {
				const event = client
					.getRoom(state.roomId)
					?.getLiveTimeline()
					.getEvents()
					.find((candidate) => candidate.getId() === state.eventId);
				if (
					event?.getWireType() === 'm.room.encrypted' &&
					event.getType() === 'm.room.message' &&
					event.getContent()?.body === state.expectedBody
				) {
					clearInterval(interval);
					resolve();
				}
			};
			const interval = setInterval(inspect, 100);
			inspect();
		}),
		'historic browser event decryption'
	);

const waitForEncryptedRoom = (client: MatrixClient, roomId: string) =>
	withTimeout(
		new Promise<void>((resolve) => {
			const inspect = () => {
				const encryption = client
					.getRoom(roomId)
					?.currentState.getStateEvents('m.room.encryption', '');
				if (
					encryption?.getContent()?.algorithm ===
					'm.megolm.v1.aes-sha2'
				) {
					clearInterval(interval);
					resolve();
				}
			};
			const interval = setInterval(inspect, 100);
			inspect();
		}),
		'encrypted room state'
	);

const run = async () => {
	const previous = localStorage.getItem(stateKey);
	if (previous) {
		const state = JSON.parse(previous) as ReloadState;
		const client = await startClient(state);
		await waitForHistoricEvent(client, state);
		status.textContent = 'recovered';
		return;
	}

	const registration = await register();
	const client = await startClient({
		accessToken: registration.access_token,
		deviceId: registration.device_id,
		userId: registration.user_id
	});
	const room = await client.createRoom({
		name: 'Browser reload crypto smoke',
		preset: 'private_chat',
		initial_state: [
			{
				type: 'm.room.encryption',
				state_key: '',
				content: { algorithm: 'm.megolm.v1.aes-sha2' }
			}
		]
	});
	await waitForEncryptedRoom(client, room.room_id);
	const expectedBody = `IndexedDB reload proof ${Date.now()}`;
	const sent = await client.sendMessage(room.room_id, {
		msgtype: 'm.text',
		body: expectedBody
	});
	const state: ReloadState = {
		accessToken: registration.access_token,
		deviceId: registration.device_id,
		eventId: sent.event_id,
		expectedBody,
		roomId: room.room_id,
		userId: registration.user_id
	};
	// Wait for the encrypted remote echo to be decrypted and committed to the
	// IndexedDB-backed Rust store before the browser is reloaded.
	await waitForHistoricEvent(client, state);
	localStorage.setItem(stateKey, JSON.stringify(state));
	status.textContent = 'prepared';
};

run().catch((error) => {
	status.textContent = `error: ${error instanceof Error ? error.message : String(error)}`;
});
