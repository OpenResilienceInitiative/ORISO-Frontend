// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClientEvent } from 'matrix-js-sdk';
import {
	MATRIX_HISTORY_KEYS_IMPORTED_EVENT,
	MatrixRoomHistoryKeyTransfer,
	isUndecryptedRoomEvent
} from './matrixRoomHistoryKeyTransfer';

const ROOM_ID = '!case:matrix';
const ME = '@new:matrix';
const PEER = '@asker:matrix';

const member = (userId: string, membership = 'join') => ({
	userId,
	membership
});

const buildHarness = () => {
	let toDeviceHandler: ((event: any) => void) | undefined;
	const memberships = new Map([
		[ME, member(ME)],
		[PEER, member(PEER)]
	]);
	const room = {
		loadMembersIfNeeded: vi.fn(async () => true),
		getMember: vi.fn((userId: string) => memberships.get(userId)),
		getJoinedMembers: vi.fn(() =>
			Array.from(memberships.values()).filter(
				(item) => item.membership === 'join'
			)
		)
	};
	const crypto = {
		getUserDeviceInfo: vi
			.fn()
			.mockResolvedValue(
				new Map([[PEER, new Map([['ASKER1', { deviceId: 'ASKER1' }]])]])
			),
		exportRoomKeys: vi.fn().mockResolvedValue([
			{ room_id: ROOM_ID, session_id: 'wanted' },
			{ room_id: '!other:matrix', session_id: 'blocked' }
		]),
		importRoomKeys: vi.fn().mockResolvedValue(undefined)
	};
	const client = {
		getCrypto: vi.fn(() => crypto),
		getUserId: vi.fn(() => ME),
		getDeviceId: vi.fn(() => 'NEW1'),
		getRoom: vi.fn((roomId: string) => (roomId === ROOM_ID ? room : null)),
		on: vi.fn((event: string, handler: (matrixEvent: any) => void) => {
			if (event === ClientEvent.ReceivedToDeviceMessage)
				toDeviceHandler = handler;
		}),
		off: vi.fn(),
		encryptAndSendToDevice: vi.fn().mockResolvedValue(undefined)
	};
	return {
		client,
		crypto,
		room,
		memberships,
		emitToDevice: (event: any) =>
			toDeviceHandler?.({
				message: {
					type: event.getType(),
					sender: event.getSender(),
					content: event.getContent()
				}
			})
	};
};

const event = (type: string, sender: string, content: object) => ({
	getType: () => type,
	getSender: () => sender,
	getContent: () => content
});

describe('MatrixRoomHistoryKeyTransfer', () => {
	beforeEach(() => vi.clearAllMocks());

	it('requests history keys only from other joined users devices', async () => {
		const harness = buildHarness();
		const service = new MatrixRoomHistoryKeyTransfer();
		service.initialize(harness.client as any);

		expect(await service.requestKeys(ROOM_ID)).toBe(true);
		expect(harness.client.encryptAndSendToDevice).toHaveBeenCalledWith(
			'org.oriso.room_history_key_request',
			[{ userId: PEER, deviceId: 'ASKER1' }],
			expect.objectContaining({
				room_id: ROOM_ID,
				requester_user_id: ME,
				requester_device_id: 'NEW1'
			})
		);
	});

	it('still requests from valid devices when another device has no Olm session', async () => {
		const harness = buildHarness();
		harness.crypto.getUserDeviceInfo.mockResolvedValue(
			new Map([
				[
					PEER,
					new Map([
						['BROKEN', { deviceId: 'BROKEN' }],
						['ASKER1', { deviceId: 'ASKER1' }]
					])
				]
			])
		);
		harness.client.encryptAndSendToDevice.mockImplementation(
			(_type: string, targets: Array<{ deviceId: string }>) =>
				targets[0]?.deviceId === 'BROKEN'
					? Promise.reject(new Error('missing Olm session'))
					: Promise.resolve()
		);
		const service = new MatrixRoomHistoryKeyTransfer();
		service.initialize(harness.client as any);

		await expect(service.requestKeys(ROOM_ID)).resolves.toBe(true);
		expect(harness.client.encryptAndSendToDevice).toHaveBeenCalledWith(
			'org.oriso.room_history_key_request',
			[{ userId: PEER, deviceId: 'ASKER1' }],
			expect.any(Object)
		);
	});

	it('recognises both raw and SDK-normalised decryption failures', () => {
		expect(
			isUndecryptedRoomEvent({ isDecryptionFailure: () => true })
		).toBe(true);
		expect(
			isUndecryptedRoomEvent({
				isDecryptionFailure: () => false,
				getContent: () => ({ msgtype: 'm.bad.encrypted' })
			})
		).toBe(true);
		expect(
			isUndecryptedRoomEvent({
				isDecryptionFailure: () => false,
				getType: () => 'm.room.message',
				getClearContent: () => ({
					msgtype: 'm.text',
					body: '** Unable to decrypt: DecryptionError: missing room key **'
				})
			})
		).toBe(true);
		expect(
			isUndecryptedRoomEvent({
				isDecryptionFailure: () => false,
				getType: () => 'm.room.message',
				getContent: () => ({
					msgtype: 'm.text',
					body: '** Unable to decrypt: DecryptionError: missing room key **'
				})
			})
		).toBe(true);
		expect(
			isUndecryptedRoomEvent({
				isDecryptionFailure: () => false,
				getContent: () => ({ msgtype: 'm.text' }),
				getType: () => 'm.room.message'
			})
		).toBe(false);
	});

	it('retries a request queued before the Matrix client is prepared', async () => {
		const harness = buildHarness();
		const service = new MatrixRoomHistoryKeyTransfer();

		expect(await service.requestKeys(ROOM_ID)).toBe(false);
		service.initialize(harness.client as any);

		await vi.waitFor(() =>
			expect(harness.client.encryptAndSendToDevice).toHaveBeenCalled()
		);
	});

	it('answers an authorised joined requester with only that rooms keys', async () => {
		const harness = buildHarness();
		const service = new MatrixRoomHistoryKeyTransfer();
		service.initialize(harness.client as any);
		harness.emitToDevice(
			event('org.oriso.room_history_key_request', PEER, {
				room_id: ROOM_ID,
				request_id: 'request-1',
				requester_user_id: PEER,
				requester_device_id: 'ASKER1'
			})
		);
		await vi.waitFor(() =>
			expect(harness.client.encryptAndSendToDevice).toHaveBeenCalled()
		);

		expect(harness.client.encryptAndSendToDevice).toHaveBeenCalledWith(
			'org.oriso.room_history_key_bundle',
			[{ userId: PEER, deviceId: 'ASKER1' }],
			{
				room_id: ROOM_ID,
				request_id: 'request-1',
				keys: [{ room_id: ROOM_ID, session_id: 'wanted' }]
			}
		);
	});

	it('loads lazy room members before authorising a requester', async () => {
		const harness = buildHarness();
		let membersLoaded = false;
		harness.room.loadMembersIfNeeded = vi.fn(async () => {
			membersLoaded = true;
			return true;
		});
		harness.room.getMember.mockImplementation((userId: string) =>
			membersLoaded ? harness.memberships.get(userId) : undefined
		);
		const service = new MatrixRoomHistoryKeyTransfer();
		service.initialize(harness.client as any);

		harness.emitToDevice(
			event('org.oriso.room_history_key_request', PEER, {
				room_id: ROOM_ID,
				request_id: 'lazy-request',
				requester_user_id: PEER,
				requester_device_id: 'ASKER1'
			})
		);

		await vi.waitFor(() =>
			expect(harness.crypto.exportRoomKeys).toHaveBeenCalled()
		);
		expect(harness.room.loadMembersIfNeeded).toHaveBeenCalledOnce();
	});

	it('imports only matching room keys from a current or former member', async () => {
		const harness = buildHarness();
		const imported = vi.fn();
		window.addEventListener(MATRIX_HISTORY_KEYS_IMPORTED_EVENT, imported, {
			once: true
		});
		const service = new MatrixRoomHistoryKeyTransfer();
		service.initialize(harness.client as any);
		harness.emitToDevice(
			event('org.oriso.room_history_key_bundle', PEER, {
				room_id: ROOM_ID,
				request_id: 'request-1',
				keys: [
					{ room_id: ROOM_ID, session_id: 'wanted' },
					{ room_id: '!other:matrix', session_id: 'blocked' }
				]
			})
		);
		await vi.waitFor(() =>
			expect(harness.crypto.importRoomKeys).toHaveBeenCalled()
		);

		expect(harness.crypto.importRoomKeys).toHaveBeenCalledWith([
			{ room_id: ROOM_ID, session_id: 'wanted' }
		]);
		expect(imported).toHaveBeenCalledOnce();
	});

	it('does not export keys to a sender who is not joined', async () => {
		const harness = buildHarness();
		harness.memberships.set(PEER, member(PEER, 'leave'));
		const service = new MatrixRoomHistoryKeyTransfer();
		service.initialize(harness.client as any);
		harness.emitToDevice(
			event('org.oriso.room_history_key_request', PEER, {
				room_id: ROOM_ID,
				request_id: 'request-1',
				requester_user_id: PEER,
				requester_device_id: 'ASKER1'
			})
		);
		await Promise.resolve();

		expect(harness.crypto.exportRoomKeys).not.toHaveBeenCalled();
	});
});
