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

	afterEach(() => {
		callManager.endCall(false);
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
		const { callLifecycleTracker } = await import('./callLifecycleTracker');
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
});
