import type { MatrixClient } from 'matrix-js-sdk';
import { CallState, MatrixCall } from 'matrix-js-sdk/lib/webrtc/call';
import { MediaHandler } from 'matrix-js-sdk/lib/webrtc/mediaHandler';
import { describe, expect, it, vi } from 'vite-plus/test';

vi.mock('../utils/matrixRoomEncryption', () => ({
	assertMatrixRoomEncrypted: () => undefined
}));

const { matrixCallService } = await import('./matrixCallService');

// The unpatched matrix-js-sdk 38.4.0 keeps the camera/microphone stream that
// arrives after the caller hung up while we waited for media permission.
// ORISO releases it in matrixCallService.answerCall, so no SDK patch is needed
// and `npm ci --ignore-scripts` installs behave like any other install.

const createVideoStream = (id: string) => {
	const stop = vi.fn();
	const track = { id: id + '-track', kind: 'video', stop };
	const stream = Object.assign(new EventTarget(), {
		id,
		getTracks: () => [track],
		getAudioTracks: () => [],
		getVideoTracks: () => [track]
	}) as unknown as MediaStream;
	return { stream, stop };
};

const setUp = () => {
	const mediaReady = Promise.withResolvers<MediaStream>();
	const independent = createVideoStream('independent');
	const late = createVideoStream('late-answer');
	const client = {
		deviceId: 'fixture-device',
		getDeviceId: () => 'fixture-device',
		getUserId: () => '@fixture:example.invalid',
		getMediaHandler: () => media,
		isFallbackICEServerAllowed: () => false,
		callEventHandler: { calls: new Map() },
		on: vi.fn(),
		removeAllListeners: vi.fn()
	} as unknown as MatrixClient;
	const media = new MediaHandler(client);
	media.userMediaStreams.push(independent.stream);
	vi.spyOn(media, 'getUserMediaStream').mockImplementation(async () => {
		const stream = await mediaReady.promise;
		media.userMediaStreams.push(stream);
		return stream;
	});
	const call = new MatrixCall({
		client,
		roomId: '!fixture:example.invalid'
	});
	Object.defineProperties(call, {
		opponentPartyId: { value: 'caller-device' },
		hasRemoteUserMediaVideoTrack: { value: true }
	});
	matrixCallService.initialize(client);
	const hangUp = () =>
		call.onHangupReceived({
			version: '1',
			call_id: call.callId,
			party_id: 'caller-device'
		});
	return { call, media, mediaReady, independent, late, hangUp };
};

describe('matrixCallService.answerCall', () => {
	it('releases media that arrives after the incoming call ends', async () => {
		const { call, media, mediaReady, independent, late, hangUp } = setUp();

		const answer = matrixCallService.answerCall(call, true);
		expect(call.state).toBe(CallState.WaitLocalMedia);
		hangUp();
		expect(call.state).toBe(CallState.Ended);
		mediaReady.resolve(late.stream);
		await answer;

		expect(late.stop).toHaveBeenCalledOnce();
		expect(independent.stop).not.toHaveBeenCalled();
		expect(media.userMediaStreams).toEqual([independent.stream]);
	});

	it('keeps late media when a replacement call takes over', async () => {
		const { call, media, mediaReady, independent, late, hangUp } = setUp();
		Object.defineProperty(call, 'successor', { value: {} });

		const answer = matrixCallService.answerCall(call, true);
		hangUp();
		mediaReady.resolve(late.stream);
		await answer;

		expect(late.stop).not.toHaveBeenCalled();
		expect(media.userMediaStreams).toEqual([
			independent.stream,
			late.stream
		]);
	});
});
