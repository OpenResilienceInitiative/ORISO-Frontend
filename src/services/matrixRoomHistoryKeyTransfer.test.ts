// @vitest-environment oriso-jsdom
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { ClientEvent } from 'matrix-js-sdk';
import {
	MATRIX_HISTORY_KEYS_DIAGNOSTIC_EVENT,
	MATRIX_HISTORY_KEYS_IMPORTED_EVENT,
	MATRIX_HISTORY_KEYS_REQUESTED_EVENT,
	MATRIX_HISTORY_KEYS_SENT_EVENT,
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
	// Members a direct invitation brought into an existing 1:1: the backend
	// writes one org.oriso.direct_invitation_member state event per person.
	const linkInvited = new Map<string, object>();
	const room = {
		currentState: {
			getStateEvents: vi.fn((type: string, stateKey: string) =>
				type === 'org.oriso.direct_invitation_member'
					? (linkInvited.get(stateKey) ?? null)
					: null
			)
		},
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
		importRoomKeys: vi.fn().mockResolvedValue(undefined),
		// Like the SDK, this encrypts for every device it knows. The plain
		// message rides along so queueToDevice below can hand it to the
		// encryptAndSendToDevice spy the assertions use.
		encryptToDeviceMessages: vi.fn(
			async (
				eventType: string,
				devices: { userId: string; deviceId: string }[],
				payload: object
			) => ({
				eventType: 'm.room.encrypted',
				batch: devices.map(({ userId, deviceId }) => ({
					userId,
					deviceId,
					payload: { plain: { eventType, payload } }
				}))
			})
		)
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
		encryptAndSendToDevice: vi.fn().mockResolvedValue(undefined),
		queueToDevice: vi.fn(
			async (batch: {
				batch: {
					userId: string;
					deviceId: string;
					payload: { plain: { eventType: string; payload: object } };
				}[];
			}) => {
				if (batch.batch.length === 0) return;
				const { eventType, payload } = batch.batch[0].payload.plain;
				await client.encryptAndSendToDevice(
					eventType,
					batch.batch.map(({ userId, deviceId }) => ({
						userId,
						deviceId
					})),
					payload
				);
			}
		)
	};
	return {
		client,
		crypto,
		room,
		memberships,
		linkInvited,
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

/** The state event the UserService's technical admin writes for a link-invited person. */
const marker = (
	content: object = { link_id: 7, since: 1 },
	options: { sender?: string; redacted?: boolean } = {}
) => ({
	getType: () => 'org.oriso.direct_invitation_member',
	getSender: () => options.sender ?? '@matrixadm:matrix',
	getContent: () => content,
	isRedacted: () => Boolean(options.redacted)
});

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

	it.each([
		['automatic', undefined],
		['reasoned', 'about my school']
	])(
		'reserves a room before concurrent %s requests look up devices',
		async (_, reason) => {
			const harness = buildHarness();
			const service = new MatrixRoomHistoryKeyTransfer();
			service.initialize(harness.client as any);

			let releaseLookup = () => {};
			const lookup = new Promise<void>((resolve) => {
				releaseLookup = resolve;
			});
			const devices = new Map([
				[PEER, new Map([['ASKER1', { deviceId: 'ASKER1' }]])]
			]);
			harness.crypto.getUserDeviceInfo.mockImplementation(async () => {
				await lookup;
				return devices;
			});

			const requests = Array.from({ length: 3 }, () =>
				service.requestKeys(ROOM_ID, { reason })
			);
			await vi.waitFor(() =>
				expect(harness.crypto.getUserDeviceInfo).toHaveBeenCalled()
			);
			releaseLookup();

			expect(await Promise.all(requests)).toEqual([true, false, false]);
			expect(harness.crypto.getUserDeviceInfo).toHaveBeenCalledTimes(1);
			expect(harness.client.encryptAndSendToDevice).toHaveBeenCalledTimes(
				1
			);
		}
	);

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

	it('keeps a reasoned request independent of an automatic device lookup', async () => {
		const harness = buildHarness();
		const service = new MatrixRoomHistoryKeyTransfer();
		service.initialize(harness.client as any);

		let releaseLookup = () => {};
		const lookup = new Promise<void>((resolve) => {
			releaseLookup = resolve;
		});
		harness.crypto.getUserDeviceInfo.mockImplementationOnce(async () => {
			await lookup;
			return new Map([
				[PEER, new Map([['ASKER1', { deviceId: 'ASKER1' }]])]
			]);
		});
		const automatic = service.requestKeys(ROOM_ID);
		await vi.waitFor(() =>
			expect(harness.crypto.getUserDeviceInfo).toHaveBeenCalled()
		);
		const reasoned = await service.requestKeys(ROOM_ID, {
			reason: 'about my school'
		});
		releaseLookup();

		expect(reasoned).toBe(true);
		expect(await automatic).toBe(true);
		expect(harness.client.encryptAndSendToDevice).toHaveBeenCalledTimes(2);
	});

	it('drops a stale send completion after detaching and reusing the client', async () => {
		const harness = buildHarness();
		const service = new MatrixRoomHistoryKeyTransfer();
		service.initialize(harness.client as any);

		let releaseSend = () => {};
		harness.client.encryptAndSendToDevice.mockImplementationOnce(
			() =>
				new Promise<void>((resolve) => {
					releaseSend = resolve;
				})
		);
		const requested = vi.fn();
		window.addEventListener(MATRIX_HISTORY_KEYS_REQUESTED_EVENT, requested);
		try {
			const stale = service.requestKeys(ROOM_ID);
			await vi.waitFor(() =>
				expect(
					harness.client.encryptAndSendToDevice
				).toHaveBeenCalledTimes(1)
			);
			service.detach();
			service.initialize(harness.client as any);
			const fresh = await service.requestKeys(ROOM_ID, {
				reason: 'about my school'
			});
			releaseSend();

			expect(fresh).toBe(true);
			expect(await stale).toBe(false);
			expect(requested).toHaveBeenCalledTimes(1);
		} finally {
			releaseSend();
			window.removeEventListener(
				MATRIX_HISTORY_KEYS_REQUESTED_EVENT,
				requested
			);
		}
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

	it('does not send a written reason to a member who left during the trust lookups', async () => {
		const harness = buildHarness();
		harness.crypto.getDeviceVerificationStatus.mockImplementation(
			async () => {
				harness.memberships.set(PEER, member(PEER, 'leave'));
				return {
					isVerified: () => false,
					signedByOwner: true,
					crossSigningVerified: false
				};
			}
		);
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

	describe('a member invited by link into an existing 1:1 (FE#2252 CP3)', () => {
		const GUEST = '@guest:matrix';
		const diagnostics = () => {
			const stages: string[] = [];
			window.addEventListener(MATRIX_HISTORY_KEYS_DIAGNOSTIC_EVENT, (e) =>
				stages.push((e as CustomEvent).detail.stage)
			);
			return stages;
		};

		it('never receives room keys for messages from before the join', async () => {
			const harness = buildHarness();
			harness.linkInvited.set(PEER, marker());
			const stages = diagnostics();
			const service = new MatrixRoomHistoryKeyTransfer();
			service.initialize(harness.client as any);
			harness.emitToDevice(
				event('org.oriso.room_history_key_request', PEER, {
					room_id: ROOM_ID,
					request_id: 'request-1',
					requester_user_id: PEER,
					requester_device_id: 'ASKER1',
					reason: 'Ich sehe den Verlauf nicht'
				})
			);
			await vi.waitFor(() =>
				expect(stages).toContain('request-link-invited-rejected')
			);

			expect(harness.crypto.exportRoomKeys).not.toHaveBeenCalled();
			expect(
				harness.client.encryptAndSendToDevice
			).not.toHaveBeenCalled();
			expect(service.getPendingApprovals(ROOM_ID)).toEqual([]);
		});

		const requestFromPeer = () =>
			event('org.oriso.room_history_key_request', PEER, {
				room_id: ROOM_ID,
				request_id: 'request-1',
				requester_user_id: PEER,
				requester_device_id: 'ASKER1'
			});

		it.each([
			['empty content', marker({})],
			['redacted content', marker({}, { redacted: true })],
			[
				'a lifting claim from a room member, not the backend',
				marker({ revoked: true }, { sender: PEER })
			],
			[
				'a lifting claim from any sender at all',
				marker({ revoked: true })
			]
		])('still counts a mark with %s', async (_label, mark) => {
			const harness = buildHarness();
			harness.linkInvited.set(PEER, mark);
			const stages = diagnostics();
			const service = new MatrixRoomHistoryKeyTransfer();
			service.initialize(harness.client as any);
			harness.emitToDevice(requestFromPeer());
			await vi.waitFor(() =>
				expect(stages).toContain('request-link-invited-rejected')
			);

			expect(harness.crypto.exportRoomKeys).not.toHaveBeenCalled();
			expect(
				harness.client.encryptAndSendToDevice
			).not.toHaveBeenCalled();
		});

		it('still hands the history to a late-joining counsellor in the same room', async () => {
			const harness = buildHarness();
			harness.memberships.set(GUEST, member(GUEST));
			harness.linkInvited.set(GUEST, marker());
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

		it('is not released by an approval when the mark arrives while the request waits', async () => {
			const harness = buildHarness();
			harness.crypto.getDeviceVerificationStatus.mockImplementation(
				async (_userId: string, deviceId: string) => ({
					isVerified: () => false,
					crossSigningVerified: deviceId !== 'ASKER1'
				})
			);
			applyDeviceIsolationMode(harness.client as any, true);
			const service = new MatrixRoomHistoryKeyTransfer();
			service.initialize(harness.client as any);
			harness.emitToDevice(
				event('org.oriso.room_history_key_request', PEER, {
					room_id: ROOM_ID,
					request_id: 'waiting',
					requester_user_id: PEER,
					requester_device_id: 'ASKER1',
					reason: 'Neues Gerät'
				})
			);
			await vi.waitFor(() =>
				expect(service.getPendingApprovals(ROOM_ID)).toHaveLength(1)
			);
			harness.linkInvited.set(PEER, marker());

			expect(await service.approveRequest('waiting')).toBe(false);
			expect(harness.crypto.exportRoomKeys).not.toHaveBeenCalled();
			expect(
				harness.client.encryptAndSendToDevice
			).not.toHaveBeenCalled();
			expect(service.getPendingApprovals(ROOM_ID)).toEqual([]);
		});

		it('does not ask other members for earlier keys', async () => {
			const harness = buildHarness();
			harness.linkInvited.set(ME, marker());
			const service = new MatrixRoomHistoryKeyTransfer();
			service.initialize(harness.client as any);

			expect(await service.requestKeys(ROOM_ID)).toBe(false);
			expect(
				harness.client.encryptAndSendToDevice
			).not.toHaveBeenCalled();
		});

		it('does not import earlier keys an outdated client sends anyway', async () => {
			const harness = buildHarness();
			harness.linkInvited.set(ME, marker());
			const stages = diagnostics();
			const service = new MatrixRoomHistoryKeyTransfer();
			service.initialize(harness.client as any);
			harness.emitToDevice(
				event('org.oriso.room_history_key_bundle', PEER, {
					room_id: ROOM_ID,
					request_id: 'request-1',
					keys: [{ room_id: ROOM_ID, session_id: 'wanted' }]
				})
			);
			await vi.waitFor(() =>
				expect(stages).toContain('bundle-link-invited-rejected')
			);

			expect(harness.crypto.importRoomKeys).not.toHaveBeenCalled();
		});
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

		it('keeps at most five waiting requests per room and says so', async () => {
			const { harness, service } = setup();
			const senders = Array.from(
				{ length: 6 },
				(_, i) => `@s${i}:matrix`
			);
			senders.forEach((id) => harness.memberships.set(id, member(id)));
			harness.crypto.getUserDeviceInfo.mockImplementation(
				async (userIds: string[]) =>
					new Map(
						userIds.map((id) => [
							id,
							new Map([['D1', { deviceId: 'D1' }]])
						])
					)
			);
			const stages: string[] = [];
			const onDiagnostic = (e: Event) =>
				stages.push((e as CustomEvent).detail.stage);
			window.addEventListener(
				MATRIX_HISTORY_KEYS_DIAGNOSTIC_EVENT,
				onDiagnostic
			);
			try {
				senders.forEach((id, i) =>
					harness.emitToDevice(
						event('org.oriso.room_history_key_request', id, {
							room_id: ROOM_ID,
							request_id: `cap-${i}`,
							requester_user_id: id,
							requester_device_id: 'D1',
							reason: 'hello'
						})
					)
				);
				await vi.waitFor(() =>
					expect(stages).toContain('approval-queue-full')
				);
				expect(service.getPendingApprovals()).toHaveLength(5);
				expect(
					service.getPendingApprovals().map((a) => a.requestId)
				).not.toContain('cap-5');
			} finally {
				window.removeEventListener(
					MATRIX_HISTORY_KEYS_DIAGNOSTIC_EVENT,
					onDiagnostic
				);
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

		describe('checks that the approved key bundle was queued', () => {
			const watch = () => {
				const stages: string[] = [];
				const sent = vi.fn();
				const resolved = vi.fn();
				const onDiagnostic = (e: Event) =>
					stages.push((e as CustomEvent).detail.stage);
				window.addEventListener(
					MATRIX_HISTORY_KEYS_DIAGNOSTIC_EVENT,
					onDiagnostic
				);
				window.addEventListener(MATRIX_HISTORY_KEYS_SENT_EVENT, sent);
				window.addEventListener(
					MATRIX_HISTORY_REQUEST_RESOLVED_EVENT,
					resolved
				);
				return {
					stages,
					sent,
					resolved,
					stop: () => {
						window.removeEventListener(
							MATRIX_HISTORY_KEYS_DIAGNOSTIC_EVENT,
							onDiagnostic
						);
						window.removeEventListener(
							MATRIX_HISTORY_KEYS_SENT_EVENT,
							sent
						);
						window.removeEventListener(
							MATRIX_HISTORY_REQUEST_RESOLVED_EVENT,
							resolved
						);
					}
				};
			};

			it('queues the bundle for exactly the requesting device', async () => {
				const { harness, service } = setup();
				harness.emitToDevice(
					unverifiedRequest('It was about my school')
				);
				await vi.waitFor(() =>
					expect(service.getPendingApprovals()).toHaveLength(1)
				);

				await expect(
					service.approveRequest('reset-request')
				).resolves.toBe(true);
				expect(harness.client.queueToDevice).toHaveBeenCalledWith(
					expect.objectContaining({
						batch: [
							expect.objectContaining({
								userId: PEER,
								deviceId: 'ASKER1'
							})
						]
					})
				);
			});

			it('reports a failure and keeps the request when the SDK leaves the device out of the batch', async () => {
				const { harness, service } = setup();
				harness.emitToDevice(
					unverifiedRequest('It was about my school')
				);
				await vi.waitFor(() =>
					expect(service.getPendingApprovals()).toHaveLength(1)
				);
				// The SDK skips a device it does not know and still resolves.
				harness.crypto.encryptToDeviceMessages.mockResolvedValueOnce({
					eventType: 'm.room.encrypted',
					batch: []
				});
				const seen = watch();
				try {
					await expect(
						service.approveRequest('reset-request')
					).resolves.toBe(false);

					expect(seen.stages).toContain('bundle-not-queued');
					expect(seen.sent).not.toHaveBeenCalled();
					expect(seen.resolved).not.toHaveBeenCalled();
					expect(harness.client.queueToDevice).not.toHaveBeenCalled();
					expect(service.getPendingApprovals()).toEqual([
						expect.objectContaining({ requestId: 'reset-request' })
					]);
				} finally {
					seen.stop();
				}
			});

			it('reports a failure and keeps the request when queueing the bundle fails', async () => {
				const { harness, service } = setup();
				harness.emitToDevice(
					unverifiedRequest('It was about my school')
				);
				await vi.waitFor(() =>
					expect(service.getPendingApprovals()).toHaveLength(1)
				);
				harness.client.queueToDevice.mockRejectedValueOnce(
					new Error('store unavailable')
				);
				const seen = watch();
				try {
					await expect(
						service.approveRequest('reset-request')
					).resolves.toBe(false);

					expect(seen.stages).toContain('approval-failed');
					expect(seen.sent).not.toHaveBeenCalled();
					expect(seen.resolved).not.toHaveBeenCalled();
					expect(service.getPendingApprovals()).toEqual([
						expect.objectContaining({ requestId: 'reset-request' })
					]);
				} finally {
					seen.stop();
				}
			});

			it('lets the counsellor retry once the device is known', async () => {
				const { harness, service } = setup();
				harness.emitToDevice(
					unverifiedRequest('It was about my school')
				);
				await vi.waitFor(() =>
					expect(service.getPendingApprovals()).toHaveLength(1)
				);
				harness.crypto.encryptToDeviceMessages.mockResolvedValueOnce({
					eventType: 'm.room.encrypted',
					batch: []
				});

				await expect(
					service.approveRequest('reset-request')
				).resolves.toBe(false);
				await expect(
					service.approveRequest('reset-request')
				).resolves.toBe(true);
				expect(service.getPendingApprovals()).toEqual([]);
			});
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
				const diagnostic = vi.fn();
				window.addEventListener(
					MATRIX_HISTORY_KEYS_DIAGNOSTIC_EVENT,
					diagnostic
				);
				try {
					harness.emitToDevice(request());
					await vi.waitFor(() =>
						expect(
							diagnostic.mock.calls.map(([e]) => e.detail)
						).toContainEqual({ stage: 'request-decided-elsewhere' })
					);
				} finally {
					window.removeEventListener(
						MATRIX_HISTORY_KEYS_DIAGNOSTIC_EVENT,
						diagnostic
					);
				}
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

			it('does not let an already decided request replace a newer one from the same device', async () => {
				vi.useFakeTimers({ toFake: ['Date'] });
				const diagnostic = vi.fn();
				window.addEventListener(
					MATRIX_HISTORY_KEYS_DIAGNOSTIC_EVENT,
					diagnostic
				);
				try {
					const { harness, service } = await setup();
					harness.emitToDevice(
						decided({ request_id: 'req-old' }),
						fromOwn
					);
					await settle();
					// Move past the 30 second limit for requests with a reason, so the
					// late request is stopped by the decision and not by the limit.
					vi.setSystemTime(Date.now() + 31_000);
					diagnostic.mockClear();
					harness.emitToDevice(request('req-old'));
					await vi.waitFor(() =>
						expect(
							diagnostic.mock.calls.map(([e]) => e.detail)
						).toContainEqual({ stage: 'request-decided-elsewhere' })
					);
					expect(
						diagnostic.mock.calls.map(([e]) => e.detail)
					).not.toContainEqual({
						stage: 'request-handler-throttled'
					});
					expect(
						service.getPendingApprovals().map((r) => r.requestId)
					).toEqual(['req-1']);
				} finally {
					window.removeEventListener(
						MATRIX_HISTORY_KEYS_DIAGNOSTIC_EVENT,
						diagnostic
					);
					vi.useRealTimers();
				}
			});

			it('drops the card after a failed approval when another device decided meanwhile', async () => {
				const { harness, service } = await setup();
				let fail!: () => void;
				harness.crypto.exportRoomKeys.mockImplementationOnce(
					() =>
						new Promise((_resolve, reject) => {
							fail = () => reject(new Error('export failed'));
						})
				);
				const approving = service.approveRequest('req-1');
				await vi.waitFor(() => expect(fail).toBeTypeOf('function'));
				harness.emitToDevice(decided({ outcome: 'declined' }), fromOwn);
				await settle();
				expect(service.getPendingApprovals()).toHaveLength(1);
				fail();
				await expect(approving).resolves.toBe(false);
				expect(service.getPendingApprovals()).toHaveLength(0);
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
