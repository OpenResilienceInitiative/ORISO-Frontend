import { MatrixClient, MemoryStore } from 'matrix-js-sdk';
import { logger } from 'matrix-js-sdk/lib/logger';
import { describe, expect, it, vi } from 'vite-plus/test';

import { OrisoWidgetDriver } from './OrisoWidgetDriver';

const CALL_ROOM = '!call:oriso.example';
const CALL_KEY_EVENT = 'io.element.call.encryption_keys';
const HISTORY_REQUEST_COUNT = 150;

/**
 * FE#1828 regression, against the real js-sdk to-device queue.
 *
 * The SDK keeps ONE persistent FIFO of outgoing to-device batches and sends it
 * strictly one HTTP request at a time. The room-history key request puts one
 * batch per peer device into it, which on a user with many devices is hundreds
 * of requests. A call key appended behind them reached the peer 30-60 s late
 * and the peer's video stayed black until then.
 */
describe('OrisoWidgetDriver against the real to-device queue (FE#1828)', () => {
	it('puts the call key on the wire before a queued backlog has drained', async () => {
		// The SDK logs every queued batch; 150 of them drown the test output.
		logger.setLevel('silent');
		const sentEventTypes: string[] = [];
		const fetchFn = vi.fn(async (url: RequestInfo | URL) => {
			const path = new URL(String(url)).pathname;
			sentEventTypes.push(
				decodeURIComponent(
					path.split('/sendToDevice/')[1].split('/')[0]
				)
			);
			// A real round trip, so the queue cannot drain synchronously.
			await new Promise((resolve) => setTimeout(resolve, 2));
			return new Response('{}', {
				status: 200,
				headers: { 'content-type': 'application/json' }
			});
		});
		const client = new MatrixClient({
			baseUrl: 'https://hs.oriso.example',
			userId: '@counsellor:oriso.example',
			deviceId: 'COUNSELLOR1',
			accessToken: 'token',
			store: new MemoryStore(),
			fetchFn: fetchFn as unknown as typeof fetch
		});
		const crypto = {
			encryptToDeviceMessages: async (
				eventType: string,
				devices: { userId: string; deviceId: string }[],
				payload: object
			) => ({
				// Olm always wraps in m.room.encrypted; keep the inner type
				// visible so the test can tell the two kinds of traffic apart.
				eventType: `m.room.encrypted.${eventType}`,
				batch: devices.map((device) => ({ ...device, payload }))
			})
		};
		// `encryptAndSendToDevice` reaches the crypto stack through this
		// private field, `sendToDevice` callers through `getCrypto()`.
		(client as unknown as { cryptoBackend: unknown }).cryptoBackend =
			crypto;
		vi.spyOn(client, 'getCrypto').mockReturnValue(crypto as never);

		// What the history-key request does: one single-device batch per device.
		for (let index = 0; index < HISTORY_REQUEST_COUNT; index += 1) {
			await client.queueToDevice({
				eventType:
					'm.room.encrypted.org.oriso.room_history_key_request',
				batch: [
					{
						userId: '@peer:oriso.example',
						deviceId: `STALE${index}`,
						payload: {}
					}
				]
			});
		}

		const driver = new OrisoWidgetDriver(client, CALL_ROOM);
		await driver.sendToDevice(CALL_KEY_EVENT, true, {
			'@asker:oriso.example': { ASKER1: { keys: { index: 0 } } }
		});

		const callKeyPosition = sentEventTypes.indexOf(
			`m.room.encrypted.${CALL_KEY_EVENT}`
		);
		expect(callKeyPosition).toBeGreaterThanOrEqual(0);
		// Behind the backlog it would be request number ~HISTORY_REQUEST_COUNT.
		expect(callKeyPosition).toBeLessThan(10);
	});
});
