// @vitest-environment oriso-jsdom
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { ClientEvent } from 'matrix-js-sdk';
import {
	MATRIX_HISTORY_KEYS_DIAGNOSTIC_EVENT,
	MATRIX_HISTORY_KEYS_IMPORTED_EVENT,
	MATRIX_HISTORY_REQUEST_PENDING_EVENT,
	MATRIX_HISTORY_REQUEST_RESOLVED_EVENT,
	MatrixRoomHistoryKeyTransfer,
	isUndecryptedRoomEvent
} from './matrixRoomHistoryKeyTransfer';
import { applyDeviceIsolationMode } from './matrixDeviceIsolation';

vi.mock('@matrix-org/matrix-sdk-crypto-wasm', () => ({
	UserId: class {
		constructor(private readonly id: string) {}

		toString() {
			return this.id;
		}
	}
}));

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
			isVerified: () => true,
			signedByOwner: true,
			crossSigningVerified: true
		}),
		getUserVerificationStatus: vi.fn().mockResolvedValue({
			needsUserApproval: false,
			wasCrossSigningVerified: () => false,
			isCrossSigningVerified: () => false
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
		emitToDevice: (event: any, encryptionInfo?: object | null) =>
			toDeviceHandler?.({
				message: {
					type: event.getType(),
					sender: event.getSender(),
					content: event.getContent()
				},
				...(encryptionInfo === undefined ? {} : { encryptionInfo })
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

	it('loads joined donors and hydrates their devices before requesting history keys', async () => {
		const harness = buildHarness();
		harness.memberships.delete(PEER);
		harness.room.loadMembersIfNeeded.mockImplementation(async () => {
			harness.memberships.set(PEER, member(PEER));
			return true;
		});
		const keyQuery = {};
		Object.assign(harness.crypto, {
			olmMachine: {
				updateTrackedUsers: vi.fn().mockResolvedValue(undefined),
				queryKeysForUsers: vi.fn(() => keyQuery)
			},
			outgoingRequestProcessor: {
				makeOutgoingRequest: vi.fn(async () => {
					harness.crypto.getUserDeviceInfo.mockResolvedValue(
						new Map([
							[
								PEER,
								new Map([['ASKER1', { deviceId: 'ASKER1' }]])
							]
						])
					);
				})
			}
		});
		harness.crypto.getUserDeviceInfo.mockResolvedValue(new Map());
		const service = new MatrixRoomHistoryKeyTransfer();
		service.initialize(harness.client as any);

		await expect(service.requestKeys(ROOM_ID)).resolves.toBe(true);
		expect(harness.client.encryptAndSendToDevice).toHaveBeenCalledWith(
			'org.oriso.room_history_key_request',
			[{ userId: PEER, deviceId: 'ASKER1' }],
			expect.any(Object)
		);
		const rust = (harness.crypto as any).olmMachine;
		for (const fn of [rust.updateTrackedUsers, rust.queryKeysForUsers]) {
			expect(fn.mock.calls[0][0].map(String)).toEqual([PEER]);
		}
		expect(
			(harness.crypto as any).outgoingRequestProcessor.makeOutgoingRequest
		).toHaveBeenCalledWith(keyQuery);
	});

	it('throttles repeated outgoing room-key requests', async () => {
		const harness = buildHarness();
		const service = new MatrixRoomHistoryKeyTransfer();
		service.initialize(harness.client as any);

		expect(await service.requestKeys(ROOM_ID)).toBe(true);
		expect(await service.requestKeys(ROOM_ID)).toBe(false);
		expect(harness.client.encryptAndSendToDevice).toHaveBeenCalledTimes(1);
	});

	it('lets a request with a reason follow the automatic one at once', async () => {
		const harness = buildHarness();
		const service = new MatrixRoomHistoryKeyTransfer();
		service.initialize(harness.client as any);

		expect(await service.requestKeys(ROOM_ID)).toBe(true);
		expect(
			await service.requestKeys(ROOM_ID, { reason: 'about my school' })
		).toBe(true);
		// A second click on the same dialog is still held back.
		expect(
			await service.requestKeys(ROOM_ID, { reason: 'about my school' })
		).toBe(false);
		expect(harness.client.encryptAndSendToDevice).toHaveBeenCalledTimes(2);
	});

	it('sends the written reason only to devices signed by their owner', async () => {
		const harness = buildHarness();
		harness.crypto.getUserDeviceInfo.mockResolvedValue(
			new Map([
				[
					PEER,
					new Map([
						['TRUSTED', { deviceId: 'TRUSTED' }],
						['PASSWORD_ONLY', { deviceId: 'PASSWORD_ONLY' }]
					])
				]
			])
		);
		harness.crypto.getDeviceVerificationStatus.mockImplementation(
			async (_userId: string, deviceId: string) => ({
				isVerified: () => false,
				signedByOwner: deviceId === 'TRUSTED',
				// The asker has not verified the counsellor's identity.
				crossSigningVerified: false
			})
		);
		const service = new MatrixRoomHistoryKeyTransfer();
		service.initialize(harness.client as any);

		expect(
			await service.requestKeys(ROOM_ID, { reason: 'about my school' })
		).toBe(true);
		expect(harness.client.encryptAndSendToDevice).toHaveBeenCalledTimes(1);
		expect(harness.client.encryptAndSendToDevice).toHaveBeenCalledWith(
			'org.oriso.room_history_key_request',
			[{ userId: PEER, deviceId: 'TRUSTED' }],
			expect.objectContaining({ reason: 'about my school' })
		);
	});

	it('does not send a written reason when no device is signed by its owner', async () => {
		const harness = buildHarness();
		harness.crypto.getDeviceVerificationStatus.mockResolvedValue({
			isVerified: () => false,
			signedByOwner: false,
			crossSigningVerified: false
		});
		const service = new MatrixRoomHistoryKeyTransfer();
		service.initialize(harness.client as any);

		expect(
			await service.requestKeys(ROOM_ID, { reason: 'about my school' })
		).toBe(false);
		expect(harness.client.encryptAndSendToDevice).not.toHaveBeenCalled();
	});

	it('does not send a written reason to a user whose identity changed', async () => {
		const harness = buildHarness();
		harness.crypto.getUserVerificationStatus.mockResolvedValue({
			needsUserApproval: true,
			wasCrossSigningVerified: () => false,
			isCrossSigningVerified: () => false
		});
		const service = new MatrixRoomHistoryKeyTransfer();
		service.initialize(harness.client as any);

		expect(
			await service.requestKeys(ROOM_ID, { reason: 'about my school' })
		).toBe(false);
		expect(harness.client.encryptAndSendToDevice).not.toHaveBeenCalled();
		// The automatic request carries no reason and is unaffected.
		expect(await service.requestKeys(ROOM_ID)).toBe(true);
	});

	it('keeps the written reason of a request queued before the client was ready', async () => {
		const harness = buildHarness();
		const service = new MatrixRoomHistoryKeyTransfer();

		expect(
			await service.requestKeys(ROOM_ID, { reason: 'about my school' })
		).toBe(false);
		service.initialize(harness.client as any);

		await vi.waitFor(() =>
			expect(harness.client.encryptAndSendToDevice).toHaveBeenCalledWith(
				'org.oriso.room_history_key_request',
				[{ userId: PEER, deviceId: 'ASKER1' }],
				expect.objectContaining({ reason: 'about my school' })
			)
		);
	});

	it('drops a queued reason when the service is torn down', async () => {
		const harness = buildHarness();
		const service = new MatrixRoomHistoryKeyTransfer();

		await service.requestKeys(ROOM_ID, { reason: 'about my school' });
		service.detach();
		service.initialize(harness.client as any);

		await vi.waitFor(() =>
			expect(harness.client.encryptAndSendToDevice).toHaveBeenCalled()
		);
		expect(
			harness.client.encryptAndSendToDevice.mock.calls[0][2]
		).not.toHaveProperty('reason');
	});

	it('lets the person retry at once when no device received the request', async () => {
		const harness = buildHarness();
		harness.client.encryptAndSendToDevice.mockRejectedValueOnce(
			new Error('offline')
		);
		const service = new MatrixRoomHistoryKeyTransfer();
		service.initialize(harness.client as any);

		expect(
			await service.requestKeys(ROOM_ID, { reason: 'about my school' })
		).toBe(false);
		expect(
			await service.requestKeys(ROOM_ID, { reason: 'about my school' })
		).toBe(true);
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
					msgtype: 'm.bad.encrypted',
					body: '** Unable to decrypt: DecryptionError: missing room key **'
				})
			})
		).toBe(true);
		expect(
			isUndecryptedRoomEvent({
				isDecryptionFailure: () => false,
				getType: () => 'm.room.message',
				getContent: () => ({
					msgtype: 'm.bad.encrypted',
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
			isVerified: () => false,
			crossSigningVerified: true
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

	describe('incoming request device refresh', () => {
		const withRustInternals = (
			harness: ReturnType<typeof buildHarness>,
			onRefresh: () => void = () => undefined
		) => {
			const rust = {
				olmMachine: {
					updateTrackedUsers: vi.fn().mockResolvedValue(undefined),
					queryKeysForUsers: vi.fn(() => ({}))
				},
				outgoingRequestProcessor: {
					makeOutgoingRequest: vi.fn(async () => onRefresh())
				}
			};
			Object.assign(harness.crypto, rust);
			return rust;
		};
		const request = (requestId = 'request-1') =>
			event('org.oriso.room_history_key_request', PEER, {
				room_id: ROOM_ID,
				request_id: requestId,
				requester_user_id: PEER,
				requester_device_id: 'ASKER1'
			});
		const flush = () => new Promise((resolve) => setTimeout(resolve));

		it('finds a requester device discovered by the refresh', async () => {
			const harness = buildHarness();
			harness.crypto.getUserDeviceInfo.mockResolvedValue(new Map());
			withRustInternals(harness, () =>
				harness.crypto.getUserDeviceInfo.mockResolvedValue(
					new Map([
						[PEER, new Map([['ASKER1', { deviceId: 'ASKER1' }]])]
					])
				)
			);
			const service = new MatrixRoomHistoryKeyTransfer();
			service.initialize(harness.client as any);

			harness.emitToDevice(request());

			await vi.waitFor(() =>
				expect(
					harness.client.encryptAndSendToDevice
				).toHaveBeenCalledOnce()
			);
		});

		it('sends no bundle when the requester leaves during the refresh', async () => {
			const harness = buildHarness();
			withRustInternals(harness, () =>
				harness.memberships.set(PEER, member(PEER, 'leave'))
			);
			const service = new MatrixRoomHistoryKeyTransfer();
			service.initialize(harness.client as any);

			harness.emitToDevice(request());
			await flush();

			expect(harness.crypto.exportRoomKeys).not.toHaveBeenCalled();
			expect(
				harness.client.encryptAndSendToDevice
			).not.toHaveBeenCalled();
		});

		it('sends no bundle when the client is replaced during the refresh', async () => {
			const harness = buildHarness();
			const service = new MatrixRoomHistoryKeyTransfer();
			const replacement = buildHarness();
			withRustInternals(harness, () =>
				service.initialize(replacement.client as any)
			);
			service.initialize(harness.client as any);

			harness.emitToDevice(request());
			await flush();

			expect(harness.crypto.exportRoomKeys).not.toHaveBeenCalled();
			expect(
				harness.client.encryptAndSendToDevice
			).not.toHaveBeenCalled();
		});

		it('skips both refresh and export for a repeated request', async () => {
			const harness = buildHarness();
			const rust = withRustInternals(harness);
			const service = new MatrixRoomHistoryKeyTransfer();
			service.initialize(harness.client as any);

			harness.emitToDevice(request());
			await vi.waitFor(() =>
				expect(harness.crypto.exportRoomKeys).toHaveBeenCalledOnce()
			);
			harness.emitToDevice(request());
			await flush();

			expect(
				rust.outgoingRequestProcessor.makeOutgoingRequest
			).toHaveBeenCalledOnce();
			expect(harness.crypto.exportRoomKeys).toHaveBeenCalledOnce();
		});

		it('throttles a repeated request for an unknown device and a concurrent one', async () => {
			const harness = buildHarness();
			harness.crypto.getUserDeviceInfo.mockResolvedValue(new Map());
			const rust = withRustInternals(harness);
			const service = new MatrixRoomHistoryKeyTransfer();
			service.initialize(harness.client as any);

			harness.emitToDevice(request());
			harness.emitToDevice(request());
			await flush();
			harness.emitToDevice(request());
			await flush();

			expect(
				rust.outgoingRequestProcessor.makeOutgoingRequest
			).toHaveBeenCalledOnce();
		});

		it('reports a failed refresh without details and still answers', async () => {
			const harness = buildHarness();
			const rust = withRustInternals(harness);
			rust.outgoingRequestProcessor.makeOutgoingRequest.mockRejectedValue(
				new Error('sensitive refresh detail')
			);
			const diagnostic = vi.fn();
			window.addEventListener(
				MATRIX_HISTORY_KEYS_DIAGNOSTIC_EVENT,
				diagnostic
			);
			const service = new MatrixRoomHistoryKeyTransfer();
			service.initialize(harness.client as any);

			harness.emitToDevice(request());
			await vi.waitFor(() =>
				expect(
					harness.client.encryptAndSendToDevice
				).toHaveBeenCalledOnce()
			);

			const details = diagnostic.mock.calls.map(([e]) => e.detail);
			expect(details).toContainEqual({
				stage: 'device-refresh-failed',
				reason: 'key-query-rejected'
			});
			expect(JSON.stringify(details)).not.toContain('sensitive');
			window.removeEventListener(
				MATRIX_HISTORY_KEYS_DIAGNOSTIC_EVENT,
				diagnostic
			);
		});

		it('reports a skipped refresh when the Rust internals are missing', async () => {
			const harness = buildHarness();
			const diagnostic = vi.fn();
			window.addEventListener(
				MATRIX_HISTORY_KEYS_DIAGNOSTIC_EVENT,
				diagnostic
			);
			const service = new MatrixRoomHistoryKeyTransfer();
			service.initialize(harness.client as any);

			harness.emitToDevice(request());
			await vi.waitFor(() =>
				expect(
					harness.client.encryptAndSendToDevice
				).toHaveBeenCalledOnce()
			);

			expect(diagnostic.mock.calls.map(([e]) => e.detail)).toContainEqual(
				{
					stage: 'device-refresh-skipped'
				}
			);
			window.removeEventListener(
				MATRIX_HISTORY_KEYS_DIAGNOSTIC_EVENT,
				diagnostic
			);
		});
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

	describe('approval of a request from an unverified device', () => {
		const unverifiedRequest = (reason?: unknown) =>
			event('org.oriso.room_history_key_request', PEER, {
				room_id: ROOM_ID,
				request_id: 'reset-request',
				requester_user_id: PEER,
				requester_device_id: 'ASKER1',
				...(reason === undefined ? {} : { reason })
			});
		// The requesting device never counts as cross-signed; only the
		// approving device's status varies, so one cannot mask the other.
		const verificationFor =
			(approvingDeviceCrossSigned: boolean) =>
			async (_userId: string, deviceId: string) => ({
				isVerified: () => false,
				crossSigningVerified:
					deviceId === 'ASKER1' ? false : approvingDeviceCrossSigned
			});
		const setup = () => {
			const harness = buildHarness();
			harness.crypto.getDeviceVerificationStatus.mockImplementation(
				verificationFor(true)
			);
			applyDeviceIsolationMode(harness.client as any, true);
			const service = new MatrixRoomHistoryKeyTransfer();
			service.initialize(harness.client as any);
			return { harness, service };
		};

		it('keeps a request that carries a reason waiting instead of dropping it', async () => {
			const { harness, service } = setup();
			const pending = vi.fn();
			window.addEventListener(
				MATRIX_HISTORY_REQUEST_PENDING_EVENT,
				pending
			);
			harness.emitToDevice(unverifiedRequest('It was about my school'));
			await vi.waitFor(() => expect(pending).toHaveBeenCalled());
			window.removeEventListener(
				MATRIX_HISTORY_REQUEST_PENDING_EVENT,
				pending
			);

			expect(service.getPendingApprovals(ROOM_ID)).toEqual([
				expect.objectContaining({
					requestId: 'reset-request',
					requesterUserId: PEER,
					requesterDeviceId: 'ASKER1',
					reason: 'It was about my school'
				})
			]);
			expect(harness.crypto.exportRoomKeys).not.toHaveBeenCalled();
			expect(
				harness.client.encryptAndSendToDevice
			).not.toHaveBeenCalled();
		});

		it('still drops an unverified request without a reason', async () => {
			const { harness, service } = setup();
			harness.emitToDevice(unverifiedRequest());
			await vi.waitFor(() =>
				expect(
					harness.crypto.getDeviceVerificationStatus
				).toHaveBeenCalled()
			);

			expect(service.getPendingApprovals()).toEqual([]);
			expect(harness.crypto.exportRoomKeys).not.toHaveBeenCalled();
		});

		it('ignores a blank reason and caps a long one at 500 characters', async () => {
			const { harness, service } = setup();
			harness.emitToDevice(unverifiedRequest('   '));
			await vi.waitFor(() =>
				expect(
					harness.crypto.getDeviceVerificationStatus
				).toHaveBeenCalledTimes(1)
			);
			expect(service.getPendingApprovals()).toEqual([]);

			harness.emitToDevice(unverifiedRequest('x'.repeat(900)));
			await vi.waitFor(() =>
				expect(service.getPendingApprovals()).toHaveLength(1)
			);
			expect(service.getPendingApprovals()[0].reason).toHaveLength(500);
		});

		it('keeps one waiting request per requesting device, the newest', async () => {
			vi.useFakeTimers({ toFake: ['Date'] });
			try {
				const { harness, service } = setup();
				const send = (id: string) =>
					harness.emitToDevice(
						event('org.oriso.room_history_key_request', PEER, {
							room_id: ROOM_ID,
							request_id: id,
							requester_user_id: PEER,
							requester_device_id: 'ASKER1',
							reason: 'hello'
						})
					);
				send('first');
				await vi.waitFor(() =>
					expect(service.getPendingApprovals()).toHaveLength(1)
				);
				vi.setSystemTime(Date.now() + 31_000);
				send('second');
				await vi.waitFor(() =>
					expect(
						service.getPendingApprovals().map((r) => r.requestId)
					).toEqual(['second'])
				);
			} finally {
				vi.useRealTimers();
			}
		});

		it('ignores a second reason request from the same device within 30 seconds', async () => {
			const { harness, service } = setup();
			for (const id of ['first', 'second']) {
				harness.emitToDevice(
					event('org.oriso.room_history_key_request', PEER, {
						room_id: ROOM_ID,
						request_id: id,
						requester_user_id: PEER,
						requester_device_id: 'ASKER1',
						reason: 'hello'
					})
				);
			}
			await vi.waitFor(() =>
				expect(service.getPendingApprovals()).toHaveLength(1)
			);
			await new Promise((resolve) => setTimeout(resolve, 20));
			expect(
				service.getPendingApprovals().map((r) => r.requestId)
			).toEqual(['first']);
			expect(
				harness.crypto.getDeviceVerificationStatus
			).toHaveBeenCalledTimes(1);
		});

		it('does not let another device take over a waiting request id', async () => {
			const { harness, service } = setup();
			harness.emitToDevice(unverifiedRequest('It was about my school'));
			await vi.waitFor(() =>
				expect(service.getPendingApprovals()).toHaveLength(1)
			);
			harness.emitToDevice(
				event('org.oriso.room_history_key_request', PEER, {
					room_id: ROOM_ID,
					request_id: 'reset-request',
					requester_user_id: PEER,
					requester_device_id: 'OTHER',
					reason: 'take over'
				})
			);
			await new Promise((resolve) => setTimeout(resolve, 20));

			expect(service.getPendingApprovals()).toEqual([
				expect.objectContaining({
					requesterDeviceId: 'ASKER1',
					reason: 'It was about my school'
				})
			]);
		});

		it('drops requests nobody decided on after a day', async () => {
			vi.useFakeTimers({ toFake: ['Date'] });
			try {
				const { harness, service } = setup();
				harness.emitToDevice(
					unverifiedRequest('It was about my school')
				);
				await vi.waitFor(() =>
					expect(service.getPendingApprovals()).toHaveLength(1)
				);
				vi.setSystemTime(Date.now() + 25 * 60 * 60 * 1000);
				expect(service.getPendingApprovals()).toEqual([]);
			} finally {
				vi.useRealTimers();
			}
		});

		it('removes a card by itself when its deadline passes', async () => {
			vi.useFakeTimers({
				toFake: ['Date', 'setTimeout', 'clearTimeout']
			});
			try {
				const { harness, service } = setup();
				const resolved = vi.fn();
				window.addEventListener(
					MATRIX_HISTORY_REQUEST_RESOLVED_EVENT,
					resolved
				);
				harness.emitToDevice(
					unverifiedRequest('It was about my school')
				);
				await vi.waitFor(() =>
					expect(service.getPendingApprovals()).toHaveLength(1)
				);
				await vi.advanceTimersByTimeAsync(25 * 60 * 60 * 1000);
				expect(resolved).toHaveBeenCalledTimes(1);
				expect(
					(resolved.mock.calls[0][0] as CustomEvent).detail.outcome
				).toBe('dropped');
				window.removeEventListener(
					MATRIX_HISTORY_REQUEST_RESOLVED_EVENT,
					resolved
				);
			} finally {
				vi.useRealTimers();
			}
		});

		it('keeps the request when this device is not cross-signed', async () => {
			const { harness, service } = setup();
			harness.emitToDevice(unverifiedRequest('It was about my school'));
			await vi.waitFor(() =>
				expect(service.getPendingApprovals()).toHaveLength(1)
			);
			harness.crypto.getDeviceVerificationStatus.mockImplementation(
				verificationFor(false)
			);
			await expect(service.getReleaseBlock()).resolves.toBe(
				'needs-cross-signing'
			);
			await expect(service.approveRequest('reset-request')).resolves.toBe(
				false
			);
			expect(
				harness.client.encryptAndSendToDevice
			).not.toHaveBeenCalled();
			expect(service.getPendingApprovals()).toHaveLength(1);
		});

		it('sends nothing when the requester leaves during the export', async () => {
			const { harness, service } = setup();
			harness.emitToDevice(unverifiedRequest('It was about my school'));
			await vi.waitFor(() =>
				expect(service.getPendingApprovals()).toHaveLength(1)
			);
			harness.crypto.exportRoomKeys.mockImplementationOnce(async () => {
				harness.memberships.set(PEER, member(PEER, 'leave'));
				return [{ room_id: ROOM_ID }];
			});
			await expect(service.approveRequest('reset-request')).resolves.toBe(
				false
			);
			expect(
				harness.client.encryptAndSendToDevice
			).not.toHaveBeenCalled();
			expect(service.getPendingApprovals()).toEqual([]);
		});

		it('refuses an approval after the request expired', async () => {
			vi.useFakeTimers({ toFake: ['Date'] });
			try {
				const { harness, service } = setup();
				harness.emitToDevice(
					unverifiedRequest('It was about my school')
				);
				await vi.waitFor(() =>
					expect(service.getPendingApprovals()).toHaveLength(1)
				);
				vi.setSystemTime(Date.now() + 25 * 60 * 60 * 1000);
				await expect(
					service.approveRequest('reset-request')
				).resolves.toBe(false);
				expect(
					harness.client.encryptAndSendToDevice
				).not.toHaveBeenCalled();
			} finally {
				vi.useRealTimers();
			}
		});

		it('ignores a decline while the keys are being sent', async () => {
			const { harness, service } = setup();
			harness.emitToDevice(unverifiedRequest('It was about my school'));
			await vi.waitFor(() =>
				expect(service.getPendingApprovals()).toHaveLength(1)
			);
			let release: () => void = () => undefined;
			harness.client.encryptAndSendToDevice.mockImplementationOnce(
				() => new Promise<void>((resolve) => (release = resolve))
			);
			const approval = service.approveRequest('reset-request');
			await vi.waitFor(() =>
				expect(harness.client.encryptAndSendToDevice).toHaveBeenCalled()
			);

			service.declineRequest('reset-request');
			expect(service.getPendingApprovals()).toHaveLength(1);
			release();
			await expect(approval).resolves.toBe(true);
			expect(harness.client.encryptAndSendToDevice).toHaveBeenCalledTimes(
				1
			);
			expect(service.getPendingApprovals()).toEqual([]);
		});

		it('sends nothing when a newer request replaced the one being approved', async () => {
			vi.useFakeTimers({ toFake: ['Date'] });
			try {
				const { harness, service } = setup();
				const send = (id: string) =>
					harness.emitToDevice(
						event('org.oriso.room_history_key_request', PEER, {
							room_id: ROOM_ID,
							request_id: id,
							requester_user_id: PEER,
							requester_device_id: 'ASKER1',
							reason: 'hello'
						})
					);
				send('first');
				await vi.waitFor(() =>
					expect(service.getPendingApprovals()).toHaveLength(1)
				);
				let finishExport: (keys: unknown[]) => void = () => undefined;
				harness.crypto.exportRoomKeys.mockImplementationOnce(
					() =>
						new Promise<unknown[]>(
							(resolve) => (finishExport = resolve)
						)
				);
				const approval = service.approveRequest('first');
				await vi.waitFor(() =>
					expect(harness.crypto.exportRoomKeys).toHaveBeenCalled()
				);

				vi.setSystemTime(Date.now() + 31_000);
				send('second');
				await vi.waitFor(() =>
					expect(
						service.getPendingApprovals().map((a) => a.requestId)
					).toEqual(['second'])
				);
				service.declineRequest('second');
				finishExport([{ room_id: ROOM_ID, session_id: 'wanted' }]);

				await expect(approval).resolves.toBe(false);
				expect(
					harness.client.encryptAndSendToDevice
				).not.toHaveBeenCalled();
			} finally {
				vi.useRealTimers();
			}
		});

		it('throttles reason requests per sender, whatever device id they claim', async () => {
			const { harness, service } = setup();
			for (const device of ['ASKER1', 'FAKE2', 'FAKE3']) {
				harness.emitToDevice(
					event('org.oriso.room_history_key_request', PEER, {
						room_id: ROOM_ID,
						request_id: `r-${device}`,
						requester_user_id: PEER,
						requester_device_id: device,
						reason: 'hello'
					})
				);
			}
			await vi.waitFor(() =>
				expect(service.getPendingApprovals()).toHaveLength(1)
			);
			await new Promise((resolve) => setTimeout(resolve, 20));
			expect(
				harness.crypto.getDeviceVerificationStatus
			).toHaveBeenCalledTimes(1);
		});

		it('accepts a reasoned retry once the 30 second window has passed', async () => {
			vi.useFakeTimers({ toFake: ['Date'] });
			try {
				const { harness, service } = setup();
				const send = (id: string) =>
					harness.emitToDevice(
						event('org.oriso.room_history_key_request', PEER, {
							room_id: ROOM_ID,
							request_id: id,
							requester_user_id: PEER,
							requester_device_id: 'ASKER1',
							reason: 'hello'
						})
					);
				send('first');
				await vi.waitFor(() =>
					expect(service.getPendingApprovals()).toHaveLength(1)
				);
				service.declineRequest('first');
				vi.setSystemTime(Date.now() + 31_000);
				send('retry');
				await vi.waitFor(() =>
					expect(
						service.getPendingApprovals().map((a) => a.requestId)
					).toEqual(['retry'])
				);
			} finally {
				vi.useRealTimers();
			}
		});

		it('sends nothing when the client was replaced during the approval', async () => {
			const { harness, service } = setup();
			harness.emitToDevice(unverifiedRequest('It was about my school'));
			await vi.waitFor(() =>
				expect(service.getPendingApprovals()).toHaveLength(1)
			);
			let finishExport: (keys: unknown[]) => void = () => undefined;
			harness.crypto.exportRoomKeys.mockImplementationOnce(
				() => new Promise((resolve) => (finishExport = resolve))
			);
			const approval = service.approveRequest('reset-request');
			await vi.waitFor(() =>
				expect(harness.crypto.exportRoomKeys).toHaveBeenCalled()
			);

			service.detach();
			finishExport([{ room_id: ROOM_ID, session_id: 'wanted' }]);

			await expect(approval).resolves.toBe(false);
			expect(
				harness.client.encryptAndSendToDevice
			).not.toHaveBeenCalled();
		});

		it('does not let a request id from another room overwrite a waiting one', async () => {
			const { harness, service } = setup();
			harness.emitToDevice(unverifiedRequest('It was about my school'));
			await vi.waitFor(() =>
				expect(service.getPendingApprovals()).toHaveLength(1)
			);
			const original = harness.client.getRoom.getMockImplementation();
			harness.client.getRoom.mockImplementation(() =>
				original?.(ROOM_ID)
			);
			harness.emitToDevice(
				event('org.oriso.room_history_key_request', PEER, {
					room_id: '!other:matrix',
					request_id: 'reset-request',
					requester_user_id: PEER,
					requester_device_id: 'ASKER1',
					reason: 'other room'
				})
			);
			await new Promise((resolve) => setTimeout(resolve, 20));

			expect(service.getPendingApprovals()).toEqual([
				expect.objectContaining({
					roomId: ROOM_ID,
					reason: 'It was about my school'
				})
			]);
		});

		it('forgets waiting requests when the client is detached', async () => {
			const { harness, service } = setup();
			harness.emitToDevice(unverifiedRequest('It was about my school'));
			await vi.waitFor(() =>
				expect(service.getPendingApprovals()).toHaveLength(1)
			);

			const resolved = vi.fn();
			window.addEventListener(
				MATRIX_HISTORY_REQUEST_RESOLVED_EVENT,
				resolved
			);
			service.detach();
			window.removeEventListener(
				MATRIX_HISTORY_REQUEST_RESOLVED_EVENT,
				resolved
			);

			expect(service.getPendingApprovals()).toEqual([]);
			expect(resolved).toHaveBeenCalledTimes(1);
		});

		it('sends the reason along when the person asks for the history', async () => {
			const harness = buildHarness();
			const service = new MatrixRoomHistoryKeyTransfer();
			service.initialize(harness.client as any);

			await service.requestKeys(ROOM_ID, {
				reason: '  It was about my school  '
			});

			expect(harness.client.encryptAndSendToDevice).toHaveBeenCalledWith(
				'org.oriso.room_history_key_request',
				[{ userId: PEER, deviceId: 'ASKER1' }],
				expect.objectContaining({ reason: 'It was about my school' })
			);
		});

		describe("decision shared across a person's own devices", () => {
			const DECIDED = 'org.oriso.room_history_request_decided';
			const ownDevices = (harness: ReturnType<typeof buildHarness>) => {
				harness.crypto.getUserDeviceInfo.mockImplementation(
					async (users: string[]) =>
						new Map(
							users.map((user) => [
								user,
								user === ME
									? new Map([
											['NEW1', { deviceId: 'NEW1' }],
											['NEW2', { deviceId: 'NEW2' }],
											['NEW3', { deviceId: 'NEW3' }]
										])
									: new Map([
											['ASKER1', { deviceId: 'ASKER1' }]
										])
							])
						)
				);
				harness.crypto.getDeviceVerificationStatus.mockImplementation(
					async (_user: string, deviceId: string) => ({
						isVerified: () => false,
						// NEW3 is a password-only sign-in of the same account.
						signedByOwner:
							deviceId !== 'ASKER1' && deviceId !== 'NEW3',
						crossSigningVerified: deviceId !== 'ASKER1'
					})
				);
			};
			const request = (id = 'req-1', room = ROOM_ID) =>
				event('org.oriso.room_history_key_request', PEER, {
					room_id: room,
					request_id: id,
					requester_user_id: PEER,
					requester_device_id: 'ASKER1',
					reason: 'It was about my school'
				});
			const decided = (content: object = {}, sender = ME) =>
				event(DECIDED, sender, {
					room_id: ROOM_ID,
					request_id: 'req-1',
					outcome: 'approved',
					...content
				});
			const fromOwn = { sender: ME, senderDevice: 'NEW2' };
			const setup = async () => {
				const harness = buildHarness();
				ownDevices(harness);
				applyDeviceIsolationMode(harness.client as any, true);
				// The requesting device never counts as verified.
				const status = harness.crypto.getDeviceVerificationStatus;
				const base = status.getMockImplementation()!;
				status.mockImplementation(
					async (user: string, device: string) => ({
						...(await base(user, device)),
						isVerified: () =>
							device !== 'ASKER1' && device !== 'NEW3'
					})
				);
				const service = new MatrixRoomHistoryKeyTransfer();
				service.initialize(harness.client as any);
				harness.emitToDevice(request());
				await vi.waitFor(() =>
					expect(service.getPendingApprovals()).toHaveLength(1)
				);
				return { harness, service };
			};
			const settle = () =>
				new Promise((resolve) => setTimeout(resolve, 20));

			it('tells only the other devices signed by the owner, without keys or reason', async () => {
				const { harness, service } = await setup();
				harness.client.encryptAndSendToDevice.mockClear();
				service.declineRequest('req-1');
				await vi.waitFor(() =>
					expect(
						harness.client.encryptAndSendToDevice
					).toHaveBeenCalledTimes(1)
				);
				expect(
					harness.client.encryptAndSendToDevice
				).toHaveBeenCalledWith(
					DECIDED,
					[{ userId: ME, deviceId: 'NEW2' }],
					{
						room_id: ROOM_ID,
						request_id: 'req-1',
						outcome: 'declined'
					}
				);
			});

			it('tells the other devices after an approval, and not after a failed one', async () => {
				const { harness, service } = await setup();
				harness.crypto.exportRoomKeys.mockResolvedValueOnce([]);
				harness.client.encryptAndSendToDevice.mockClear();
				await expect(service.approveRequest('req-1')).resolves.toBe(
					false
				);
				await settle();
				expect(
					harness.client.encryptAndSendToDevice
				).not.toHaveBeenCalled();

				await expect(service.approveRequest('req-1')).resolves.toBe(
					true
				);
				await vi.waitFor(() =>
					expect(
						harness.client.encryptAndSendToDevice
					).toHaveBeenCalledWith(
						DECIDED,
						[{ userId: ME, deviceId: 'NEW2' }],
						{
							room_id: ROOM_ID,
							request_id: 'req-1',
							outcome: 'approved'
						}
					)
				);
			});

			it('drops the card when another device of the same person decided', async () => {
				const { harness, service } = await setup();
				const resolved = vi.fn();
				window.addEventListener(
					MATRIX_HISTORY_REQUEST_RESOLVED_EVENT,
					resolved
				);
				harness.client.encryptAndSendToDevice.mockClear();
				harness.emitToDevice(decided(), fromOwn);
				await vi.waitFor(() =>
					expect(service.getPendingApprovals()).toHaveLength(0)
				);
				window.removeEventListener(
					MATRIX_HISTORY_REQUEST_RESOLVED_EVENT,
					resolved
				);
				expect(resolved).toHaveBeenCalledTimes(1);
				expect(
					(resolved.mock.calls[0][0] as CustomEvent).detail
				).toEqual({
					roomId: ROOM_ID,
					requestId: 'req-1',
					outcome: 'dropped'
				});
				// Dropping a card never answers, so no message loops back.
				await settle();
				expect(
					harness.client.encryptAndSendToDevice
				).not.toHaveBeenCalled();
			});

			it.each([
				['unencrypted', decided(), undefined],
				[
					'from another account',
					decided({}, PEER),
					{ sender: PEER, senderDevice: 'NEW2' }
				],
				[
					'from this very device',
					decided(),
					{ sender: ME, senderDevice: 'NEW1' }
				],
				[
					'from a device the owner did not sign',
					decided(),
					{ sender: ME, senderDevice: 'NEW3' }
				],
				[
					'for another room',
					decided({ room_id: '!other:matrix' }),
					fromOwn
				],
				[
					'for an unknown request',
					decided({ request_id: 'nope' }),
					fromOwn
				],
				[
					'with an unknown outcome',
					decided({ outcome: 'maybe' }),
					fromOwn
				],
				['without a request id', decided({ request_id: '' }), fromOwn]
			])(
				'keeps the card for a message that is %s',
				async (_name, message, info) => {
					const { harness, service } = await setup();
					harness.emitToDevice(message, info as any);
					await settle();
					expect(service.getPendingApprovals()).toHaveLength(1);
				}
			);

			it('does not show a request that another device already decided', async () => {
				const harness = buildHarness();
				ownDevices(harness);
				applyDeviceIsolationMode(harness.client as any, true);
				const status = harness.crypto.getDeviceVerificationStatus;
				const base = status.getMockImplementation()!;
				status.mockImplementation(
					async (user: string, device: string) => ({
						...(await base(user, device)),
						isVerified: () =>
							device !== 'ASKER1' && device !== 'NEW3'
					})
				);
				const service = new MatrixRoomHistoryKeyTransfer();
				service.initialize(harness.client as any);
				// The decision arrives before the request has finished loading.
				harness.emitToDevice(decided(), fromOwn);
				await settle();
				harness.emitToDevice(request());
				await settle();
				expect(service.getPendingApprovals()).toHaveLength(0);
			});

			it('still tells the other devices when a newer request replaced the approved one', async () => {
				const { harness, service } = await setup();
				harness.client.encryptAndSendToDevice.mockClear();
				// While the keys are on their way, the same device asks again.
				harness.client.encryptAndSendToDevice.mockImplementationOnce(
					async () => {
						(service as any).pendingApprovals.set('req-1', {
							...(service as any).pendingApprovals.get('req-1')
						});
					}
				);
				await expect(service.approveRequest('req-1')).resolves.toBe(
					true
				);
				await vi.waitFor(() =>
					expect(
						harness.client.encryptAndSendToDevice
					).toHaveBeenCalledWith(
						DECIDED,
						[{ userId: ME, deviceId: 'NEW2' }],
						expect.objectContaining({
							request_id: 'req-1',
							outcome: 'approved'
						})
					)
				);
				// The replacement stays.
				expect(service.getPendingApprovals()).toHaveLength(1);
			});

			it('leaves a release that is already sending to finish', async () => {
				const { harness, service } = await setup();
				let release!: () => void;
				harness.crypto.exportRoomKeys.mockImplementationOnce(
					() =>
						new Promise((resolve) => {
							release = () =>
								resolve([
									{ room_id: ROOM_ID, session_id: 'wanted' }
								]);
						})
				);
				const approving = service.approveRequest('req-1');
				await vi.waitFor(() => expect(release).toBeTypeOf('function'));
				harness.emitToDevice(decided({ outcome: 'declined' }), fromOwn);
				await settle();
				release();
				await expect(approving).resolves.toBe(true);
			});
		});
	});
});
