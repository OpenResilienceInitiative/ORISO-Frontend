import { EventEmitter } from 'node:events';
import type { MatrixClient } from 'matrix-js-sdk';
import type { MatrixCall } from 'matrix-js-sdk/lib/webrtc/call';
import {
	MediaHandler,
	MediaHandlerEvent
} from 'matrix-js-sdk/lib/webrtc/mediaHandler';
import { expect, it, vi } from 'vite-plus/test';
import { matrixCallService } from './matrixCallService';

const streamsChanged = MediaHandlerEvent.LocalStreamsChanged;

const createFixture = (
	id: string,
	mediaReady?: Promise<MediaStream>,
	sdkDone?: Promise<void>
) => {
	const stopTrack = vi.fn();
	const stream = {
		id,
		getTracks: () => [{ stop: stopTrack }]
	} as unknown as MediaStream;
	const client = {
		on: vi.fn(),
		removeAllListeners: vi.fn(),
		getRoom: () => ({ hasEncryptionStateEvent: () => true }),
		getMediaHandler: () => media,
		createCall: () => call
	} as unknown as MatrixClient;
	const media = new MediaHandler(client);
	const acquire = vi
		.spyOn(media, 'getUserMediaStream')
		.mockImplementation(async () => {
			const result = mediaReady ? await mediaReady : stream;
			media.userMediaStreams.push(result);
			media.emit(streamsChanged);
			return result;
		});
	const onMediaReady = async () => {
		await media.getUserMediaStream(true, false);
		await sdkDone;
	};
	// The outgoing ended call never attaches the newly acquired stream as a feed.
	const call = Object.assign(new EventEmitter(), {
		roomId: '!room:matrix.test',
		answer: vi.fn(onMediaReady),
		placeCall: vi.fn(onMediaReady),
		hangup: vi.fn()
	}) as unknown as MatrixCall;
	return { client, media, acquire, stream, stopTrack, call };
};

const connect = (direction: 'answer' | 'start', call: MatrixCall) =>
	direction === 'answer'
		? matrixCallService.answerCall(call, false)
		: matrixCallService.startCall({
				roomId: call.roomId,
				isVideoCall: false
			});

it.each(['answer', 'start'] as const)(
	'releases late outgoing media while %s is pending without stopping replacement media',
	async (direction) => {
		const mediaReady = Promise.withResolvers<MediaStream>();
		const sdkDone = Promise.withResolvers<void>();
		const outgoing = createFixture(
			'old',
			mediaReady.promise,
			sdkDone.promise
		);
		const replacement = createFixture('new');

		matrixCallService.initialize(outgoing.client);
		const connecting = connect(direction, outgoing.call);
		try {
			expect(outgoing.acquire).toHaveBeenCalledOnce();
			matrixCallService.initialize(replacement.client);
			matrixCallService.detach(outgoing.client);
			expect(outgoing.call.hangup).toHaveBeenCalledOnce();
			await connect(direction, replacement.call);

			mediaReady.resolve(outgoing.stream);
			await mediaReady.promise;
			expect(outgoing.stopTrack).toHaveBeenCalledOnce();
			expect(outgoing.media.userMediaStreams).toEqual([]);
			expect(replacement.stopTrack).not.toHaveBeenCalled();
			expect(replacement.media.userMediaStreams).toEqual([
				replacement.stream
			]);
			expect(matrixCallService.getActiveCall()).toBe(replacement.call);

			sdkDone.resolve();
			await connecting;
			expect(outgoing.media.listenerCount(streamsChanged)).toBe(0);
			expect(replacement.media.listenerCount(streamsChanged)).toBe(0);
		} finally {
			mediaReady.resolve(outgoing.stream);
			sdkDone.resolve();
			await connecting;
			matrixCallService.destroy();
			outgoing.media.stopAllStreams();
			replacement.media.stopAllStreams();
		}
	}
);

it.each(['answer', 'start'] as const)(
	'stops outgoing media acquired before %s completes when the client is displaced',
	async (direction) => {
		const sdkDone = Promise.withResolvers<void>();
		const outgoing = createFixture('old', undefined, sdkDone.promise);
		const replacement = createFixture('new');
		const lateStop = vi.fn();

		matrixCallService.initialize(outgoing.client);
		const connecting = connect(direction, outgoing.call);
		try {
			expect(outgoing.acquire).toHaveBeenCalledOnce();
			expect(outgoing.media.userMediaStreams).toEqual([outgoing.stream]);

			matrixCallService.initialize(replacement.client);

			expect(outgoing.stopTrack).toHaveBeenCalledOnce();
			expect(outgoing.media.userMediaStreams).toEqual([]);
			expect(outgoing.media.listenerCount(streamsChanged)).toBe(1);

			const lateStream = {
				id: 'late',
				getTracks: () => [{ stop: lateStop }]
			} as unknown as MediaStream;
			outgoing.media.userMediaStreams.push(lateStream);
			outgoing.media.emit(streamsChanged);
			expect(lateStop).toHaveBeenCalledOnce();
			expect(outgoing.media.userMediaStreams).toEqual([]);

			await connect(direction, replacement.call);
			expect(replacement.stopTrack).not.toHaveBeenCalled();
			expect(replacement.media.userMediaStreams).toEqual([
				replacement.stream
			]);
			expect(matrixCallService.getActiveCall()).toBe(replacement.call);

			sdkDone.resolve();
			await connecting;
			expect(outgoing.media.listenerCount(streamsChanged)).toBe(0);
			expect(replacement.media.listenerCount(streamsChanged)).toBe(0);
		} finally {
			sdkDone.resolve();
			await connecting;
			matrixCallService.destroy();
			outgoing.media.stopAllStreams();
			replacement.media.stopAllStreams();
		}
	}
);

it('keeps media on a replacement using the exact same SDK client', async () => {
	const mediaReady = Promise.withResolvers<MediaStream>();
	const fixture = createFixture('reused', mediaReady.promise);
	matrixCallService.initialize(fixture.client);
	const answer = connect('answer', fixture.call);
	try {
		matrixCallService.detach(fixture.client);
		matrixCallService.initialize(fixture.client);
		mediaReady.resolve(fixture.stream);
		await answer;

		expect(fixture.stopTrack).not.toHaveBeenCalled();
		expect(fixture.media.listenerCount(streamsChanged)).toBe(0);
	} finally {
		mediaReady.resolve(fixture.stream);
		await answer;
		matrixCallService.destroy();
		fixture.media.stopAllStreams();
	}
});

it('reports a current answer failure and removes its media listener', async () => {
	const fixture = createFixture('current');
	const failure = new Error('fixture acquisition failed');
	fixture.acquire.mockRejectedValueOnce(failure);
	const onCallError = vi.fn();
	matrixCallService.initialize(fixture.client, { onCallError });
	try {
		await expect(connect('answer', fixture.call)).rejects.toBe(failure);
		expect(onCallError).toHaveBeenCalledExactlyOnceWith(failure);
		expect(fixture.media.listenerCount(streamsChanged)).toBe(0);
	} finally {
		matrixCallService.destroy();
	}
});
