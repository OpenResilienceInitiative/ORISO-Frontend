import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { callManager } from './CallManager';
import { setMatrixClientServiceRef } from './matrixClientRegistry';

const SOURCE = '!conversation:oriso.example';
const ROOM = '!call:oriso.example';

describe('outgoing call startup ownership', () => {
	const createRoom = vi.fn();
	const sendEvent = vi.fn();
	const invite = vi.fn();

	beforeEach(() => {
		callManager.endCall(false);
		vi.resetAllMocks();
		vi.stubEnv(
			'REACT_APP_MATRIXRTC_MEMBERSHIP_READER_USER_ID',
			'@reader:oriso.example'
		);
		invite.mockResolvedValue(undefined);
		sendEvent.mockResolvedValue({ event_id: '$invite' });
		const client = {
			createRoom,
			sendEvent,
			sendMessage: vi.fn().mockResolvedValue({ event_id: '$call-root' }),
			invite,
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
});
