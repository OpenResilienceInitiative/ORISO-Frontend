import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';

import { callManager } from './CallManager';
import { setMatrixClientServiceRef } from './matrixClientRegistry';

const FIRST_ROOM = '!first:oriso.example';
const SECOND_ROOM = '!second:oriso.example';
const THIRD_ROOM = '!third:oriso.example';

const ring = (callId: string, room: string, isGroup = false) =>
	callManager.receiveCall(
		room,
		false,
		callId,
		'@caller:oriso.example',
		isGroup,
		room,
		true
	);

/*
 * A second call rings instead of being dropped (FE#1904, Frank 28 Oct):
 * it waits beside the running call until it is answered, declined or
 * hung up by the caller.
 */
describe('a second incoming call', () => {
	const sendEvent = vi.fn().mockResolvedValue({});

	beforeEach(() => {
		sendEvent.mockClear();
		setMatrixClientServiceRef({
			getClient: () => ({ sendEvent })
		} as never);
		ring('first', FIRST_ROOM);
		callManager.answerCall();
	});

	afterEach(() => {
		callManager.rejectWaitingCall();
		callManager.endCall(false);
	});

	it('rings beside the running call and tells the listeners', () => {
		const listener = vi.fn();
		const unsubscribe = callManager.subscribe(listener);

		ring('second', SECOND_ROOM);
		unsubscribe();

		expect(callManager.getCurrentCall()).toEqual(
			expect.objectContaining({ callId: 'first', state: 'connecting' })
		);
		expect(callManager.getWaitingCall()).toEqual(
			expect.objectContaining({
				callId: 'second',
				roomId: SECOND_ROOM,
				state: 'ringing',
				isIncoming: true
			})
		);
		expect(listener).toHaveBeenCalled();
	});

	it('does not ring the running call a second time, nor a third call', () => {
		ring('first', FIRST_ROOM);
		expect(callManager.getWaitingCall()).toBeNull();

		ring('second', SECOND_ROOM);
		ring('third', THIRD_ROOM);
		expect(callManager.getWaitingCall()?.callId).toBe('second');
	});

	it('declines only the waiting call and tells its caller', () => {
		ring('second', SECOND_ROOM);

		callManager.rejectWaitingCall();

		expect(callManager.getWaitingCall()).toBeNull();
		expect(callManager.getCurrentCall()?.callId).toBe('first');
		expect(sendEvent).toHaveBeenCalledWith(
			SECOND_ROOM,
			'org.oriso.call.hangup',
			expect.objectContaining({
				call_id: 'second',
				reason: 'user_rejected'
			})
		);
	});

	it('ends the running call and connects the waiting one on answer', () => {
		ring('second', SECOND_ROOM);

		callManager.answerWaitingCall('second');

		expect(callManager.getWaitingCall()).toBeNull();
		expect(callManager.getCurrentCall()).toEqual(
			expect.objectContaining({ callId: 'second', state: 'connecting' })
		);
		expect(sendEvent).toHaveBeenCalledWith(
			FIRST_ROOM,
			'org.oriso.call.hangup',
			expect.objectContaining({ call_id: 'first', reason: 'user_hangup' })
		);
	});

	it('still connects when the running call ended before the answer arrived', () => {
		ring('second', SECOND_ROOM);
		// The hangup handshake closes the surface, which promotes the call.
		callManager.leaveCall();

		callManager.answerWaitingCall('second');

		expect(callManager.getCurrentCall()).toEqual(
			expect.objectContaining({ callId: 'second', state: 'connecting' })
		);
	});

	it('answers nothing that is not waiting', () => {
		callManager.answerWaitingCall('unknown');

		expect(callManager.getCurrentCall()?.callId).toBe('first');
	});

	it('stops ringing when its caller hangs up, and leaves the running call alone', () => {
		ring('second', SECOND_ROOM);

		expect(callManager.endCallIfMatching('second', SECOND_ROOM)).toBe(true);

		expect(callManager.getWaitingCall()).toBeNull();
		expect(callManager.getCurrentCall()?.callId).toBe('first');
	});

	it('keeps ringing as the only call once the running call ends', () => {
		ring('second', SECOND_ROOM);

		callManager.endCallIfMatching('first', FIRST_ROOM);

		expect(callManager.getWaitingCall()).toBeNull();
		expect(callManager.getCurrentCall()).toEqual(
			expect.objectContaining({ callId: 'second', state: 'ringing' })
		);
	});

	it('keeps ringing once this browser leaves a group call', () => {
		callManager.endCall(false);
		ring('group', FIRST_ROOM, true);
		callManager.answerCall();
		ring('second', SECOND_ROOM);

		callManager.leaveCall();

		expect(callManager.getCurrentCall()).toEqual(
			expect.objectContaining({ callId: 'second', state: 'ringing' })
		);
	});
});
