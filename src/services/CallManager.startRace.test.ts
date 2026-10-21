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
	const sendMessage = vi.fn();

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
		sendMessage.mockResolvedValue({ event_id: '$call-root' });
		const client = {
			createRoom,
			sendEvent,
			sendMessage,
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
		//
		// With its OWN leave and forget: sharing the mocks let either client
		// satisfy the assertion below, so the test passed whichever account
		// discarded the room — and discarding it through the account that did
		// not create it does nothing at all, since that account is not in it.
		const otherLeave = vi.fn().mockResolvedValue(undefined);
		const otherForget = vi.fn().mockResolvedValue(undefined);
		const otherClient = {
			createRoom,
			sendEvent,
			sendMessage: vi.fn().mockResolvedValue({ event_id: '$root' }),
			invite,
			leave: otherLeave,
			forget: otherForget,
			getUserId: () => '@someone-else:oriso.example',
			getDeviceId: () => 'OTHER',
			getRoom: () => null
		};
		setMatrixClientServiceRef({ getClient: () => otherClient } as never);
		finishCreate({ room_id: ROOM });

		// Nothing is published for the previous account's call, and the room
		// goes back through the account that made it.
		await vi.waitFor(() => expect(leave).toHaveBeenCalledWith(ROOM));
		expect(forget).toHaveBeenCalledWith(ROOM);
		expect(otherLeave).not.toHaveBeenCalled();
		expect(otherForget).not.toHaveBeenCalled();
		expect(sendEvent).not.toHaveBeenCalledWith(
			SOURCE,
			'org.oriso.call.invite',
			expect.anything()
		);
		expect(callManager.getCurrentCall()).toBeNull();
	});

	it('discards the room when a write after creation fails', async () => {
		/*
		 * `createElementCallRoom` cleans up after itself, and the caller
		 * cleans up after a superseded start — but between them sits
		 * everything that happens once the room exists: the lifecycle root
		 * write and the invitation. Either can reject on a transient or a
		 * permission failure, and the catch finished the card and cleared the
		 * surface while leaving the room joined, carrying the plaintext
		 * call/source binding and the membership-reader invitation. Every
		 * retry made another one.
		 */
		createRoom.mockResolvedValue({ room_id: ROOM });
		sendMessage.mockRejectedValue(new Error('timeline write refused'));
		vi.stubGlobal('alert', vi.fn());

		callManager.startCall(SOURCE, true, true);

		await vi.waitFor(() => expect(leave).toHaveBeenCalledWith(ROOM));
		expect(forget).toHaveBeenCalledWith(ROOM);
	});

	it('discards the room when a newer start arrives during the lifecycle write', async () => {
		/*
		 * The third place a start can be overtaken, and the one the other two
		 * cleanups miss. `callLifecycleTracker.begin` is an await of its own,
		 * and a second press lands inside it easily; nothing has been
		 * published that anybody could act on while it runs, because the
		 * invitation comes after. This branch returned without discarding,
		 * leaving a joined room naming the counselling session with the
		 * call/source binding in it.
		 *
		 * A CHANGED ACCOUNT does not test this: since the tracker started
		 * refusing to write for a different account, `begin` throws there and
		 * the catch does the cleanup. It is the same-account supersession
		 * that reaches this line.
		 */
		createRoom
			.mockResolvedValueOnce({ room_id: ROOM })
			.mockResolvedValue({ room_id: '!second-call:oriso.example' });
		let finishRootWrite!: (value: { event_id: string }) => void;
		sendMessage.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					finishRootWrite = resolve;
				})
		);
		vi.stubGlobal('alert', vi.fn());

		callManager.startCall(SOURCE, true, true);
		await vi.waitFor(() => expect(finishRootWrite).toBeTypeOf('function'));

		// The same counsellor presses call again, for another conversation.
		callManager.startCall('!other:oriso.example', true, true);
		finishRootWrite({ event_id: '$call-root' });

		// The superseded call takes its room with it; the newer one keeps its own.
		await vi.waitFor(() => expect(leave).toHaveBeenCalledWith(ROOM));
		expect(forget).toHaveBeenCalledWith(ROOM);
		expect(leave).not.toHaveBeenCalledWith('!second-call:oriso.example');
	});

	it('discards the superseded room through the account that created it', async () => {
		/*
		 * The cleanup above runs precisely BECAUSE the account changed, so
		 * resolving the client from the registry hands it the replacement —
		 * which is not joined to the room the previous account made. Its
		 * `leave` and `forget` then do nothing the server will act on, and
		 * the orphan stays on the account that created it, carrying the
		 * call/source binding.
		 *
		 * The test above cannot see this: both accounts share one pair of
		 * mocks there, so either client calling `leave` satisfies it.
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

		const otherLeave = vi.fn().mockResolvedValue(undefined);
		const otherForget = vi.fn().mockResolvedValue(undefined);
		setMatrixClientServiceRef({
			getClient: () => ({
				createRoom,
				sendEvent,
				sendMessage: vi.fn().mockResolvedValue({ event_id: '$root' }),
				invite,
				leave: otherLeave,
				forget: otherForget,
				getUserId: () => '@someone-else:oriso.example',
				getDeviceId: () => 'OTHER',
				getRoom: () => null
			})
		} as never);
		finishCreate({ room_id: ROOM });

		await vi.waitFor(() => expect(leave).toHaveBeenCalledWith(ROOM));
		expect(forget).toHaveBeenCalledWith(ROOM);
		expect(otherLeave).not.toHaveBeenCalled();
		expect(otherForget).not.toHaveBeenCalled();
	});
});
