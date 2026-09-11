import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { callManager } from './CallManager';
import { setMatrixClientServiceRef } from './matrixClientRegistry';
import { parseCallLifecycleMessage } from '../utils/callLifecycleMessage';
import { EventEmitter } from 'node:events';
import { MatrixRTCSessionEvent } from 'matrix-js-sdk/lib/matrixrtc/MatrixRTCSession';
import { apiCallState } from '../api/apiCallState';

vi.mock('../api/apiCallState', () => ({ apiCallState: vi.fn() }));

describe('call manager durable timeline', () => {
	const sendMessage = vi.fn();
	const sendEvent = vi.fn();
	const getRoom = vi.fn();
	const joinRoom = vi.fn();
	const session = Object.assign(new EventEmitter(), {
		memberships: [] as { sender: string }[]
	});
	beforeEach(() => {
		callManager.endCall(false);
		vi.resetAllMocks();
		vi.mocked(apiCallState).mockImplementation(async (call) => call);
		session.removeAllListeners();
		session.memberships = [];
		getRoom.mockReturnValue(null);
		vi.stubEnv(
			'REACT_APP_MATRIXRTC_MEMBERSHIP_READER_USER_ID',
			'@reader:example'
		);
		sendMessage.mockResolvedValue({ event_id: '$call-root' });
		sendEvent.mockResolvedValue({ event_id: '$signal' });
		const client = {
			getUserId: () => '@caller:example',
			getDeviceId: () => 'DEVICE',
			getRoom,
			joinRoom,
			matrixRTC: { getRoomSession: () => session },
			createRoom: vi
				.fn()
				.mockResolvedValue({ room_id: '!media:example' }),
			invite: vi.fn().mockResolvedValue(undefined),
			sendEvent,
			sendMessage
		};
		setMatrixClientServiceRef({ getClient: () => client } as never);
	});
	afterEach(() => {
		session.memberships = [];
		session.emit(MatrixRTCSessionEvent.MembershipsChanged);
		callManager.endCall(false);
		vi.unstubAllEnvs();
		vi.unstubAllGlobals();
	});

	it('does not join a timeline target without a persisted call binding', async () => {
		vi.mocked(apiCallState).mockResolvedValue(null);
		getRoom.mockImplementation((id: string) =>
			id === '!source:example' ? { getMyMembership: () => 'join' } : null
		);
		joinRoom.mockResolvedValue({ getMyMembership: () => 'join' });
		session.memberships = [{ sender: '@intruder:example' }];
		const result = await callManager.joinExistingCall(
			{
				callId: 'forged-call',
				roomRef: '!source:example',
				callRoomId: '!untrusted:example',
				callType: 'video',
				state: 'running',
				participants: []
			},
			true
		);
		expect(joinRoom).not.toHaveBeenCalled();
		expect(result).toBe('unavailable');
		expect(callManager.getCurrentCall()).toBeNull();
	});

	it.each(['cancel', 'account-switch'] as const)(
		'does not join after %s while backend confirmation is pending',
		async (change) => {
			const call = {
				callId: 'pending-call',
				roomRef: '!source:example',
				callRoomId: '!media:example',
				callType: 'video' as const,
				state: 'running' as const,
				participants: []
			};
			let confirm!: (value: typeof call) => void;
			vi.mocked(apiCallState).mockReturnValue(
				new Promise((resolve) => {
					confirm = resolve;
				})
			);
			getRoom.mockImplementation((id: string) =>
				id === call.roomRef ? { getMyMembership: () => 'join' } : null
			);
			const pending = callManager.joinExistingCall(call, true);
			await vi.waitFor(() => expect(apiCallState).toHaveBeenCalled());
			if (change === 'cancel') callManager.endCall(false);
			else setMatrixClientServiceRef(null);
			confirm(call);
			expect(await pending).toBe('unavailable');
			expect(joinRoom).not.toHaveBeenCalled();
			expect(callManager.getCurrentCall()).toBeNull();
		}
	);

	it('does not send an old invitation through a replacement account after root acknowledgement', async () => {
		vi.stubGlobal('alert', vi.fn());
		let acknowledgeRoot!: (value: { event_id: string }) => void;
		sendMessage.mockReturnValueOnce(
			new Promise((resolve) => {
				acknowledgeRoot = resolve;
			})
		);
		callManager.startCall('!conversation:example', true, false);
		await vi.waitFor(() => expect(sendMessage).toHaveBeenCalled());
		const replacementSend = vi
			.fn()
			.mockResolvedValue({ event_id: '$wrong-account' });
		const replacement = {
			sendEvent: replacementSend,
			getRoom: () => null,
			getUserId: () => '@replacement:example'
		};
		setMatrixClientServiceRef({ getClient: () => replacement } as never);
		acknowledgeRoot({ event_id: '$old-account-root' });
		await vi.waitFor(() => expect(callManager.getCurrentCall()).toBeNull());
		expect(replacementSend).not.toHaveBeenCalled();
	});

	it('closes the saved group card when invitation delivery fails', async () => {
		vi.stubGlobal('alert', vi.fn());
		sendEvent.mockRejectedValueOnce(new Error('synthetic invite outage'));
		callManager.startCall('!conversation:example', true, true);
		await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(2));
		expect(
			parseCallLifecycleMessage(sendMessage.mock.calls[1][1])?.state
		).toBe('missed');
	});

	it('does not invite anyone when the initial room card cannot be saved', async () => {
		const alert = vi.fn();
		vi.stubGlobal('alert', alert);
		sendMessage.mockRejectedValueOnce(new Error('synthetic write outage'));
		callManager.startCall('!conversation:example', true, false);
		await vi.waitFor(() => expect(alert).toHaveBeenCalled());
		expect(
			sendEvent.mock.calls.filter(
				([, type]) => type === 'org.oriso.call.invite'
			)
		).toHaveLength(0);
		expect(callManager.getCurrentCall()).toBeNull();
	});

	it('does not invite after cancellation while the initial card is being saved', async () => {
		let acknowledgeRoot!: (value: { event_id: string }) => void;
		sendMessage.mockReturnValueOnce(
			new Promise((resolve) => {
				acknowledgeRoot = resolve;
			})
		);
		callManager.startCall('!conversation:example', true, true);
		await vi.waitFor(() => expect(sendMessage).toHaveBeenCalled());
		callManager.endCall(false);
		acknowledgeRoot({ event_id: '$cancelled-root' });
		await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(2));
		expect(
			sendEvent.mock.calls.filter(
				([, type]) => type === 'org.oriso.call.invite'
			)
		).toHaveLength(0);
		expect(
			parseCallLifecycleMessage(sendMessage.mock.calls[1][1])?.state
		).toBe('missed');
	});

	it('waits for the durable room card before sending the call invitation', async () => {
		let acknowledgeRoot!: (value: { event_id: string }) => void;
		sendMessage.mockReturnValueOnce(
			new Promise((resolve) => {
				acknowledgeRoot = resolve;
			})
		);
		callManager.startCall('!conversation:example', true, false);
		await vi.waitFor(() => expect(sendMessage).toHaveBeenCalled());
		expect(
			sendEvent.mock.calls.filter(
				([, type]) => type === 'org.oriso.call.invite'
			)
		).toHaveLength(0);
		acknowledgeRoot({ event_id: '$durable-root' });
		await vi.waitFor(() =>
			expect(
				sendEvent.mock.calls.filter(
					([, type]) => type === 'org.oriso.call.invite'
				)
			).toHaveLength(1)
		);
	});

	it('joins the existing encrypted media room from a durable call without another invitation', async () => {
		const source = { getMyMembership: () => 'join' };
		const media = {
			getMyMembership: () => 'join',
			hasEncryptionStateEvent: () => true
		};
		getRoom.mockImplementation((id: string) =>
			id === '!conversation:example' ? source : null
		);
		joinRoom.mockImplementation(async () => {
			getRoom.mockImplementation((id: string) =>
				id === '!conversation:example' ? source : media
			);
			return media;
		});
		session.memberships = [{ sender: '@receiver:example' }];
		const result = await callManager.joinExistingCall(
			{
				callId: 'existing-call',
				roomRef: '!conversation:example',
				callRoomId: '!media:example',
				callType: 'video',
				state: 'running',
				participants: []
			},
			true
		);
		expect(result).toBe('joined');
		expect(joinRoom).toHaveBeenCalledWith('!media:example');
		expect(callManager.getCurrentCall()).toMatchObject({
			callId: 'existing-call',
			roomId: '!media:example',
			signalRoomId: '!conversation:example',
			state: 'connecting',
			isGroup: true
		});
		expect(sendEvent).not.toHaveBeenCalled();
		expect(sendMessage).not.toHaveBeenCalled();
	});

	it('does not replace a newer incoming call when an older timeline join finishes', async () => {
		const source = { getMyMembership: () => 'join' };
		const media = {
			getMyMembership: () => 'leave',
			hasEncryptionStateEvent: () => true
		};
		getRoom.mockImplementation((id: string) =>
			id === '!conversation:example' ? source : media
		);
		let resolveRoom!: (room: typeof media) => void;
		joinRoom.mockReturnValue(
			new Promise((resolve) => {
				resolveRoom = resolve;
			})
		);
		session.memberships = [{ sender: '@receiver:example' }];
		const pending = callManager.joinExistingCall(
			{
				callId: 'old-call',
				roomRef: '!conversation:example',
				callRoomId: '!media:example',
				callType: 'video',
				state: 'running',
				participants: []
			},
			true
		);
		callManager.receiveCall(
			'!new-media:example',
			true,
			'new-call',
			'@caller:example',
			false,
			'!new-conversation:example',
			true
		);
		resolveRoom(media);
		expect(await pending).toBe('unavailable');
		expect(callManager.getCurrentCall()?.callId).toBe('new-call');
	});

	it('does not open a call if source membership is revoked while joining', async () => {
		let membership = 'join';
		const source = { getMyMembership: () => membership };
		const media = {
			getMyMembership: () => 'join',
			hasEncryptionStateEvent: () => true
		};
		getRoom.mockImplementation((id: string) =>
			id === '!conversation:example' ? source : null
		);
		joinRoom.mockImplementation(async () => {
			membership = 'leave';
			getRoom.mockImplementation((id: string) =>
				id === '!conversation:example' ? source : media
			);
			return media;
		});
		session.memberships = [{ sender: '@receiver:example' }];
		const result = await callManager.joinExistingCall(
			{
				callId: 'revoked-call',
				roomRef: '!conversation:example',
				callRoomId: '!media:example',
				callType: 'video',
				state: 'running',
				participants: []
			},
			true
		);
		expect(result).toBe('unavailable');
		expect(callManager.getCurrentCall()).toBeNull();
	});

	it('notifies the caller when the receiver declines a one-to-one Element call', () => {
		callManager.receiveCall(
			'!media:example',
			true,
			'declined-call',
			'@caller:example',
			false,
			'!conversation:example',
			true
		);
		callManager.rejectCall();
		expect(callManager.getCurrentCall()).toBeNull();
		expect(sendEvent).toHaveBeenCalledWith(
			'!conversation:example',
			'org.oriso.call.hangup',
			expect.objectContaining({
				call_id: 'declined-call',
				reason: 'user_rejected'
			})
		);
	});

	it('declines a group invitation locally without hanging up the room call', () => {
		callManager.receiveCall(
			'!media:example',
			true,
			'group-call',
			'@caller:example',
			true,
			'!conversation:example',
			true
		);
		callManager.rejectCall();
		expect(callManager.getCurrentCall()).toBeNull();
		expect(sendEvent).not.toHaveBeenCalled();
	});

	it('keeps a group call running after local leave and ends it only after the last membership leaves', async () => {
		getRoom.mockImplementation((roomId: string) =>
			roomId === '!media:example'
				? {
						getMember: (userId: string) => ({ name: userId })
					}
				: null
		);
		callManager.startCall('!conversation:example', true, true);
		await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1));
		session.memberships = [
			{ sender: '@caller:example' },
			{ sender: '@receiver:example' }
		];
		session.emit(MatrixRTCSessionEvent.MembershipsChanged);
		await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(2));
		callManager.leaveCall();
		session.memberships = [{ sender: '@receiver:example' }];
		session.emit(MatrixRTCSessionEvent.MembershipsChanged);
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(sendMessage).toHaveBeenCalledTimes(2);
		expect(
			parseCallLifecycleMessage(sendMessage.mock.calls[1][1])?.state
		).toBe('running');
		session.memberships = [];
		session.emit(MatrixRTCSessionEvent.MembershipsChanged);
		await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(3));
		const ended = parseCallLifecycleMessage(sendMessage.mock.calls[2][1]);
		expect(ended).toMatchObject({
			state: 'ended',
			durationSeconds: expect.any(Number)
		});
		expect(ended?.participants.map(({ userId }) => userId)).toEqual([
			'@caller:example',
			'@receiver:example'
		]);
		expect(
			session.listenerCount(MatrixRTCSessionEvent.MembershipsChanged)
		).toBe(0);
	});
	it('writes an encrypted-capable room message when an outgoing invite is sent', async () => {
		callManager.startCall('!conversation:example', true, false);
		await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1));
		expect(sendMessage.mock.calls[0][0]).toBe('!conversation:example');
		expect(
			parseCallLifecycleMessage(sendMessage.mock.calls[0][1])
		).toMatchObject({
			callId: callManager.getCurrentCall()?.callId,
			callRoomId: '!media:example',
			state: 'running'
		});
	});
	it('never publishes an old call through a replacement login client', async () => {
		getRoom.mockReturnValue({
			getMember: (userId: string) => ({ name: userId })
		});
		callManager.startCall('!conversation:example', true, true);
		await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1));
		const replacementSend = vi
			.fn()
			.mockResolvedValue({ event_id: '$wrong-account' });
		setMatrixClientServiceRef({
			getClient: () => ({ sendMessage: replacementSend })
		} as never);
		session.memberships = [{ sender: '@receiver:example' }];
		session.emit(MatrixRTCSessionEvent.MembershipsChanged);
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(replacementSend).not.toHaveBeenCalled();
		expect(sendMessage).toHaveBeenCalledTimes(1);
		expect(
			session.listenerCount(MatrixRTCSessionEvent.MembershipsChanged)
		).toBe(0);
	});

	it('resolves an unanswered outgoing call using an edit of the original message', async () => {
		callManager.startCall('!conversation:example', true, false);
		await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1));
		callManager.endCall();
		await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(2));
		expect(sendMessage.mock.calls[1][1]['m.relates_to']).toEqual({
			rel_type: 'm.replace',
			event_id: '$call-root'
		});
		expect(
			parseCallLifecycleMessage(sendMessage.mock.calls[1][1])?.state
		).toBe('missed');
	});
});
