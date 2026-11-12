import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';

import {
	createClient,
	EventStatus,
	MatrixError,
	MatrixEvent,
	Room
} from 'matrix-js-sdk';

import { callManager } from './CallManager';
import { setMatrixClientServiceRef } from './matrixClientRegistry';

const SOURCE = '!conversation:oriso.example';
const ROOM = '!call:oriso.example';
const REDIAL_ROOM = '!redial:oriso.example';
const INVITE = 'org.oriso.call.invite';

describe('encrypted outgoing ring retry', () => {
	const createRoom = vi.fn();
	const sendEvent = vi.fn();
	const resendEvent = vi.fn();
	const cancelPendingEvent = vi.fn();
	const getRoom = vi.fn();
	const invite = vi.fn();
	const getCapabilities = vi.fn();
	const getStateEvent = vi.fn();
	const leave = vi.fn();
	const forget = vi.fn();
	const sendMessage = vi.fn();

	beforeEach(() => {
		callManager.endCall(false);
		vi.resetAllMocks();
		vi.stubEnv(
			'REACT_APP_MATRIXRTC_MEMBERSHIP_READER_USER_ID',
			'@reader:oriso.example'
		);
		invite.mockResolvedValue(undefined);
		getCapabilities.mockResolvedValue({
			'm.room_versions': { default: '12' }
		});
		getStateEvent.mockResolvedValue({ membership: 'invite' });
		sendEvent.mockResolvedValue({ event_id: '$invite' });
		resendEvent.mockResolvedValue({ event_id: '$same-invite' });
		cancelPendingEvent.mockImplementation((event: MatrixEvent) =>
			event.setStatus(EventStatus.CANCELLED)
		);
		getRoom.mockReturnValue(null);
		leave.mockResolvedValue(undefined);
		forget.mockResolvedValue(undefined);
		sendMessage.mockResolvedValue({ event_id: '$call-root' });
		const client = {
			createRoom,
			sendEvent,
			resendEvent,
			cancelPendingEvent,
			sendMessage,
			invite,
			getCapabilities,
			getStateEvent,
			leave,
			forget,
			getUserId: () => '@caller:oriso.example',
			getDeviceId: () => 'CALLER',
			getRoom
		};
		setMatrixClientServiceRef({ getClient: () => client } as never);
	});

	afterEach(() => {
		callManager.endCall(false);
		vi.unstubAllEnvs();
		vi.useRealTimers();
	});

	const prepareThrottledInvite = (
		retryAfterMs: number,
		alreadyEncrypted = true
	) => {
		const sourceRoom = { roomId: SOURCE } as Room;
		const alert = vi.fn();
		vi.stubGlobal('alert', alert);
		const failed = new MatrixEvent({
			event_id: '~pending-invite',
			room_id: SOURCE,
			type: INVITE
		});
		sendEvent.mockImplementationOnce((roomId, type, content) => {
			expect(roomId).toBe(SOURCE);
			expect(type).toBe(INVITE);
			failed.event.content = content;
			failed.setTxnId('redial-invite-txn');
			if (alreadyEncrypted) {
				failed.makeEncrypted(
					'm.room.encrypted',
					{ ciphertext: 'sealed' },
					'sender-key',
					'signing-key'
				);
			}
			failed.setStatus(EventStatus.NOT_SENT);
			getRoom.mockImplementation((id) =>
				id === SOURCE ? sourceRoom : null
			);
			return Promise.reject(
				new MatrixError(
					{
						errcode: 'M_LIMIT_EXCEEDED',
						retry_after_ms: retryAfterMs
					},
					429,
					undefined,
					failed
				)
			);
		});
		return { sourceRoom, alert, failed };
	};

	it('retries the same encrypted invitation after a redial is rate limited', async () => {
		vi.useFakeTimers();
		createRoom
			.mockResolvedValueOnce({ room_id: ROOM })
			.mockResolvedValueOnce({ room_id: REDIAL_ROOM });
		const updates = vi.fn();
		const unsubscribe = callManager.subscribe(updates);
		try {
			callManager.startCall(SOURCE, true, false);
			await vi.advanceTimersByTimeAsync(0);
			expect(updates).toHaveBeenLastCalledWith(
				expect.objectContaining({ roomId: ROOM })
			);
			const firstCallId = callManager.getCurrentCall()?.callId;
			callManager.endCall(false);

			const { sourceRoom, alert, failed } = prepareThrottledInvite(1400);
			callManager.startCall(SOURCE, true, false);
			await vi.advanceTimersByTimeAsync(1399);
			expect(resendEvent).not.toHaveBeenCalled();
			await vi.advanceTimersByTimeAsync(1);

			expect(resendEvent).toHaveBeenCalledExactlyOnceWith(
				failed,
				sourceRoom
			);
			expect(failed.getTxnId()).toBe('redial-invite-txn');
			expect(failed.getWireContent()).toEqual({ ciphertext: 'sealed' });
			expect(failed.getContent().call_room_id).toBe(REDIAL_ROOM);
			expect(failed.getContent().call_id).not.toBe(firstCallId);
			expect(sendEvent).toHaveBeenCalledTimes(2);
			expect(createRoom).toHaveBeenCalledTimes(2);
			expect(leave).not.toHaveBeenCalled();
			expect(alert).not.toHaveBeenCalled();
			expect(updates).toHaveBeenLastCalledWith(
				expect.objectContaining({ roomId: REDIAL_ROOM })
			);
		} finally {
			unsubscribe();
			vi.unstubAllGlobals();
		}
	});

	it('uses the SDK encrypted PUT and the same transaction across two throttled responses', async () => {
		vi.useFakeTimers();
		createRoom.mockResolvedValue({ room_id: REDIAL_ROOM });
		const userId = '@caller:oriso.example';
		const requests: Array<{ path: string; body: unknown }> = [];
		const sdk = createClient({
			baseUrl: 'https://matrix.oriso.example',
			accessToken: 'synthetic-test-token',
			userId,
			deviceId: 'CALLER',
			fetchFn: async (url, request) => {
				expect(request?.method).toBe('PUT');
				const path = new URL(String(url)).pathname;
				expect(path).toMatch(/\/send\/m\.room\.encrypted\/[^/]+$/);
				requests.push({ path, body: request?.body });
				if (requests.length === 1) {
					return Response.json(
						{ errcode: 'M_LIMIT_EXCEEDED', retry_after_ms: 5000 },
						{ status: 429, headers: { 'Retry-After': '2' } }
					);
				}
				if (requests.length === 2) {
					return Response.json(
						{ errcode: 'M_LIMIT_EXCEEDED', retry_after_ms: 1400 },
						{ status: 429 }
					);
				}
				return Response.json({ event_id: '$redial-invite' });
			}
		});
		const encryptEvent = vi.fn(async (event: MatrixEvent) => {
			expect(event.getType()).toBe(INVITE);
			event.makeEncrypted(
				'm.room.encrypted',
				{ ciphertext: 'sealed-ring' },
				'sender-key',
				'signing-key'
			);
		});
		// Keep the actual SDK send/retry path and replace only the cryptographic
		// primitive so this test makes no external key or Matrix requests.
		Reflect.set(sdk, 'cryptoBackend', {
			isEncryptionEnabledInRoom: async () => true,
			encryptEvent,
			stop: () => {}
		});
		const sourceRoom = new Room(SOURCE, sdk, userId);
		sdk.store.storeRoom(sourceRoom);
		const client = {
			createRoom,
			invite,
			getCapabilities,
			getStateEvent,
			sendMessage,
			leave,
			forget,
			sendEvent: sdk.sendEvent.bind(sdk),
			resendEvent: sdk.resendEvent.bind(sdk),
			cancelPendingEvent: sdk.cancelPendingEvent.bind(sdk),
			getRoom: sdk.getRoom.bind(sdk),
			getUserId: sdk.getUserId.bind(sdk),
			getDeviceId: sdk.getDeviceId.bind(sdk)
		};
		setMatrixClientServiceRef({ getClient: () => client } as never);
		const alert = vi.fn();
		vi.stubGlobal('alert', alert);
		try {
			callManager.startCall(SOURCE, true, false);
			await vi.advanceTimersByTimeAsync(1999);
			expect(requests).toHaveLength(1);
			await vi.advanceTimersByTimeAsync(1);
			expect(requests).toHaveLength(2);
			await vi.advanceTimersByTimeAsync(1399);
			expect(requests).toHaveLength(2);
			await vi.advanceTimersByTimeAsync(1);
			expect(requests).toEqual([requests[0], requests[0], requests[0]]);
			expect(requests[0].body).toBe(
				JSON.stringify({ ciphertext: 'sealed-ring' })
			);
			expect(encryptEvent).toHaveBeenCalledTimes(1);
			expect(alert).not.toHaveBeenCalled();
			expect(callManager.getCurrentCall()?.roomId).toBe(REDIAL_ROOM);
		} finally {
			sdk.stopClient();
			vi.unstubAllGlobals();
		}
	});

	it.each(['cancelled', 'account replaced', 'client replaced'])(
		'discards the failed echo and room without ringing if startup is %s during backoff',
		async (interruption) => {
			vi.useFakeTimers();
			createRoom.mockResolvedValue({ room_id: ROOM });
			const { alert, failed } = prepareThrottledInvite(1400);
			try {
				callManager.startCall(SOURCE, true, false);
				await vi.advanceTimersByTimeAsync(0);
				const replacementSend = vi.fn();
				if (interruption === 'cancelled') {
					callManager.endCall(false);
				} else {
					setMatrixClientServiceRef({
						getClient: () => ({
							getUserId: () =>
								interruption === 'account replaced'
									? '@another:oriso.example'
									: '@caller:oriso.example',
							sendEvent: replacementSend,
							resendEvent: replacementSend
						})
					} as never);
				}
				await vi.advanceTimersByTimeAsync(1400);

				expect(resendEvent).not.toHaveBeenCalled();
				expect(replacementSend).not.toHaveBeenCalled();
				expect(cancelPendingEvent).toHaveBeenCalledExactlyOnceWith(
					failed
				);
				expect(leave).toHaveBeenCalledExactlyOnceWith(ROOM);
				expect(forget).toHaveBeenCalledExactlyOnceWith(ROOM);
				expect(callManager.getCurrentCall()).toBeNull();
				if (interruption !== 'client replaced')
					expect(alert).not.toHaveBeenCalled();
			} finally {
				vi.unstubAllGlobals();
			}
		}
	);

	it('uses only the original sender for late hangup when the account changes during a dispatched retry', async () => {
		vi.useFakeTimers();
		createRoom.mockResolvedValue({ room_id: ROOM });
		const { alert } = prepareThrottledInvite(1400);
		let acknowledge!: (response: { event_id: string }) => void;
		resendEvent.mockReturnValueOnce(
			new Promise((resolve) => {
				acknowledge = resolve;
			})
		);
		try {
			callManager.startCall(SOURCE, true, false);
			await vi.advanceTimersByTimeAsync(1400);
			expect(resendEvent).toHaveBeenCalledTimes(1);
			const oldCallId = callManager.getCurrentCall()?.callId;
			const replacementSend = vi
				.fn()
				.mockResolvedValue({ event_id: '$wrong-account' });
			setMatrixClientServiceRef({
				getClient: () => ({
					getUserId: () => '@replacement:oriso.example',
					sendEvent: replacementSend
				})
			} as never);
			acknowledge({ event_id: '$late-invite' });
			await vi.advanceTimersByTimeAsync(0);
			expect(sendEvent).toHaveBeenLastCalledWith(
				SOURCE,
				'org.oriso.call.hangup',
				expect.objectContaining({ call_id: oldCallId })
			);
			expect(replacementSend).not.toHaveBeenCalled();
			expect(alert).not.toHaveBeenCalled();
			expect(callManager.getCurrentCall()).toBeNull();
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it('does not schedule a rate-limited invitation beyond its bounded send window', async () => {
		vi.useFakeTimers();
		createRoom.mockResolvedValue({ room_id: ROOM });
		const { alert, failed } = prepareThrottledInvite(60000);
		try {
			callManager.startCall(SOURCE, true, false);
			await vi.advanceTimersByTimeAsync(0);
			expect(resendEvent).not.toHaveBeenCalled();
			expect(cancelPendingEvent).toHaveBeenCalledExactlyOnceWith(failed);
			expect(alert).toHaveBeenCalledTimes(1);
			expect(callManager.getCurrentCall()).toBeNull();
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it('does not resend a rate-limited invite that failed before encryption', async () => {
		vi.useFakeTimers();
		createRoom.mockResolvedValue({ room_id: ROOM });
		const { alert, failed } = prepareThrottledInvite(1400, false);
		try {
			callManager.startCall(SOURCE, true, false);
			await vi.advanceTimersByTimeAsync(1400);
			expect(resendEvent).not.toHaveBeenCalled();
			expect(cancelPendingEvent).toHaveBeenCalledExactlyOnceWith(failed);
			expect(alert).toHaveBeenCalledTimes(1);
			expect(callManager.getCurrentCall()).toBeNull();
		} finally {
			vi.unstubAllGlobals();
		}
	});
});
