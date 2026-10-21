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
	const leave = vi.fn();
	const forget = vi.fn();
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
		leave.mockResolvedValue(undefined);
		forget.mockResolvedValue(undefined);
		const client = {
			getUserId: () => '@caller:example',
			getDeviceId: () => 'DEVICE',
			getRoom,
			joinRoom,
			leave,
			forget,
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

	it('joins through a refreshed login of the same account', async () => {
		/*
		 * A token refresh hands out a new client object for the same person.
		 * Comparing objects across the confirmation await read that as
		 * somebody else and refused a call that was still theirs — and the
		 * refusal was silent, a Join button that just did nothing.
		 */
		const source = { getMyMembership: () => 'join' };
		const media = {
			getMyMembership: () => 'join',
			hasEncryptionStateEvent: () => true
		};
		const call = {
			callId: 'refreshed-call',
			roomRef: '!conversation:example',
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
			id === call.roomRef ? source : null
		);
		session.memberships = [{ sender: '@receiver:example' }];

		const pending = callManager.joinExistingCall(call, true);
		await vi.waitFor(() => expect(apiCallState).toHaveBeenCalled());

		// Same account, new client — and the join has to go through it, not
		// through the client whose token has just been thrown away.
		let inMediaRoom = false;
		const refreshedJoin = vi.fn().mockImplementation(async () => {
			inMediaRoom = true;
			return media;
		});
		const refreshed = {
			getUserId: () => '@caller:example',
			getDeviceId: () => 'DEVICE',
			getRoom: (id: string) =>
				id === call.roomRef ? source : inMediaRoom ? media : null,
			joinRoom: refreshedJoin,
			leave,
			forget,
			matrixRTC: { getRoomSession: () => session },
			sendEvent,
			sendMessage
		};
		setMatrixClientServiceRef({ getClient: () => refreshed } as never);
		confirm(call);

		expect(await pending).toBe('joined');
		expect(refreshedJoin).toHaveBeenCalledWith('!media:example');
		expect(joinRoom).not.toHaveBeenCalled();
		expect(leave).not.toHaveBeenCalled();
		expect(callManager.getCurrentCall()).toMatchObject({
			callId: 'refreshed-call',
			roomId: '!media:example'
		});
	});

	it('resolves the call room on a client installed while the join was in flight', async () => {
		/*
		 * The refresh lands INSIDE `joinRoom`, so the seat is taken by the
		 * client whose token is then thrown away.
		 *
		 * The membership belongs to the account and survives that, but the
		 * replacement's room cache has not synced it — and the checks after
		 * the join all ask the client. Adopting the replacement and carrying
		 * on asked it about a room it had never heard of: the encryption
		 * assertion read that as "not encrypted" and refused a join that had
		 * succeeded, and the RTC lookup was handed the old client's room
		 * object.
		 */
		const source = { getMyMembership: () => 'join' };
		const joinedByOldClient = {
			getMyMembership: () => 'join',
			hasEncryptionStateEvent: () => true
		};
		const resolvedOnReplacement = {
			getMyMembership: () => 'join',
			hasEncryptionStateEvent: () => true
		};
		const call = {
			callId: 'mid-join-refresh',
			roomRef: '!conversation:example',
			callRoomId: '!media:example',
			callType: 'video' as const,
			state: 'running' as const,
			participants: []
		};
		getRoom.mockImplementation((id: string) =>
			id === call.roomRef ? source : null
		);
		let completeJoin!: (room: typeof joinedByOldClient) => void;
		joinRoom.mockReturnValue(
			new Promise((resolve) => {
				completeJoin = resolve;
			})
		);
		session.memberships = [{ sender: '@receiver:example' }];
		let sessionRoom: unknown;

		const pending = callManager.joinExistingCall(call, true);
		await vi.waitFor(() =>
			expect(joinRoom).toHaveBeenCalledWith('!media:example')
		);

		let synced = false;
		const refreshedJoin = vi.fn().mockImplementation(async () => {
			synced = true;
			return resolvedOnReplacement;
		});
		const refreshed = {
			getUserId: () => '@caller:example',
			getDeviceId: () => 'DEVICE',
			getRoom: (id: string) =>
				id === call.roomRef
					? source
					: synced
						? resolvedOnReplacement
						: null,
			joinRoom: refreshedJoin,
			leave,
			forget,
			matrixRTC: {
				getRoomSession: (room: unknown) => {
					sessionRoom = room;
					return session;
				}
			},
			sendEvent,
			sendMessage
		};
		setMatrixClientServiceRef({ getClient: () => refreshed } as never);
		completeJoin(joinedByOldClient);

		expect(await pending).toBe('joined');
		// Re-resolved on the client that will be used, which for a cache that
		// has not synced the room means asking the server again.
		expect(refreshedJoin).toHaveBeenCalledWith('!media:example');
		expect(sessionRoom).toBe(resolvedOnReplacement);
		// Nothing was refused, so nothing is given back.
		expect(leave).not.toHaveBeenCalled();
	});

	it('refuses the call when the account changes while the second join is in flight', async () => {
		/*
		 * The replacement join is an await of its own, and a different
		 * ACCOUNT can arrive inside it.
		 *
		 * Everything after it asks the client captured before: the source
		 * room membership, the encryption assertion, the RTC session. Those
		 * are account A's and keep answering yes long after the browser has
		 * signed in as B — so the call was installed from A's cached state
		 * and then opened by the widget on B's live client. Wherever both
		 * accounts can reach the counselling room, B was carried into A's
		 * call.
		 */
		const source = { getMyMembership: () => 'join' };
		const joinedByOldClient = {
			getMyMembership: () => 'join',
			hasEncryptionStateEvent: () => true
		};
		const call = {
			callId: 'account-swap-mid-join',
			roomRef: '!conversation:example',
			callRoomId: '!media:example',
			callType: 'video' as const,
			state: 'running' as const,
			participants: []
		};
		getRoom.mockImplementation((id: string) =>
			id === call.roomRef ? source : null
		);
		let completeFirstJoin!: (room: typeof joinedByOldClient) => void;
		joinRoom.mockReturnValue(
			new Promise((resolve) => {
				completeFirstJoin = resolve;
			})
		);
		session.memberships = [{ sender: '@receiver:example' }];

		const pending = callManager.joinExistingCall(call, true);
		await vi.waitFor(() =>
			expect(joinRoom).toHaveBeenCalledWith('!media:example')
		);

		// A same-account refresh first: this is the adoption the previous
		// round added, and it must still happen. Its join SUCCEEDS and the
		// room comes back encrypted and in session, so that nothing but the
		// account change can refuse what follows.
		let synced = false;
		let completeSecondJoin!: (room: typeof joinedByOldClient) => void;
		const refreshedJoin = vi.fn().mockReturnValue(
			new Promise<typeof joinedByOldClient>((resolve) => {
				completeSecondJoin = (room) => {
					synced = true;
					resolve(room);
				};
			})
		);
		const refreshed = {
			getUserId: () => '@caller:example',
			getDeviceId: () => 'DEVICE',
			getRoom: (id: string) =>
				id === call.roomRef
					? source
					: synced
						? joinedByOldClient
						: null,
			joinRoom: refreshedJoin,
			leave,
			forget,
			matrixRTC: { getRoomSession: () => session },
			sendEvent,
			sendMessage
		};
		setMatrixClientServiceRef({ getClient: () => refreshed } as never);
		completeFirstJoin(joinedByOldClient);
		await vi.waitFor(() =>
			expect(refreshedJoin).toHaveBeenCalledWith('!media:example')
		);

		// And now somebody else is signed in.
		const otherAccount = {
			getUserId: () => '@somebody-else:example',
			getDeviceId: () => 'OTHER',
			getRoom: () => source,
			joinRoom: vi.fn(),
			leave,
			forget,
			matrixRTC: { getRoomSession: () => session },
			sendEvent,
			sendMessage
		};
		setMatrixClientServiceRef({ getClient: () => otherAccount } as never);
		completeSecondJoin(joinedByOldClient);

		expect(await pending).toBe('unavailable');
		expect(callManager.getCurrentCall()).toBeNull();
		// The seat this attempt took is given back, as after any refusal.
		await vi.waitFor(() =>
			expect(leave).toHaveBeenCalledWith('!media:example')
		);
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
		/*
		 * And the seat goes back.
		 *
		 * Refusing to OPEN the call is not enough: the join of the media room
		 * had already gone through, so somebody whose access to the
		 * counselling session was revoked mid-join stayed a member of its
		 * call room — where the encrypted timeline and the RTC state keep
		 * arriving — for as long as nobody noticed.
		 */
		await vi.waitFor(() =>
			expect(leave).toHaveBeenCalledWith('!media:example')
		);
		expect(forget).toHaveBeenCalledWith('!media:example');
	});

	it('keeps a membership it did not take', async () => {
		// The other half: already in the call room before this attempt, so
		// there is nothing of ours to give back and leaving would throw the
		// person out of a room they were legitimately in.
		const source = { getMyMembership: () => 'join' };
		const media = {
			getMyMembership: () => 'join',
			hasEncryptionStateEvent: () => true
		};
		getRoom.mockImplementation((id: string) =>
			id === '!conversation:example' ? source : media
		);
		// Nobody is in the call any more, so the attempt is refused.
		session.memberships = [];

		const result = await callManager.joinExistingCall(
			{
				callId: 'empty-call',
				roomRef: '!conversation:example',
				callRoomId: '!media:example',
				callType: 'video',
				state: 'running',
				participants: []
			},
			true
		);

		expect(result).toBe('unavailable');
		expect(joinRoom).not.toHaveBeenCalled();
		expect(leave).not.toHaveBeenCalled();
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
		// The local user leaving IS an update now, because the card says who
		// is in the call and that answer just changed. Before live presence
		// the payload was identical and the writer deduped it away — which is
		// exactly the behaviour that left somebody who had gone listed as
		// still being there.
		await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(3));
		const afterLeave = parseCallLifecycleMessage(
			sendMessage.mock.calls[2][1]
		);
		expect(afterLeave?.state).toBe('running');
		expect(afterLeave?.present?.map(({ userId }) => userId)).toEqual([
			'@receiver:example'
		]);
		expect(afterLeave?.participants.map(({ userId }) => userId)).toEqual([
			'@caller:example',
			'@receiver:example'
		]);
		session.memberships = [];
		session.emit(MatrixRTCSessionEvent.MembershipsChanged);
		await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(4));
		const ended = parseCallLifecycleMessage(sendMessage.mock.calls[3][1]);
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
