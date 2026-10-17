import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { callManager } from './CallManager';
import { setMatrixClientServiceRef } from './matrixClientRegistry';
import { callLifecycleTracker } from './callLifecycleTracker';

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

	it('closes the card for a group call nobody joined, on the path that is actually used', () => {
		/*
		 * `GroupCallWidget.closeCallSurface` calls `leaveCall`, and the group
		 * branch of it returns before `endCall` is ever reached — so the
		 * unattended-call fix sitting in `endCall` did nothing for the case it
		 * was written for. The card stayed "running" for good, with a Join
		 * button that could only answer `unavailable`.
		 */
		const finishIfUnattended = vi.spyOn(
			callLifecycleTracker,
			'finishIfUnattended'
		);
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

		/*
		 * This end of the chain only: that LEAVING reaches the tracker with
		 * this call's id. What `finishIfUnattended` then does is pinned in
		 * `callLifecycleTracker.test.ts`, which registers a tracked call and
		 * asserts the written state — `missed` when nobody ever joined, and
		 * still `running` when somebody had. Driving the tracker from here
		 * would mean duplicating its client double for no answer the pair does
		 * not already give, and the bug this test exists for was on this side:
		 * `finishIfUnattended` sat on `endCall`, which the leave path never
		 * reaches.
		 */
		expect(finishIfUnattended).toHaveBeenCalledWith('group-call');
		finishIfUnattended.mockRestore();
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

	it('does not reopen a group call everybody has already left', async () => {
		/*
		 * Reuse exists for the call others are still in. `lifecycleFinalised`
		 * cannot see this sequence: somebody joined, so `finishIfUnattended`
		 * declined to close the card and left no flag; then THEY left and the
		 * tracker ended it. Reuse then reopened a terminal call into an empty
		 * room — no invitation, no tracker, nothing to ring — which is the
		 * same "call that can never ring" the flag was added to prevent.
		 */
		const invite = vi.fn().mockResolvedValue(undefined);
		const sendMessage = vi.fn().mockResolvedValue({ event_id: '$root' });
		/*
		 * This double has no encryption state, so the startup path gets as far
		 * as `sendGroupCallInvite` and then fails — and its failure path calls
		 * `alert`, which jsdom does not provide. Unstubbed, that lands as an
		 * unhandled rejection AFTER the test has passed, and vitest exits
		 * non-zero on a suite whose every test is green.
		 */
		vi.stubGlobal('alert', vi.fn());
		createRoom.mockResolvedValue({ room_id: '!fresh-call:oriso.example' });
		vi.stubEnv(
			'REACT_APP_MATRIXRTC_MEMBERSHIP_READER_USER_ID',
			'@matrixrtc-auth:oriso.example'
		);
		// Nobody is in the call room any more.
		const memberships: unknown[] = [];
		setMatrixClientServiceRef({
			getClient: () => ({
				sendEvent,
				sendMessage,
				createRoom,
				invite,
				getUserId: () => '@patty:oriso.example',
				getDeviceId: () => 'PATTY',
				getRoom: (id: string) => (id === CALL_ROOM ? {} : null),
				matrixRTC: { getRoomSession: () => ({ memberships }) }
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

		callManager.startCall(SIGNAL_ROOM, false, true);

		/*
		 * A fresh room for a fresh call, rather than the terminal one
		 * reopened — read off the binding the room was created with rather
		 * than off `getCurrentCall()`. This double has no encryption state,
		 * so startup goes on to fail at `sendGroupCallInvite` and clears the
		 * surface again; the room creation is the part that is durable, and
		 * reuse would never have reached it at all.
		 */
		await vi.waitFor(() => expect(createRoom).toHaveBeenCalledTimes(1));
		const binding = (
			createRoom.mock.calls[0][0].initial_state as {
				type: string;
				content: { call_id: string; source_room_id: string };
			}[]
		).find((event) => event.type === 'org.oriso.call.binding');
		expect(binding?.content.source_room_id).toBe(SIGNAL_ROOM);
		expect(binding?.content.call_id).not.toBe('group-call');
		vi.unstubAllEnvs();
		vi.unstubAllGlobals();
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
		const client = {
			sendEvent,
			sendMessage: vi.fn().mockResolvedValue({ event_id: '$call-root' }),
			createRoom,
			invite,
			getUserId: () => '@patty:oriso.example',
			getRoom: () => null
		};
		setMatrixClientServiceRef({ getClient: () => client } as never);
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

	it('ignores a matching call ID received from another conversation', () => {
		callManager.receiveCall(
			CALL_ROOM,
			true,
			'same-id',
			'@patty:oriso.example',
			false,
			SIGNAL_ROOM,
			true
		);
		expect(
			callManager.endCallIfMatching('same-id', '!unrelated:oriso.example')
		).toBe(false);
		expect(callManager.getCurrentCall()?.callId).toBe('same-id');
		expect(callManager.endCallIfMatching('same-id', SIGNAL_ROOM)).toBe(
			true
		);
		expect(callManager.getCurrentCall()).toBeNull();
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
});
