// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	releaseAllCallWarmupStreams,
	releaseWindowMediaStream,
	stopMediaStreamTracks
} from './callMediaStreamCleanup';

function mockTrack(readyState: MediaStreamTrackState = 'live') {
	return {
		kind: 'video',
		readyState,
		stop: vi.fn()
	} as unknown as MediaStreamTrack & { stop: ReturnType<typeof vi.fn> };
}

function mockStream(tracks: MediaStreamTrack[]) {
	return {
		id: 'stream-1',
		getTracks: () => tracks
	} as unknown as MediaStream;
}

describe('callMediaStreamCleanup', () => {
	afterEach(() => {
		delete (window as any).__preRequestedMediaStream;
		delete (window as any).__preRequestedMediaStreamTime;
		delete (window as any).__activeMediaStream;
	});

	it('stopMediaStreamTracks stops every track', () => {
		const t1 = mockTrack();
		const t2 = mockTrack();
		stopMediaStreamTracks(mockStream([t1, t2]));
		expect(t1.stop).toHaveBeenCalledTimes(1);
		expect(t2.stop).toHaveBeenCalledTimes(1);
	});

	it('stopMediaStreamTracks no-ops for null/undefined', () => {
		expect(() => stopMediaStreamTracks(null)).not.toThrow();
		expect(() => stopMediaStreamTracks(undefined)).not.toThrow();
	});

	it('releaseWindowMediaStream stops pre-requested stream and clears time', () => {
		const track = mockTrack();
		(window as any).__preRequestedMediaStream = mockStream([track]);
		(window as any).__preRequestedMediaStreamTime = 123;
		releaseWindowMediaStream('__preRequestedMediaStream');
		expect(track.stop).toHaveBeenCalledTimes(1);
		expect((window as any).__preRequestedMediaStream).toBeUndefined();
		expect((window as any).__preRequestedMediaStreamTime).toBeUndefined();
	});

	it('releaseAllCallWarmupStreams clears both globals', () => {
		const pre = mockTrack();
		const active = mockTrack();
		(window as any).__preRequestedMediaStream = mockStream([pre]);
		(window as any).__activeMediaStream = mockStream([active]);
		releaseAllCallWarmupStreams();
		expect(pre.stop).toHaveBeenCalledTimes(1);
		expect(active.stop).toHaveBeenCalledTimes(1);
		expect((window as any).__preRequestedMediaStream).toBeUndefined();
		expect((window as any).__activeMediaStream).toBeUndefined();
	});
});
