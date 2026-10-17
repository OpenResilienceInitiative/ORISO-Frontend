// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LiveCallControls, useLiveCallDevices } from './useLiveCallDevices';

/**
 * The live device check of the call entry (#1386, PR #1743 review): a
 * missing webcam must not block a working microphone, the switches and the
 * picker must reach the real tracks, "Erneut prüfen" must ask again, and an
 * unmount mid-way must leave nothing running.
 */

type FakeTrack = { kind: string; enabled: boolean; stop: () => void };

const track = (kind: string): FakeTrack => ({
	kind,
	enabled: true,
	stop: vi.fn()
});

const fakeStream = (kinds: string[]) => {
	const tracks = kinds.map(track);
	return {
		tracks,
		getTracks: () => tracks,
		getAudioTracks: () => tracks.filter((t) => t.kind === 'audio'),
		getVideoTracks: () => tracks.filter((t) => t.kind === 'video')
	} as unknown as MediaStream & { tracks: FakeTrack[] };
};

const domError = (name: string) => Object.assign(new Error(name), { name });

const devicesFor = (
	getUserMedia: (c: MediaStreamConstraints) => Promise<MediaStream>,
	enumerateDevices: () => Promise<MediaDeviceInfo[]> = () =>
		Promise.resolve([])
) =>
	({
		getUserMedia: vi.fn(getUserMedia),
		enumerateDevices: vi.fn(enumerateDevices)
	}) as unknown as MediaDevices & {
		getUserMedia: ReturnType<typeof vi.fn>;
		enumerateDevices: ReturnType<typeof vi.fn>;
	};

const on: LiveCallControls = { micOn: true, cameraOn: true, selection: {} };

const audioContexts: unknown[] = [];

beforeEach(() => {
	audioContexts.length = 0;
	vi.stubGlobal(
		'AudioContext',
		class {
			constructor() {
				audioContexts.push(this);
			}
			createAnalyser() {
				return {
					fftSize: 0,
					getByteTimeDomainData: () => undefined
				};
			}
			createMediaStreamSource() {
				return { connect: () => undefined };
			}
			close() {
				return Promise.resolve();
			}
		}
	);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('useLiveCallDevices', () => {
	it('continues with the camera off when there is no webcam but a microphone', async () => {
		const audioOnly = fakeStream(['audio']);
		const media = devicesFor((constraints) =>
			constraints.video
				? Promise.reject(domError('NotFoundError'))
				: Promise.resolve(audioOnly)
		);
		const { result } = renderHook(() =>
			useLiveCallDevices('video', on, media)
		);
		await waitFor(() => expect(result.current.stream).toBe(audioOnly));
		expect(result.current.blocker).toBeUndefined();
		expect(result.current.cameraMissing).toBe(true);
		expect(media.getUserMedia).toHaveBeenLastCalledWith({
			audio: true,
			video: false
		});
	});

	it('goes on with the microphone when only the camera is denied', async () => {
		const audioOnly = fakeStream(['audio']);
		const media = devicesFor((constraints) =>
			constraints.video
				? Promise.reject(domError('NotAllowedError'))
				: Promise.resolve(audioOnly)
		);
		const { result } = renderHook(() =>
			useLiveCallDevices('video', on, media)
		);
		await waitFor(() => expect(result.current.stream).toBe(audioOnly));
		expect(result.current.blocker).toBeUndefined();
		expect(result.current.cameraMissing).toBe(true);
	});

	it('blocks as denied when the microphone is denied too', async () => {
		const media = devicesFor(() =>
			Promise.reject(domError('NotAllowedError'))
		);
		const { result } = renderHook(() =>
			useLiveCallDevices('video', on, media)
		);
		await waitFor(() =>
			expect(result.current.blocker).toBe('permissionDenied')
		);
		expect(media.getUserMedia).toHaveBeenCalledTimes(2);
	});

	it('blocks with "no device" only when there is no microphone either', async () => {
		const media = devicesFor(() =>
			Promise.reject(domError('NotFoundError'))
		);
		const { result } = renderHook(() =>
			useLiveCallDevices('video', on, media)
		);
		await waitFor(() => expect(result.current.blocker).toBe('noDevice'));
	});

	it('reports a denied permission as such', async () => {
		const media = devicesFor(() =>
			Promise.reject(domError('NotAllowedError'))
		);
		const { result } = renderHook(() =>
			useLiveCallDevices('audio', on, media)
		);
		await waitFor(() =>
			expect(result.current.blocker).toBe('permissionDenied')
		);
		expect(media.getUserMedia).toHaveBeenCalledTimes(1);
	});

	it('asks again on retry and clears the blocker once it works', async () => {
		const stream = fakeStream(['audio']);
		let allow = false;
		const media = devicesFor(() =>
			allow
				? Promise.resolve(stream)
				: Promise.reject(domError('NotAllowedError'))
		);
		const { result } = renderHook(() =>
			useLiveCallDevices('audio', on, media)
		);
		await waitFor(() =>
			expect(result.current.blocker).toBe('permissionDenied')
		);
		allow = true;
		act(() => result.current.retry());
		await waitFor(() => expect(result.current.stream).toBe(stream));
		expect(result.current.blocker).toBeUndefined();
		expect(media.getUserMedia).toHaveBeenCalledTimes(2);
	});

	it('switches the live tracks with the mic and camera toggles', async () => {
		const stream = fakeStream(['audio', 'video']);
		const media = devicesFor(() => Promise.resolve(stream));
		const { result, rerender } = renderHook(
			(controls: LiveCallControls) =>
				useLiveCallDevices('video', controls, media),
			{ initialProps: on }
		);
		await waitFor(() => expect(result.current.stream).toBe(stream));
		rerender({ ...on, micOn: false, cameraOn: false });
		expect(stream.tracks.map((t) => t.enabled)).toEqual([false, false]);
		rerender(on);
		expect(stream.tracks.map((t) => t.enabled)).toEqual([true, true]);
	});

	it('re-acquires the chosen device and stops the old tracks', async () => {
		const first = fakeStream(['audio']);
		const second = fakeStream(['audio']);
		const media = devicesFor((constraints) =>
			Promise.resolve(constraints.audio === true ? first : second)
		);
		const { result, rerender } = renderHook(
			(controls: LiveCallControls) =>
				useLiveCallDevices('audio', controls, media),
			{ initialProps: on }
		);
		await waitFor(() => expect(result.current.stream).toBe(first));
		rerender({ ...on, selection: { microphone: 'mic-2' } });
		await waitFor(() => expect(result.current.stream).toBe(second));
		expect(media.getUserMedia).toHaveBeenLastCalledWith({
			audio: { deviceId: { exact: 'mic-2' } },
			video: false
		});
		expect(first.tracks[0].stop).toHaveBeenCalled();
		expect(second.tracks[0].stop).not.toHaveBeenCalled();
	});

	it('falls back to any microphone when the chosen one is unplugged', async () => {
		const stream = fakeStream(['audio']);
		const media = devicesFor((constraints) =>
			constraints.audio === true
				? Promise.resolve(stream)
				: Promise.reject(domError('NotFoundError'))
		);
		const { result } = renderHook(() =>
			useLiveCallDevices(
				'audio',
				{ ...on, selection: { microphone: 'gone' } },
				media
			)
		);
		await waitFor(() => expect(result.current.stream).toBe(stream));
		expect(result.current.blocker).toBeUndefined();
	});

	it('falls back to any camera when the chosen one is unplugged', async () => {
		const stream = fakeStream(['audio', 'video']);
		const media = devicesFor((constraints) =>
			constraints.video === true
				? Promise.resolve(stream)
				: Promise.reject(domError('NotFoundError'))
		);
		const { result } = renderHook(() =>
			useLiveCallDevices(
				'video',
				{ ...on, selection: { camera: 'gone' } },
				media
			)
		);
		await waitFor(() => expect(result.current.stream).toBe(stream));
		expect(result.current.cameraMissing).toBe(false);
	});

	it('runs the check with empty pickers when the device list fails', async () => {
		const stream = fakeStream(['audio']);
		const media = devicesFor(
			() => Promise.resolve(stream),
			() => Promise.reject(domError('InvalidStateError'))
		);
		const { result } = renderHook(() =>
			useLiveCallDevices('audio', on, media)
		);
		await waitFor(() => expect(result.current.stream).toBe(stream));
		expect(result.current.devices.microphone).toEqual([]);
		expect(result.current.blocker).toBeUndefined();
	});

	it('leaves nothing running when unmounted while the devices are listed', async () => {
		const stream = fakeStream(['audio']);
		let list: (devices: MediaDeviceInfo[]) => void = () => undefined;
		const media = devicesFor(
			() => Promise.resolve(stream),
			() => new Promise((resolve) => (list = resolve))
		);
		const { unmount } = renderHook(() =>
			useLiveCallDevices('audio', on, media)
		);
		await waitFor(() => expect(media.enumerateDevices).toHaveBeenCalled());
		unmount();
		await act(async () => list([]));
		expect(stream.tracks[0].stop).toHaveBeenCalled();
		expect(audioContexts).toHaveLength(0);
	});
});
