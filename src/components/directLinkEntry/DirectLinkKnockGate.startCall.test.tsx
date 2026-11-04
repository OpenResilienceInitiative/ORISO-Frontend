// @vitest-environment oriso-jsdom
/**
 * Let in after a knock, the call is started here. The device check's camera
 * choice must reach the permission request that starts it: a camera the
 * person switched off is not opened, and a person without a camera is not
 * stopped by a request for one.
 */
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';
import {
	forgetAllJoinMedia,
	rememberJoinMedia
} from '../call/prejoin/callPrejoin';

const ROOM = '!room:oriso';

vi.mock('../../services/matrixClientRegistry', () => ({
	getMatrixClientService: () => ({
		getClient: () => ({
			getRoom: () => ({ getMyMembership: () => 'join' })
		})
	})
}));

const startCall = vi.fn();
vi.mock('../../services/CallManager', () => ({
	callManager: { startCall, joinExistingCall: vi.fn() }
}));

const { startAdmittedCall } = await import('./DirectLinkKnockGate');

const videoKnock = {
	token: 'tok',
	knockId: 21,
	sessionId: 9,
	matrixRoomId: ROOM,
	medium: 'VIDEO' as const,
	status: 'ADMITTED' as const
};

describe('starting the call after a knock was let in', () => {
	beforeEach(() => {
		Object.defineProperty(window, 'location', {
			configurable: true,
			writable: true,
			value: { protocol: 'https:', href: 'https://app.test.local/' }
		});
		vi.stubGlobal('navigator', {
			mediaDevices: {
				getUserMedia: vi.fn(async () => ({ getTracks: () => [] }))
			}
		});
		vi.stubGlobal('alert', vi.fn());
	});

	afterEach(() => {
		forgetAllJoinMedia();
		vi.unstubAllGlobals();
		startCall.mockReset();
	});

	it('does not ask for the camera the person switched off in the check', async () => {
		rememberJoinMedia(ROOM, { audio_enabled: true, video_enabled: false });

		await startAdmittedCall(videoKnock);

		expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
			video: false,
			audio: true
		});
	});

	it('asks for the camera when the check left it on', async () => {
		rememberJoinMedia(ROOM, { audio_enabled: true, video_enabled: true });

		await startAdmittedCall(videoKnock);

		expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
			video: true,
			audio: true
		});
	});

	it('asks for the camera of a video call when no check ran', async () => {
		await startAdmittedCall(videoKnock);

		expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
			video: true,
			audio: true
		});
	});

	it('leaves the choice for the call itself to take', async () => {
		rememberJoinMedia(ROOM, { audio_enabled: false, video_enabled: false });

		await startAdmittedCall(videoKnock);

		const { peekJoinMedia } = await import('../call/prejoin/callPrejoin');
		expect(peekJoinMedia(ROOM)).toEqual({
			audio_enabled: false,
			video_enabled: false
		});
	});
});
