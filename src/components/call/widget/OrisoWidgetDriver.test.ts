import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MatrixClient } from 'matrix-js-sdk';

import { OrisoWidgetDriver } from './OrisoWidgetDriver';

const CALL_ROOM = '!call:oriso.example';
const OTHER_ROOM = '!counselling:oriso.example';

const createClient = (overrides: Partial<MatrixClient> = {}) =>
	({
		sendEvent: vi.fn().mockResolvedValue({ event_id: '$evt' }),
		sendStateEvent: vi.fn().mockResolvedValue({ event_id: '$state' }),
		queueToDevice: vi.fn().mockResolvedValue(undefined),
		encryptAndSendToDevice: vi.fn().mockResolvedValue(undefined),
		getCrypto: vi.fn().mockReturnValue({}),
		getRoom: vi.fn().mockReturnValue(null),
		...overrides
	}) as unknown as MatrixClient;

describe('OrisoWidgetDriver', () => {
	let client: MatrixClient;
	let driver: OrisoWidgetDriver;

	beforeEach(() => {
		client = createClient();
		driver = new OrisoWidgetDriver(client, CALL_ROOM);
	});

	describe('room confinement', () => {
		it('refuses to send into a room other than the call room', async () => {
			// A call widget has no business writing into the counselling session.
			await expect(
				driver.sendEvent('m.reaction', {}, null, OTHER_ROOM)
			).rejects.toThrow(/confined/);
			expect(client.sendEvent).not.toHaveBeenCalled();
		});

		it('refuses to read a room other than the call room', async () => {
			await expect(
				driver.readRoomState(OTHER_ROOM, 'm.room.member', undefined)
			).rejects.toThrow(/confined/);
		});

		it('treats an omitted room id as the call room', async () => {
			await driver.sendEvent('m.reaction', { hello: true });

			expect(client.sendEvent).toHaveBeenCalledWith(
				CALL_ROOM,
				'm.reaction',
				{ hello: true }
			);
		});
	});

	describe('capabilities', () => {
		it('grants what Element Call needs and drops the rest', async () => {
			const granted = await driver.validateCapabilities(
				new Set([
					'm.always_on_screen',
					'org.matrix.msc3819.send.to_device:m.call.encryption_keys',
					'org.matrix.msc2762.send.event:m.room.message'
				])
			);

			expect(granted).toEqual(
				new Set([
					'm.always_on_screen',
					'org.matrix.msc3819.send.to_device:m.call.encryption_keys'
				])
			);
		});
	});

	describe('to-device sending', () => {
		it('encrypts media keys through the host crypto stack', async () => {
			await driver.sendToDevice('m.call.encryption_keys', true, {
				'@asker:oriso.example': { DEV1: { key: 'a' } },
				'@counsellor:oriso.example': { DEV2: { key: 'a' } }
			});

			// Same payload for both devices, so one encrypted send covers both.
			expect(client.encryptAndSendToDevice).toHaveBeenCalledTimes(1);
			expect(client.encryptAndSendToDevice).toHaveBeenCalledWith(
				'm.call.encryption_keys',
				[
					{ userId: '@asker:oriso.example', deviceId: 'DEV1' },
					{ userId: '@counsellor:oriso.example', deviceId: 'DEV2' }
				],
				{ key: 'a' }
			);
			expect(client.queueToDevice).not.toHaveBeenCalled();
		});

		it('sends one encrypted batch per distinct payload', async () => {
			await driver.sendToDevice('m.call.encryption_keys', true, {
				'@asker:oriso.example': {
					DEV1: { key: 'a' },
					DEV2: { key: 'b' }
				}
			});

			expect(client.encryptAndSendToDevice).toHaveBeenCalledTimes(2);
		});

		it('refuses to send keys when the host has no crypto', async () => {
			// Falling back to plaintext here would leak the media keys that the
			// whole call encryption rests on.
			driver = new OrisoWidgetDriver(
				createClient({ getCrypto: vi.fn().mockReturnValue(undefined) }),
				CALL_ROOM
			);

			await expect(
				driver.sendToDevice('m.call.encryption_keys', true, {
					'@asker:oriso.example': { DEV1: { key: 'a' } }
				})
			).rejects.toThrow(/no crypto/);
		});

		it('uses the plain queue only when encryption was not requested', async () => {
			await driver.sendToDevice('m.call.hangup', false, {
				'@asker:oriso.example': { DEV1: { reason: 'user_hangup' } }
			});

			expect(client.queueToDevice).toHaveBeenCalledWith({
				eventType: 'm.call.hangup',
				batch: [
					{
						userId: '@asker:oriso.example',
						deviceId: 'DEV1',
						payload: { reason: 'user_hangup' }
					}
				]
			});
			expect(client.encryptAndSendToDevice).not.toHaveBeenCalled();
		});
	});

	describe('state events', () => {
		it('sends a state event when a state key is given', async () => {
			await driver.sendEvent(
				'org.matrix.msc3401.call.member',
				{ memberships: [] },
				'@a:oriso.example_DEV1_m.call'
			);

			expect(client.sendStateEvent).toHaveBeenCalledWith(
				CALL_ROOM,
				'org.matrix.msc3401.call.member',
				{ memberships: [] },
				'@a:oriso.example_DEV1_m.call'
			);
			expect(client.sendEvent).not.toHaveBeenCalled();
		});

		it('returns nothing for a room the client has not synced', async () => {
			await expect(
				driver.readRoomState(CALL_ROOM, 'm.room.member', undefined)
			).resolves.toEqual([]);
		});
	});
});
