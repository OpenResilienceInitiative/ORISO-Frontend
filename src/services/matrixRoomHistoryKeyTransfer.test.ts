// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClientEvent } from 'matrix-js-sdk';
import {
	MATRIX_HISTORY_KEYS_DIAGNOSTIC_EVENT,
	MATRIX_HISTORY_KEYS_IMPORTED_EVENT,
	MatrixRoomHistoryKeyTransfer,
	isUndecryptedRoomEvent
} from './matrixRoomHistoryKeyTransfer';
import { applyDeviceIsolationMode } from './matrixDeviceIsolation';

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
		setDeviceIsolationMode: vi.fn(),
		getDeviceVerificationStatus: vi.fn().mockResolvedValue({
			isVerified: () => true
		}),
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

	it('throttles repeated outgoing room-key requests', async () => {
		const harness = buildHarness();
		const service = new MatrixRoomHistoryKeyTransfer();
		service.initialize(harness.client as any);

		expect(await service.requestKeys(ROOM_ID)).toBe(true);
		expect(await service.requestKeys(ROOM_ID)).toBe(false);
		expect(harness.client.encryptAndSendToDevice).toHaveBeenCalledTimes(1);
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

	it('rejects an unverified requester device when invisible crypto is enabled', async () => {
		const harness = buildHarness();
		harness.crypto.getDeviceVerificationStatus.mockResolvedValue({
			isVerified: () => false
		});
		applyDeviceIsolationMode(harness.client as any, true);
		const service = new MatrixRoomHistoryKeyTransfer();
		service.initialize(harness.client as any);

		harness.emitToDevice(
			event('org.oriso.room_history_key_request', PEER, {
				room_id: ROOM_ID,
				request_id: 'unverified-request',
				requester_user_id: PEER,
				requester_device_id: 'ASKER1'
			})
		);
		await vi.waitFor(() =>
			expect(
				harness.crypto.getDeviceVerificationStatus
			).toHaveBeenCalledWith(PEER, 'ASKER1')
		);

		expect(harness.crypto.exportRoomKeys).not.toHaveBeenCalled();
	});

	it('throttles repeated incoming requests before exporting all account keys', async () => {
		const harness = buildHarness();
		const service = new MatrixRoomHistoryKeyTransfer();
		service.initialize(harness.client as any);
		const request = event('org.oriso.room_history_key_request', PEER, {
			room_id: ROOM_ID,
			request_id: 'request-1',
			requester_user_id: PEER,
			requester_device_id: 'ASKER1'
		});

		harness.emitToDevice(request);
		await vi.waitFor(() =>
			expect(harness.crypto.exportRoomKeys).toHaveBeenCalledTimes(1)
		);
		harness.emitToDevice(request);
		await Promise.resolve();

		expect(harness.crypto.exportRoomKeys).toHaveBeenCalledTimes(1);
	});

	it('does not send an oversized exported key bundle', async () => {
		const harness = buildHarness();
		harness.crypto.exportRoomKeys.mockResolvedValue(
			Array.from({ length: 5_001 }, (_, index) => ({
				room_id: ROOM_ID,
				session_id: `session-${index}`
			}))
		);
		const service = new MatrixRoomHistoryKeyTransfer();
		service.initialize(harness.client as any);

		harness.emitToDevice(
			event('org.oriso.room_history_key_request', PEER, {
				room_id: ROOM_ID,
				request_id: 'oversized-export',
				requester_user_id: PEER,
				requester_device_id: 'ASKER1'
			})
		);
		await vi.waitFor(() =>
			expect(harness.crypto.exportRoomKeys).toHaveBeenCalledOnce()
		);

		expect(harness.client.encryptAndSendToDevice).not.toHaveBeenCalled();
	});

	it('emits a minimal diagnostic when an incoming request handler fails', async () => {
		const harness = buildHarness();
		harness.crypto.exportRoomKeys.mockRejectedValue(
			new Error('sensitive crypto detail')
		);
		const diagnostic = vi.fn();
		window.addEventListener(
			MATRIX_HISTORY_KEYS_DIAGNOSTIC_EVENT,
			diagnostic
		);
		const service = new MatrixRoomHistoryKeyTransfer();
		service.initialize(harness.client as any);

		harness.emitToDevice(
			event('org.oriso.room_history_key_request', PEER, {
				room_id: ROOM_ID,
				request_id: 'failed-export',
				requester_user_id: PEER,
				requester_device_id: 'ASKER1'
			})
		);
		await vi.waitFor(() =>
			expect(diagnostic).toHaveBeenCalledWith(
				expect.objectContaining({
					detail: { stage: 'request-handler-failed' }
				})
			)
		);
		expect(JSON.stringify(diagnostic.mock.calls)).not.toContain(
			'sensitive crypto detail'
		);
		window.removeEventListener(
			MATRIX_HISTORY_KEYS_DIAGNOSTIC_EVENT,
			diagnostic
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

	it('retries failed timeline decryptions after a key import (FE#811)', async () => {
		const harness = buildHarness();
		const attemptDecryption = vi.fn().mockResolvedValue(undefined);
		const failedEvent = {
			isEncrypted: () => true,
			isDecryptionFailure: () => true,
			attemptDecryption
		};
		const decryptedEvent = {
			isEncrypted: () => true,
			isDecryptionFailure: () => false,
			attemptDecryption: vi.fn()
		};
		(harness.room as any).getLiveTimeline = vi.fn(() => ({
			getEvents: () => [failedEvent, decryptedEvent],
			getNeighbouringTimeline: () => null
		}));
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
				keys: [{ room_id: ROOM_ID, session_id: 'wanted' }]
			})
		);

		await vi.waitFor(() => expect(imported).toHaveBeenCalledOnce());

		// Only the failed event is retried, with the imported keys available,
		// and the retry completes BEFORE the imported event is announced (the
		// UI refetches on that event and must see plaintext, not the stale
		// m.bad.encrypted placeholder).
		expect(attemptDecryption).toHaveBeenCalledWith(harness.crypto, {
			isRetry: true
		});
		expect(decryptedEvent.attemptDecryption).not.toHaveBeenCalled();
		expect(attemptDecryption.mock.invocationCallOrder[0]).toBeLessThan(
			imported.mock.invocationCallOrder[0]
		);
	});

	it('retries failed events in backfilled scrollback timelines too (FE#811)', async () => {
		const harness = buildHarness();
		const liveFailed = {
			isEncrypted: () => true,
			isDecryptionFailure: () => true,
			attemptDecryption: vi.fn().mockResolvedValue(undefined)
		};
		const scrollbackFailed = {
			isEncrypted: () => true,
			isDecryptionFailure: () => true,
			attemptDecryption: vi.fn().mockResolvedValue(undefined)
		};
		const olderTimeline = {
			getEvents: () => [scrollbackFailed],
			getNeighbouringTimeline: () => null
		};
		(harness.room as any).getLiveTimeline = vi.fn(() => ({
			getEvents: () => [liveFailed],
			getNeighbouringTimeline: () => olderTimeline
		}));
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
				keys: [{ room_id: ROOM_ID, session_id: 'wanted' }]
			})
		);

		await vi.waitFor(() => expect(imported).toHaveBeenCalledOnce());
		expect(liveFailed.attemptDecryption).toHaveBeenCalledOnce();
		expect(scrollbackFailed.attemptDecryption).toHaveBeenCalledOnce();
	});

	it('a failing decryption retry never blocks the import announcement (FE#811)', async () => {
		const harness = buildHarness();
		const failedEvent = {
			isEncrypted: () => true,
			isDecryptionFailure: () => true,
			attemptDecryption: vi
				.fn()
				.mockRejectedValue(new Error('still no session'))
		};
		(harness.room as any).getLiveTimeline = vi.fn(() => ({
			getEvents: () => [failedEvent],
			getNeighbouringTimeline: () => null
		}));
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
				keys: [{ room_id: ROOM_ID, session_id: 'wanted' }]
			})
		);

		await vi.waitFor(() => expect(imported).toHaveBeenCalledOnce());
		expect(failedEvent.attemptDecryption).toHaveBeenCalled();
	});

	it('rejects oversized key bundles before import', async () => {
		const harness = buildHarness();
		const service = new MatrixRoomHistoryKeyTransfer();
		service.initialize(harness.client as any);
		harness.emitToDevice(
			event('org.oriso.room_history_key_bundle', PEER, {
				room_id: ROOM_ID,
				request_id: 'oversized',
				keys: Array.from({ length: 5_001 }, (_, index) => ({
					room_id: ROOM_ID,
					session_id: `session-${index}`
				}))
			})
		);
		await Promise.resolve();

		expect(harness.crypto.importRoomKeys).not.toHaveBeenCalled();
	});

	it('does not import from a sender who is no longer a room member', async () => {
		const harness = buildHarness();
		harness.memberships.set(PEER, member(PEER, 'ban'));
		const service = new MatrixRoomHistoryKeyTransfer();
		service.initialize(harness.client as any);
		harness.emitToDevice(
			event('org.oriso.room_history_key_bundle', PEER, {
				room_id: ROOM_ID,
				request_id: 'blocked-sender',
				keys: [{ room_id: ROOM_ID, session_id: 'blocked' }]
			})
		);
		await Promise.resolve();

		expect(harness.crypto.importRoomKeys).not.toHaveBeenCalled();
	});

	it('does not broadcast diagnostics for unrelated to-device events', async () => {
		const harness = buildHarness();
		const diagnostic = vi.fn();
		window.addEventListener(
			MATRIX_HISTORY_KEYS_DIAGNOSTIC_EVENT,
			diagnostic
		);
		const service = new MatrixRoomHistoryKeyTransfer();
		service.initialize(harness.client as any);

		harness.emitToDevice(event('m.dummy', PEER, {}));
		await Promise.resolve();

		expect(diagnostic).not.toHaveBeenCalled();
		window.removeEventListener(
			MATRIX_HISTORY_KEYS_DIAGNOSTIC_EVENT,
			diagnostic
		);
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
