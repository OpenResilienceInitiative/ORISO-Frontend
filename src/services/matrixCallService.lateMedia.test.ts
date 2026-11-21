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
	const independent = createVideoStream('independent');
	const calls = new Map<string, MatrixCall>();
	const client = {
		deviceId: 'fixture-device',
		getDeviceId: () => 'fixture-device',
		getUserId: () => '@fixture:example.invalid',
		getMediaHandler: () => media,
		isFallbackICEServerAllowed: () => false,
		callEventHandler: { calls },
		on: vi.fn(),
		removeAllListeners: vi.fn()
	} as unknown as MatrixClient;
	const media = new MediaHandler(client);
	media.userMediaStreams.push(independent.stream);
	// Each answer() waits for its own permission prompt, in call order.
	const prompts: Array<PromiseWithResolvers<MediaStream>> = [];
	vi.spyOn(media, 'getUserMediaStream').mockImplementation(async () => {
		const prompt = Promise.withResolvers<MediaStream>();
		prompts.push(prompt);
		const stream = await prompt.promise;
		media.userMediaStreams.push(stream);
		return stream;
	});
	const incomingCall = (roomId: string) => {
		const call = new MatrixCall({ client, roomId });
		Object.defineProperties(call, {
			opponentPartyId: { value: 'caller-device' },
			hasRemoteUserMediaVideoTrack: { value: true }
		});
		calls.set(call.callId, call);
		const hangUp = () =>
			call.onHangupReceived({
				version: '1',
				call_id: call.callId,
				party_id: 'caller-device'
			});
		return { call, hangUp };
	};
	matrixCallService.initialize(client);
	return { media, prompts, independent, incomingCall };
};

describe('matrixCallService.answerCall', () => {
	it('releases media that arrives after the incoming call ends', async () => {
		const { media, prompts, independent, incomingCall } = setUp();
		const { call, hangUp } = incomingCall('!first:example.invalid');
		const late = createVideoStream('late-answer');

		const answer = matrixCallService.answerCall(call, true);
		expect(call.state).toBe(CallState.WaitLocalMedia);
		hangUp();
		expect(call.state).toBe(CallState.Ended);
		prompts[0].resolve(late.stream);
		await answer;

		expect(late.stop).toHaveBeenCalledOnce();
		expect(independent.stop).not.toHaveBeenCalled();
		expect(media.userMediaStreams).toEqual([independent.stream]);
	});

	it('keeps late media when a replacement call takes over', async () => {
		const { media, prompts, independent, incomingCall } = setUp();
		const { call, hangUp } = incomingCall('!first:example.invalid');
		const late = createVideoStream('late-answer');
		Object.defineProperty(call, 'successor', { value: {} });

		const answer = matrixCallService.answerCall(call, true);
		hangUp();
		prompts[0].resolve(late.stream);
		await answer;

		expect(late.stop).not.toHaveBeenCalled();
		expect(media.userMediaStreams).toEqual([
			independent.stream,
			late.stream
		]);
	});

	it('releases the media of two overlapping calls that both end', async () => {
		const { media, prompts, independent, incomingCall } = setUp();
		const first = incomingCall('!first:example.invalid');
		const second = incomingCall('!second:example.invalid');
		const firstLate = createVideoStream('first-late');
		const secondLate = createVideoStream('second-late');

		const firstAnswer = matrixCallService.answerCall(first.call, true);
		first.hangUp();
		const secondAnswer = matrixCallService.answerCall(second.call, true);
		second.hangUp();
		prompts[1].resolve(secondLate.stream);
		prompts[0].resolve(firstLate.stream);
		await Promise.all([firstAnswer, secondAnswer]);

		expect(firstLate.stop).toHaveBeenCalledOnce();
		expect(secondLate.stop).toHaveBeenCalledOnce();
		expect(independent.stop).not.toHaveBeenCalled();
		expect(media.userMediaStreams).toEqual([independent.stream]);
	});

	it('keeps the media of a second call that is still running', async () => {
		const { media, prompts, independent, incomingCall } = setUp();
		const first = incomingCall('!first:example.invalid');
		const second = incomingCall('!second:example.invalid');
		const firstLate = createVideoStream('first-late');
		const secondLive = createVideoStream('second-live');
		// The second call connects: its feed holds the stream it got.
		let secondFeedStream: MediaStream | undefined;
		vi.spyOn(second.call, 'answerWithCallFeeds').mockImplementation(
			(feeds) => {
				secondFeedStream = feeds[0].stream;
			}
		);
		Object.defineProperty(second.call, 'localUsermediaStream', {
			get: () => secondFeedStream
		});

		const firstAnswer = matrixCallService.answerCall(first.call, true);
		first.hangUp();
		const secondAnswer = matrixCallService.answerCall(second.call, true);
		prompts[1].resolve(secondLive.stream);
		await secondAnswer;
		prompts[0].resolve(firstLate.stream);
		await firstAnswer;

		expect(firstLate.stop).toHaveBeenCalledOnce();
		expect(secondLive.stop).not.toHaveBeenCalled();
		expect(independent.stop).not.toHaveBeenCalled();
		expect(media.userMediaStreams).toEqual([
			independent.stream,
			secondLive.stream
		]);
	});
});
