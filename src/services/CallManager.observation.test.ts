import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';

import { callManager } from './CallManager';
import { callLifecycleTracker } from './callLifecycleTracker';
import { setMatrixClientServiceRef } from './matrixClientRegistry';
import {
	callEventListeners,
	EVENT_SESSION_TEARDOWN
} from '../utils/eventHandler';

const { register, end } = vi.hoisted(() => ({
	register: vi.fn(),
	end: vi.fn()
}));
vi.mock('../api/apiCallObservation', () => ({
	apiRegisterCallObservation: register,
	apiEndCallObservation: end
}));

const SOURCE = '!group:oriso.example';
const OTHER_SOURCE = '!other-group:oriso.example';
const ROOM = '!call:oriso.example';

describe('call observation across sign-out', () => {
	const createRoom = vi.fn();
	const sendEvent = vi.fn();
	let userId = '@caller:oriso.example';

	beforeEach(() => {
		callManager.endCall(false);
		userId = '@caller:oriso.example';
		vi.resetAllMocks();
		register.mockResolvedValue({});
		end.mockResolvedValue({});
		vi.stubEnv(
			'REACT_APP_MATRIXRTC_MEMBERSHIP_READER_USER_ID',
			'@reader:oriso.example'
		);
		createRoom.mockResolvedValue({ room_id: ROOM });
		const client = {
			createRoom,
			sendEvent,
			sendMessage: vi.fn().mockResolvedValue({ event_id: '$root' }),
			invite: vi.fn().mockResolvedValue(undefined),
			leave: vi.fn().mockResolvedValue(undefined),
			forget: vi.fn().mockResolvedValue(undefined),
			getUserId: () => userId,
			getDeviceId: () => 'CALLER',
			getRoom: () => null
		};
		setMatrixClientServiceRef({ getClient: () => client } as never);
	});

	afterEach(async () => {
		callManager.endCall(false);
		// A superseded call's observation outlives endCall; clear it so it
		// cannot block the next test's fallback.
		await callEventListeners(EVENT_SESSION_TEARDOWN);
		vi.restoreAllMocks();
		vi.useRealTimers();
		vi.unstubAllEnvs();
	});

	it('registers a started group call once', async () => {
		sendEvent.mockResolvedValue({ event_id: '$invite' });
		callManager.startCall(SOURCE, true, true);
		await vi.waitFor(() => expect(register).toHaveBeenCalledTimes(1));
		expect(register.mock.calls[0][0]).toMatchObject({
			sourceRoomId: SOURCE,
			callRoomId: ROOM,
			video: true
		});
	});

	it('does not register a call whose invite is acknowledged after sign-out', async () => {
		let acknowledge!: (value: unknown) => void;
		sendEvent.mockReturnValue(
			new Promise((resolve) => {
				acknowledge = resolve;
			})
		);
		callManager.startCall(SOURCE, true, true);
		await vi.waitFor(() => expect(sendEvent).toHaveBeenCalled());
		await callEventListeners(EVENT_SESSION_TEARDOWN);
		acknowledge({ event_id: '$late' });
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(register).not.toHaveBeenCalled();
	});

	it('does not observe a superseded start that nobody joined', async () => {
		let acknowledge!: (value: unknown) => void;
		sendEvent.mockReturnValue(
			new Promise((resolve) => {
				acknowledge = resolve;
			})
		);
		callManager.startCall(SOURCE, true, true);
		await vi.waitFor(() => expect(sendEvent).toHaveBeenCalled());
		callManager.endCall(false); // supersedes the pending start
		acknowledge({ event_id: '$late' });
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(register).not.toHaveBeenCalled();
	});

	it('keeps renewing while the call runs and stops once it has ended', async () => {
		// Fake only the interval, and before the call starts, so the real timer is advanced.
		vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
		sendEvent.mockResolvedValue({ event_id: '$invite' });
		callManager.startCall(SOURCE, true, true);
		await vi.waitFor(() => expect(register).toHaveBeenCalledTimes(1));
		await vi.advanceTimersByTimeAsync(4 * 60 * 1000);
		await vi.waitFor(() => expect(register).toHaveBeenCalledTimes(2));
		const callId = callManager.getCurrentCall()!.callId;
		callLifecycleTracker.finish(callId);
		await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
		expect(register).toHaveBeenCalledTimes(2);
	});

	it('never renews a call as another account that signed in', async () => {
		vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
		sendEvent.mockResolvedValue({ event_id: '$invite' });
		callManager.startCall(SOURCE, true, true);
		await vi.waitFor(() => expect(register).toHaveBeenCalledTimes(1));
		userId = '@second:oriso.example'; // a different account, no teardown seen
		await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
		expect(register).toHaveBeenCalledTimes(1);
	});

	it('stops renewing after sign-out', async () => {
		vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
		sendEvent.mockResolvedValue({ event_id: '$invite' });
		callManager.startCall(SOURCE, true, true);
		await vi.waitFor(() => expect(register).toHaveBeenCalledTimes(1));
		await callEventListeners(EVENT_SESSION_TEARDOWN);
		await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
		expect(register).toHaveBeenCalledTimes(1);
	});
	it('retries a failed registration soon, not only at the next renewal', async () => {
		vi.useFakeTimers({
			toFake: [
				'setInterval',
				'clearInterval',
				'setTimeout',
				'clearTimeout'
			]
		});
		register.mockRejectedValueOnce(new Error('503'));
		sendEvent.mockResolvedValue({ event_id: '$invite' });
		callManager.startCall(SOURCE, true, true);
		await vi.advanceTimersByTimeAsync(100);
		expect(register).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(5000);
		expect(register).toHaveBeenCalledTimes(2);
		// The retry succeeded: nothing more until the renewal.
		await vi.advanceTimersByTimeAsync(60 * 1000);
		expect(register).toHaveBeenCalledTimes(2);
	});

	it('gives up retrying after two attempts and never retries a left call', async () => {
		vi.useFakeTimers({
			toFake: [
				'setInterval',
				'clearInterval',
				'setTimeout',
				'clearTimeout'
			]
		});
		register.mockRejectedValue(new Error('503'));
		sendEvent.mockResolvedValue({ event_id: '$invite' });
		callManager.startCall(SOURCE, true, true);
		await vi.advanceTimersByTimeAsync(100);
		await vi.advanceTimersByTimeAsync(5000 + 15000 + 1000);
		expect(register).toHaveBeenCalledTimes(3);
		await vi.advanceTimersByTimeAsync(60 * 1000);
		expect(register).toHaveBeenCalledTimes(3);

		register.mockClear();
		callManager.startCall(OTHER_SOURCE, true, true);
		await vi.advanceTimersByTimeAsync(100);
		expect(register).toHaveBeenCalledTimes(1);
		callManager.endCall(false);
		await vi.advanceTimersByTimeAsync(30 * 1000);
		expect(register).toHaveBeenCalledTimes(1);
	});

	it('ends the observation on the server when a call nobody joined is ended', async () => {
		sendEvent.mockResolvedValue({ event_id: '$invite' });
		callManager.startCall(SOURCE, true, true);
		await vi.waitFor(() => expect(register).toHaveBeenCalledTimes(1));
		const callId = callManager.getCurrentCall()!.callId;
		callManager.endCall(false);
		await vi.waitFor(() => expect(end).toHaveBeenCalledTimes(1));
		expect(end).toHaveBeenCalledWith({ sourceRoomId: SOURCE, callId });
	});

	it('ends the observation on the server when a call nobody joined is left', async () => {
		sendEvent.mockResolvedValue({ event_id: '$invite' });
		callManager.startCall(SOURCE, true, true);
		await vi.waitFor(() => expect(register).toHaveBeenCalledTimes(1));
		const callId = callManager.getCurrentCall()!.callId;
		callManager.leaveCall();
		await vi.waitFor(() => expect(end).toHaveBeenCalledTimes(1));
		expect(end).toHaveBeenCalledWith({ sourceRoomId: SOURCE, callId });
	});

	it('never ends the observation of an attended call, by ending or leaving', async () => {
		sendEvent.mockResolvedValue({ event_id: '$invite' });
		vi.spyOn(callLifecycleTracker, 'finishIfUnattended').mockReturnValue(
			false
		);
		callManager.startCall(SOURCE, true, true);
		await vi.waitFor(() => expect(register).toHaveBeenCalledTimes(1));
		callManager.leaveCall();
		await new Promise((resolve) => setTimeout(resolve, 20));
		callManager.startCall(OTHER_SOURCE, true, true);
		await vi.waitFor(() => expect(register).toHaveBeenCalledTimes(2));
		callManager.endCall(false);
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(end).not.toHaveBeenCalled();
	});

	/** Holds the invite for SOURCE until the test acknowledges it. */
	const holdInvite = () => {
		let acknowledge!: (value: unknown) => void;
		const held = new Promise((resolve) => {
			acknowledge = resolve;
		});
		sendEvent.mockImplementation((roomId: string) =>
			roomId === SOURCE ? held : Promise.resolve({ event_id: '$invite' })
		);
		return (value: unknown) => acknowledge(value);
	};

	/** The tracker reports the superseded call as joined and still running. */
	const treatAsAttended = () => {
		vi.spyOn(callLifecycleTracker, 'finishIfUnattended').mockReturnValue(
			false
		);
		vi.spyOn(callLifecycleTracker, 'isAttendedAndRunning').mockReturnValue(
			true
		);
	};

	it('never registers the old call after sign-out and a second account signing in', async () => {
		vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
		const acknowledge = holdInvite();
		callManager.startCall(SOURCE, true, true);
		await vi.waitFor(() => expect(sendEvent).toHaveBeenCalled());
		await callEventListeners(EVENT_SESSION_TEARDOWN);
		userId = '@second:oriso.example';
		acknowledge({ event_id: '$late' });
		await new Promise((resolve) => setTimeout(resolve, 20));
		await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
		expect(register).not.toHaveBeenCalled();
	});

	it('keeps an attended call observable when its start was superseded', async () => {
		const acknowledge = holdInvite();
		treatAsAttended();
		callManager.startCall(SOURCE, true, true);
		await vi.waitFor(() => expect(sendEvent).toHaveBeenCalled());
		callManager.endCall(false); // supersedes the pending start
		acknowledge({ event_id: '$late' });
		await vi.waitFor(() => expect(register).toHaveBeenCalledTimes(1));
		expect(register.mock.calls[0][0]).toMatchObject({
			sourceRoomId: SOURCE,
			callRoomId: ROOM
		});
	});

	it('does not observe a superseded attended call once another account is signed in', async () => {
		const acknowledge = holdInvite();
		treatAsAttended();
		callManager.startCall(SOURCE, true, true);
		await vi.waitFor(() => expect(sendEvent).toHaveBeenCalled());
		callManager.endCall(false);
		userId = '@second:oriso.example'; // no teardown seen
		acknowledge({ event_id: '$late' });
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(register).not.toHaveBeenCalled();
	});

	it('does not observe a superseded attended call after sign-out, even for the same account', async () => {
		const acknowledge = holdInvite();
		treatAsAttended();
		callManager.startCall(SOURCE, true, true);
		await vi.waitFor(() => expect(sendEvent).toHaveBeenCalled());
		callManager.endCall(false);
		await callEventListeners(EVENT_SESSION_TEARDOWN); // same account signs back in
		acknowledge({ event_id: '$late' });
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(register).not.toHaveBeenCalled();
	});

	it('does not take over the observation a newer call already owns', async () => {
		const acknowledge = holdInvite();
		treatAsAttended();
		callManager.startCall(SOURCE, true, true);
		await vi.waitFor(() => expect(sendEvent).toHaveBeenCalled());
		// A second start in another room supersedes the first and is observed.
		callManager.startCall(OTHER_SOURCE, true, true);
		await vi.waitFor(() => expect(register).toHaveBeenCalledTimes(1));
		acknowledge({ event_id: '$late' });
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(register).toHaveBeenCalledTimes(1);
		expect(register.mock.calls[0][0]).toMatchObject({
			sourceRoomId: OTHER_SOURCE
		});
	});
});
