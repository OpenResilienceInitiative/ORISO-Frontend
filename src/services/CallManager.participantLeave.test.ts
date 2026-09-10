import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { callManager } from './CallManager';
import { setMatrixClientServiceRef } from './matrixClientRegistry';

const CALL_ROOM = '!call:oriso.example';
const SIGNAL_ROOM = '!group:oriso.example';

describe('Element Call participant leave', () => {
	const sendEvent = vi.fn().mockResolvedValue({});
	const createRoom = vi.fn();

	beforeEach(() => {
		sendEvent.mockClear();
		createRoom.mockClear();
		setMatrixClientServiceRef({
			getClient: () => ({ sendEvent, createRoom })
		} as never);
	});

	afterEach(() => {
		callManager.endCall(false);
	});

	it('keeps the group-call room available after the local participant leaves', () => {
		callManager.receiveCall(
			CALL_ROOM,
			false,
			'group-call',
			'@patty:oriso.example',
			true,
			SIGNAL_ROOM,
			true
		);

		callManager.leaveCall();

		expect(callManager.getCurrentCall()).toEqual(
			expect.objectContaining({
				callId: 'group-call',
				roomId: CALL_ROOM,
				state: 'left'
			})
		);
		expect(callManager.hasActiveCall()).toBe(false);
		expect(sendEvent).not.toHaveBeenCalled();
	});

	it('rejoins that same group-call room instead of creating a new call', () => {
		callManager.receiveCall(
			CALL_ROOM,
			false,
			'group-call',
			'@patty:oriso.example',
			true,
			SIGNAL_ROOM,
			true
		);
		callManager.leaveCall();

		callManager.startCall(SIGNAL_ROOM, false, true);

		expect(callManager.getCurrentCall()).toEqual(
			expect.objectContaining({
				callId: 'group-call',
				roomId: CALL_ROOM,
				state: 'connecting'
			})
		);
		expect(createRoom).not.toHaveBeenCalled();
		expect(sendEvent).not.toHaveBeenCalled();
	});

	it('replaces left metadata when starting a group call in a different room', async () => {
		const invite = vi.fn().mockResolvedValue(undefined);
		createRoom.mockResolvedValue({
			room_id: '!replacement-call:oriso.example'
		});
		vi.stubEnv(
			'REACT_APP_MATRIXRTC_MEMBERSHIP_READER_USER_ID',
			'@matrixrtc-auth:oriso.example'
		);
		setMatrixClientServiceRef({
			getClient: () => ({
				sendEvent,
				createRoom,
				invite,
				getUserId: () => '@patty:oriso.example',
				getRoom: () => null
			})
		} as never);
		callManager.receiveCall(
			CALL_ROOM,
			false,
			'group-call',
			'@patty:oriso.example',
			true,
			SIGNAL_ROOM,
			true
		);
		callManager.leaveCall();

		callManager.startCall('!different-group:oriso.example', true, true);

		await vi.waitFor(() =>
			expect(callManager.getCurrentCall()).toEqual(
				expect.objectContaining({
					roomId: '!replacement-call:oriso.example',
					signalRoomId: '!different-group:oriso.example',
					state: 'connecting'
				})
			)
		);
		expect(callManager.getCurrentCall()?.callId).not.toBe('group-call');
		expect(createRoom).toHaveBeenCalledTimes(1);
		vi.unstubAllEnvs();
	});

	it('accepts a different incoming call after the participant left a group call', () => {
		callManager.receiveCall(
			CALL_ROOM,
			false,
			'group-call',
			'@patty:oriso.example',
			true,
			SIGNAL_ROOM,
			true
		);
		callManager.leaveCall();

		callManager.receiveCall(
			'!other-call:oriso.example',
			true,
			'other-call',
			'@jacqueline:oriso.example',
			false,
			'!other-signal:oriso.example',
			true
		);

		expect(callManager.getCurrentCall()).toEqual(
			expect.objectContaining({
				callId: 'other-call',
				roomId: '!other-call:oriso.example',
				state: 'ringing'
			})
		);
	});

	it('does not notify the room when a group Element Call is ended directly', () => {
		callManager.receiveCall(
			CALL_ROOM,
			false,
			'group-call',
			'@patty:oriso.example',
			true,
			SIGNAL_ROOM,
			true
		);

		callManager.endCall();

		expect(callManager.getCurrentCall()).toBeNull();
		expect(sendEvent).not.toHaveBeenCalled();
	});

	it('still notifies the remote participant when a one-to-one call is left', () => {
		callManager.receiveCall(
			CALL_ROOM,
			false,
			'one-to-one-call',
			'@patty:oriso.example',
			false,
			SIGNAL_ROOM,
			true
		);

		callManager.leaveCall();

		expect(sendEvent).toHaveBeenCalledWith(
			SIGNAL_ROOM,
			'org.oriso.call.hangup',
			expect.objectContaining({ call_id: 'one-to-one-call' })
		);
	});

	it('joins an existing Element Call room without creating another', () => {
		callManager.joinExistingCall(CALL_ROOM, true, {
			callId: 'running-call',
			signalRoomId: SIGNAL_ROOM
		});

		expect(callManager.getCurrentCall()).toEqual(
			expect.objectContaining({
				callId: 'running-call',
				roomId: CALL_ROOM,
				elementCallRoomId: CALL_ROOM,
				signalRoomId: SIGNAL_ROOM,
				state: 'connecting',
				isVideo: true
			})
		);
		expect(createRoom).not.toHaveBeenCalled();
		expect(sendEvent).not.toHaveBeenCalled();
	});

	it('answers a ringing call for the same room instead of starting a new one', () => {
		callManager.receiveCall(
			CALL_ROOM,
			true,
			'incoming-call',
			'@patty:oriso.example',
			true,
			SIGNAL_ROOM,
			true
		);

		callManager.joinExistingCall(CALL_ROOM, true, {
			callId: 'incoming-call',
			signalRoomId: SIGNAL_ROOM
		});

		expect(callManager.getCurrentCall()).toEqual(
			expect.objectContaining({
				callId: 'incoming-call',
				roomId: CALL_ROOM,
				state: 'connecting'
			})
		);
		expect(createRoom).not.toHaveBeenCalled();
	});
});
