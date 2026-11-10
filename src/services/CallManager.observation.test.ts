import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';

const { register, end } = vi.hoisted(() => ({
	register: vi.fn(),
	end: vi.fn()
}));
vi.mock('../api/apiCallObservation', () => ({
	apiRegisterCallObservation: register,
	apiEndCallObservation: end
}));

import { callManager } from './CallManager';
import { setMatrixClientServiceRef } from './matrixClientRegistry';
import {
	callEventListeners,
	EVENT_SESSION_TEARDOWN
} from '../utils/eventHandler';

const SOURCE = '!group:oriso.example';
const ROOM = '!call:oriso.example';

describe('call observation across sign-out', () => {
	const createRoom = vi.fn();
	const sendEvent = vi.fn();

	beforeEach(() => {
		callManager.endCall(false);
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
			getUserId: () => '@caller:oriso.example',
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

	it('stops renewing after sign-out', async () => {
		sendEvent.mockResolvedValue({ event_id: '$invite' });
		callManager.startCall(SOURCE, true, true);
		await vi.waitFor(() => expect(register).toHaveBeenCalledTimes(1));
		vi.useFakeTimers();
		await callEventListeners(EVENT_SESSION_TEARDOWN);
		await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
		expect(register).toHaveBeenCalledTimes(1);
	});
});
