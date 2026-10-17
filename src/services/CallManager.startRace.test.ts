import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { callManager } from './CallManager';
import { setMatrixClientServiceRef } from './matrixClientRegistry';

const SOURCE = '!conversation:oriso.example';
const ROOM = '!call:oriso.example';

describe('outgoing call startup ownership', () => {
	const createRoom = vi.fn();
	const sendEvent = vi.fn();
	const invite = vi.fn();
	const leave = vi.fn();
	const forget = vi.fn();

	beforeEach(() => {
		callManager.endCall(false);
		vi.resetAllMocks();
		vi.stubEnv(
			'REACT_APP_MATRIXRTC_MEMBERSHIP_READER_USER_ID',
			'@reader:oriso.example'
		);
		invite.mockResolvedValue(undefined);
		sendEvent.mockResolvedValue({ event_id: '$invite' });
		leave.mockResolvedValue(undefined);
		forget.mockResolvedValue(undefined);
		const client = {
			createRoom,
			sendEvent,
			sendMessage: vi.fn().mockResolvedValue({ event_id: '$call-root' }),
			invite,
			leave,
			forget,
			getUserId: () => '@caller:oriso.example',
			getDeviceId: () => 'CALLER',
			getRoom: () => null
		};
		setMatrixClientServiceRef({ getClient: () => client } as never);
	});

	afterEach(() => {
		callManager.endCall(false);
		vi.unstubAllEnvs();
	});

	it('binds the dedicated room to the same call and conversation as its invitation', async () => {
		createRoom.mockResolvedValue({ room_id: ROOM });
		callManager.startCall(SOURCE, true, true);
		await vi.waitFor(() => expect(sendEvent).toHaveBeenCalled());
		const callId = callManager.getCurrentCall()?.callId;
		expect(callId).toBeTypeOf('string');
		expect(createRoom.mock.calls[0][0].initial_state).toEqual(
			expect.arrayContaining([
				{
					type: 'org.oriso.call.binding',
					state_key: '',
					content: { call_id: callId, source_room_id: SOURCE }
				}
			])
		);
		expect(
			createRoom.mock.calls[0][0].power_level_content_override
				.state_default
		).toBe(100);
	});

	it('ignores an ended callback from a Matrix call that no longer owns the surface', () => {
		let oldState!: (state: string) => void;
		callManager.receiveCall(
			ROOM,
			true,
			'old-call',
			'@other:oriso.example',
			false,
			SOURCE,
			true
		);
		callManager.setMatrixCall({
			on: (_event: string, callback: (state: string) => void) => {
				oldState = callback;
			},
			hangup: vi.fn()
		} as never);
		callManager.endCall(false);
		callManager.receiveCall(
			ROOM,
			true,
			'new-call',
			'@other:oriso.example',
			false,
			SOURCE,
			true
		);
		oldState('ended');
		expect(callManager.getCurrentCall()?.callId).toBe('new-call');
	});

	it('cancels a late successful invitation without ending the newer call', async () => {
		let resolveInvite!: (response: { event_id: string }) => void;
		createRoom.mockResolvedValue({ room_id: ROOM });
		sendEvent.mockImplementation((_room, type) =>
			type === 'org.oriso.call.invite'
				? new Promise((resolve) => {
						resolveInvite = resolve;
					})
				: Promise.resolve({ event_id: '$hangup' })
		);
		callManager.startCall(SOURCE, true, false);
		await vi.waitFor(() => expect(resolveInvite).toBeTypeOf('function'));
		const oldCallId = callManager.getCurrentCall()?.callId;
		callManager.endCall(false);
		callManager.receiveCall(
			ROOM,
			true,
			'new-call',
			'@other:oriso.example',
			false,
			SOURCE,
			true
		);
		resolveInvite({ event_id: '$late-invite' });
		await vi.waitFor(() =>
			expect(sendEvent).toHaveBeenCalledWith(
				SOURCE,
				'org.oriso.call.hangup',
				expect.objectContaining({ call_id: oldCallId })
			)
		);
		expect(callManager.getCurrentCall()?.callId).toBe('new-call');
	});

	it('clears the outgoing call when publishing its invitation fails', async () => {
		const alert = vi.fn();
		vi.stubGlobal('alert', alert);
		createRoom.mockResolvedValue({ room_id: ROOM });
		sendEvent.mockRejectedValue(new Error('Invitation could not be sent'));
		callManager.startCall(SOURCE, true, false);
		await vi.waitFor(() => expect(alert).toHaveBeenCalledTimes(1));
		expect(callManager.getCurrentCall()).toBeNull();
		vi.unstubAllGlobals();
	});

	it('ignores a failed old invitation after another incoming call has taken over', async () => {
		const alert = vi.fn();
		vi.stubGlobal('alert', alert);
		let rejectInvite!: (error: Error) => void;
		createRoom.mockResolvedValue({ room_id: ROOM });
		sendEvent.mockReturnValue(
			new Promise((_resolve, reject) => {
				rejectInvite = reject;
			})
		);
		callManager.startCall(SOURCE, true, false);
		await vi.waitFor(() => expect(sendEvent).toHaveBeenCalled());
		callManager.endCall(false);
		callManager.receiveCall(
			'!new:oriso.example',
			true,
			'new-call',
			'@other:oriso.example',
			false,
			SOURCE,
			true
		);
		rejectInvite(new Error('Old invitation failed'));
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(callManager.getCurrentCall()?.callId).toBe('new-call');
		expect(alert).not.toHaveBeenCalled();
		vi.unstubAllGlobals();
	});

	it('does not resurrect a call cancelled while its room is being created', async () => {
		let resolveRoom!: (room: { room_id: string }) => void;
		createRoom.mockReturnValue(
			new Promise((resolve) => {
				resolveRoom = resolve;
			})
		);
		callManager.startCall(SOURCE, true, false);
		callManager.endCall(false);
		resolveRoom({ room_id: ROOM });
		await vi.waitFor(() => expect(invite).toHaveBeenCalled());
		await Promise.resolve();
		expect(callManager.getCurrentCall()).toBeNull();
		expect(sendEvent).not.toHaveBeenCalled();
	});

	it('coalesces a second start click while the first room is pending', async () => {
		let resolveRoom!: (room: { room_id: string }) => void;
		createRoom.mockReturnValue(
			new Promise((resolve) => {
				resolveRoom = resolve;
			})
		);
		callManager.startCall(SOURCE, true, false);
		callManager.startCall(SOURCE, true, false);
		resolveRoom({ room_id: ROOM });
		await vi.waitFor(() => expect(sendEvent).toHaveBeenCalled());
		expect(createRoom).toHaveBeenCalledTimes(1);
		expect(sendEvent).toHaveBeenCalledTimes(1);
	});

	it('does not replace a newer incoming call when an old room creation finishes', async () => {
		let resolveRoom!: (room: { room_id: string }) => void;
		createRoom.mockReturnValue(
			new Promise((resolve) => {
				resolveRoom = resolve;
			})
		);
		callManager.startCall(SOURCE, true, false);
		callManager.endCall(false);
		callManager.receiveCall(
			'!new:oriso.example',
			true,
			'new-call',
			'@other:oriso.example',
			false,
			SOURCE,
			true
		);
		resolveRoom({ room_id: ROOM });
		await vi.waitFor(() => expect(invite).toHaveBeenCalled());
		await Promise.resolve();
		expect(callManager.getCurrentCall()?.callId).toBe('new-call');
		expect(sendEvent).not.toHaveBeenCalled();
	});

	it('takes its room with it when a start is superseded', async () => {
		/*
		 * The ownership check runs only AFTER the room exists.
		 *
		 * By the time a superseded start returns, `createElementCallRoom` has
		 * created a dedicated room and invited the membership-reader account
		 * into it, with the call/source binding written in. Returning without
		 * cleanup left one behind for every superseded start: a persistent
		 * room naming a counselling session, never joined, never found again.
		 * A cancellation during creation is enough to make one.
		 */
		let finishCreate!: (response: { room_id: string }) => void;
		createRoom.mockImplementation(
			() =>
				new Promise((resolve) => {
					finishCreate = resolve;
				})
		);
		callManager.startCall(SOURCE, true, true);
		await vi.waitFor(() => expect(finishCreate).toBeTypeOf('function'));

		// Cancelled while the room was still being created.
		callManager.endCall(false);
		finishCreate({ room_id: ROOM });

		await vi.waitFor(() => expect(leave).toHaveBeenCalledWith(ROOM));
		expect(forget).toHaveBeenCalledWith(ROOM);
		// And no invitation was published for it.
		expect(sendEvent).not.toHaveBeenCalledWith(
			SOURCE,
			'org.oriso.call.invite',
			expect.anything()
		);
	});

	it('starts a fresh call when retrying one nobody answered', async () => {
		/*
		 * Retrying an unanswered group call used to be a dead end.
		 *
		 * `leaveCall` writes an unattended group call as `missed` and drops its
		 * tracker. The reuse branch in `startCall` then matched on the retained
		 * `left` call and returned early — so the reopened surface carried a
		 * TERMINAL card, had no tracker, and published no new invitation. Once
		 * the original invite expired nothing could bring anybody in: a call
		 * surface that could never ring.
		 *
		 * Reuse is for the call others are still in. This one has nobody in it.
		 */
		createRoom.mockResolvedValue({ room_id: ROOM });
		callManager.startCall(SOURCE, true, true);
		await vi.waitFor(() =>
			expect(callManager.getCurrentCall()?.callId).toBeTypeOf('string')
		);
		const first = callManager.getCurrentCall()?.callId;

		// Closed before anybody joined.
		callManager.leaveCall();
		expect(callManager.getCurrentCall()?.state).toBe('left');

		createRoom.mockClear();
		sendEvent.mockClear();
		callManager.startCall(SOURCE, true, true);
		await vi.waitFor(() =>
			expect(callManager.getCurrentCall()?.callId).not.toBe(first)
		);
		// A new room and a new invitation, not the terminal call reopened.
		await vi.waitFor(() => expect(createRoom).toHaveBeenCalled());
		await vi.waitFor(() =>
			expect(sendEvent).toHaveBeenCalledWith(
				SOURCE,
				'org.oriso.call.invite',
				expect.anything()
			)
		);
	});

	it('discards the room when provisioning fails after creation', async () => {
		/*
		 * The other half of the cleanup, and the half the caller cannot do.
		 *
		 * Past `createRoom` three things can throw: the membership reader may
		 * be unconfigured, its invite can reject, and `inviteSessionMembers`
		 * throws if any invite failed. Each threw before the room id was
		 * returned, so the caller's `elementCallRoomId` stayed undefined and
		 * its own cleanup could not run — every retry left another JOINED room
		 * carrying the plaintext call/source binding and a name that reads
		 * "Group call for <session room>".
		 */
		createRoom.mockResolvedValue({ room_id: ROOM });
		invite.mockRejectedValue(new Error('reader cannot be invited'));
		vi.stubGlobal('alert', vi.fn());

		callManager.startCall(SOURCE, true, true);

		await vi.waitFor(() => expect(leave).toHaveBeenCalledWith(ROOM));
		expect(forget).toHaveBeenCalledWith(ROOM);
		// And nothing was published for a call that never got off the ground.
		expect(sendEvent).not.toHaveBeenCalledWith(
			SOURCE,
			'org.oriso.call.invite',
			expect.anything()
		);
	});

	it('refuses to publish a pending start after the account changes', async () => {
		/*
		 * `teardownLocalSession` nulls the Matrix registry but does NOT clear
		 * `pendingStart`, so identity alone still said "this start is current"
		 * after a sign-out. If another account was installed before the await
		 * returned, the lifecycle card and the invitation were published by
		 * THAT account for a room the previous one created — on a shared
		 * browser where both counsellors belong to the session room, the
		 * second could publish the first one's pending call.
		 *
		 * A replacement client for the same account is a token refresh and
		 * must still be allowed; only a different account aborts.
		 */
		let finishCreate!: (response: { room_id: string }) => void;
		createRoom.mockImplementation(
			() =>
				new Promise((resolve) => {
					finishCreate = resolve;
				})
		);
		callManager.startCall(SOURCE, true, true);
		await vi.waitFor(() => expect(finishCreate).toBeTypeOf('function'));

		// Somebody else signs in while the room is still being created.
		const otherClient = {
			createRoom,
			sendEvent,
			sendMessage: vi.fn().mockResolvedValue({ event_id: '$root' }),
			invite,
			leave,
			forget,
			getUserId: () => '@someone-else:oriso.example',
			getDeviceId: () => 'OTHER',
			getRoom: () => null
		};
		setMatrixClientServiceRef({ getClient: () => otherClient } as never);
		finishCreate({ room_id: ROOM });

		// Nothing is published for the previous account's call.
		await vi.waitFor(() => expect(leave).toHaveBeenCalledWith(ROOM));
		expect(sendEvent).not.toHaveBeenCalledWith(
			SOURCE,
			'org.oriso.call.invite',
			expect.anything()
		);
		expect(callManager.getCurrentCall()).toBeNull();
	});
});
