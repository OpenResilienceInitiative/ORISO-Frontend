import type { MatrixClient } from 'matrix-js-sdk';
import { CallState, MatrixCall } from 'matrix-js-sdk/lib/webrtc/call';
import { MediaHandler } from 'matrix-js-sdk/lib/webrtc/mediaHandler';
import { expect, it, vi } from 'vite-plus/test';

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

it('releases media that arrives after the incoming call ends', async () => {
	const mediaReady = Promise.withResolvers<MediaStream>();
	const independent = createVideoStream('independent');
	const late = createVideoStream('late-answer');
	const client = {
		deviceId: 'fixture-device',
		getDeviceId: () => 'fixture-device',
		getUserId: () => '@fixture:example.invalid',
		getMediaHandler: () => media,
		isFallbackICEServerAllowed: () => false,
		callEventHandler: { calls: new Map() }
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

	const answer = call.answer(false, true);
	expect(call.state).toBe(CallState.WaitLocalMedia);
	call.onHangupReceived({
		version: '1',
		call_id: call.callId,
		party_id: 'caller-device'
	});
	expect(call.state).toBe(CallState.Ended);
	mediaReady.resolve(late.stream);
	await answer;

	expect(late.stop).toHaveBeenCalledOnce();
	expect(independent.stop).not.toHaveBeenCalled();
	expect(media.userMediaStreams).toEqual([independent.stream]);
});
