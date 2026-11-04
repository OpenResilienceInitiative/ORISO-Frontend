import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	devicesForCall,
	forgetAllJoinMedia,
	deliverJoinMedia,
	initialControlsFor,
	joinMediaFrom,
	keepDeviceChoice,
	peekCameraSwitch,
	peekJoinMedia,
	rememberJoinMedia,
	shouldShowDeviceCheck,
	takeJoinMedia
} from './callPrejoin';

describe('shouldShowDeviceCheck (#2016)', () => {
	it('shows before joining from the call message', () => {
		expect(
			shouldShowDeviceCheck({
				surface: 'callMessage',
				mediaSupported: true,
				alreadyInCall: false
			})
		).toBe(true);
	});

	it('does not show when this browser is already in that call', () => {
		expect(
			shouldShowDeviceCheck({
				surface: 'callMessage',
				mediaSupported: true,
				alreadyInCall: true
			})
		).toBe(false);
	});

	it('does not show where the browser cannot ask for devices at all', () => {
		expect(
			shouldShowDeviceCheck({
				surface: 'callMessage',
				mediaSupported: false
			})
		).toBe(false);
		expect(
			shouldShowDeviceCheck({
				surface: 'circleLobby',
				mediaSupported: false,
				roomRef: '!circle:example',
				circleModality: 'VIDEO'
			})
		).toBe(false);
	});

	it('offers the option in the pre-lobby of a video circle only', () => {
		expect(
			shouldShowDeviceCheck({
				surface: 'circleLobby',
				mediaSupported: true,
				roomRef: '!circle:example',
				circleModality: 'VIDEO'
			})
		).toBe(true);
		// Product owner, 2026-11-03: text (and audio) circles get no button.
		expect(
			shouldShowDeviceCheck({
				surface: 'circleLobby',
				mediaSupported: true,
				roomRef: '!circle:example',
				circleModality: 'TEXT'
			})
		).toBe(false);
		expect(
			shouldShowDeviceCheck({
				surface: 'circleLobby',
				mediaSupported: true,
				roomRef: '!circle:example'
			})
		).toBe(false);
		// Without the room nothing could be carried into its call.
		expect(
			shouldShowDeviceCheck({
				surface: 'circleLobby',
				mediaSupported: true,
				roomRef: null,
				circleModality: 'VIDEO'
			})
		).toBe(false);
	});
});

describe('joinMediaFrom (#2016): what is passed to the call', () => {
	const base = {
		modality: 'video' as const,
		micOn: true,
		cameraOn: true,
		cameraAvailable: true
	};

	it('passes microphone and camera as switched', () => {
		expect(joinMediaFrom(base)).toEqual({
			audio_enabled: true,
			video_enabled: true
		});
		expect(
			joinMediaFrom({ ...base, micOn: false, cameraOn: false })
		).toEqual({ audio_enabled: false, video_enabled: false });
	});

	it('never passes a camera that is not there', () => {
		expect(joinMediaFrom({ ...base, cameraAvailable: false })).toEqual({
			audio_enabled: true,
			video_enabled: false
		});
	});

	it('never turns a camera on in a phone call', () => {
		expect(joinMediaFrom({ ...base, modality: 'audio' })).toEqual({
			audio_enabled: true,
			video_enabled: false
		});
	});

	it('passes nothing when the check could not run', () => {
		expect(joinMediaFrom({ ...base, blocker: 'permissionDenied' })).toBe(
			null
		);
		expect(joinMediaFrom({ ...base, blocker: 'noDevice' })).toBe(null);
	});
});

describe('the choice, from the check to the call (#2016)', () => {
	afterEach(() => forgetAllJoinMedia());

	it('is taken once, by the call in that room', () => {
		rememberJoinMedia('!room:example', {
			audio_enabled: false,
			video_enabled: true
		});
		expect(takeJoinMedia('!other:example')).toBe(null);
		expect(takeJoinMedia('!room:example')).toEqual({
			audio_enabled: false,
			video_enabled: true
		});
		expect(takeJoinMedia('!room:example')).toBe(null);
	});

	it('is forgotten when the check passes nothing', () => {
		rememberJoinMedia('!room:example', {
			audio_enabled: false,
			video_enabled: false
		});
		rememberJoinMedia('!room:example', null);
		expect(peekJoinMedia('!room:example')).toBe(null);
	});

	it('opens the next check where the last one left off', () => {
		expect(initialControlsFor('video', null)).toEqual({
			micOn: true,
			cameraOn: true,
			selection: {}
		});
		expect(
			initialControlsFor('video', {
				audio_enabled: false,
				video_enabled: false
			})
		).toEqual({ micOn: false, cameraOn: false, selection: {} });
		expect(initialControlsFor('audio', null).cameraOn).toBe(false);
	});

	it('switches in the call only what the call has', () => {
		expect(devicesForCall(true, null)).toBe(null);
		expect(
			devicesForCall(true, { audio_enabled: false, video_enabled: false })
		).toEqual({ audio_enabled: false, video_enabled: false });
		expect(
			devicesForCall(false, { audio_enabled: false, video_enabled: true })
		).toEqual({ audio_enabled: false });
	});
});

describe('joinMediaFrom when the check could not run (#2016)', () => {
	const outcome = {
		modality: 'video' as const,
		cameraAvailable: true,
		blocker: 'permissionDenied' as const
	};

	it('passes nothing while every switch is on', () => {
		expect(
			joinMediaFrom({ ...outcome, micOn: true, cameraOn: true })
		).toBeNull();
	});

	it('still honours a switch the person turned off', () => {
		expect(
			joinMediaFrom({ ...outcome, micOn: true, cameraOn: false })
		).toEqual({ audio_enabled: true, video_enabled: false });
	});

	it('does not read an audio call as a camera switched off', () => {
		expect(
			joinMediaFrom({
				...outcome,
				modality: 'audio',
				micOn: true,
				cameraOn: false
			})
		).toBeNull();
	});
});

describe('the camera switch across checks (#2016)', () => {
	afterEach(forgetAllJoinMedia);

	const device = (cameraOn: boolean, cameraAvailable: boolean) => ({
		controls: { micOn: true, cameraOn, selection: {} },
		cameraAvailable
	});

	it('does not read an unavailable camera as switched off', () => {
		keepDeviceChoice('!r', 'video', device(true, false));
		expect(peekJoinMedia('!r')?.video_enabled).toBe(false);
		expect(
			initialControlsFor(
				'video',
				peekJoinMedia('!r'),
				peekCameraSwitch('!r')
			).cameraOn
		).toBe(true);
	});

	it('keeps a camera the person did switch off', () => {
		keepDeviceChoice('!r', 'video', device(false, true));
		expect(
			initialControlsFor(
				'video',
				peekJoinMedia('!r'),
				peekCameraSwitch('!r')
			).cameraOn
		).toBe(false);
	});

	it('does not carry an audio check over to a video call', () => {
		keepDeviceChoice('!r', 'audio', device(false, true));
		expect(
			initialControlsFor(
				'video',
				peekJoinMedia('!r'),
				peekCameraSwitch('!r')
			).cameraOn
		).toBe(true);
	});
});

describe('deliverJoinMedia (#2016)', () => {
	const wanted = { audio_enabled: true, video_enabled: false };
	const options = { waitMs: 0 };

	it('stops once the call confirms', async () => {
		const send = vi.fn(() => Promise.resolve(wanted));
		await expect(deliverJoinMedia(send, wanted, options)).resolves.toBe(
			true
		);
		expect(send).toHaveBeenCalledTimes(1);
	});

	it('asks again after a failed send or a reply that did not apply it', async () => {
		const send = vi
			.fn()
			.mockRejectedValueOnce(new Error('timeout'))
			.mockResolvedValueOnce({ audio_enabled: true, video_enabled: true })
			.mockResolvedValueOnce(wanted);
		await expect(deliverJoinMedia(send, wanted, options)).resolves.toBe(
			true
		);
		expect(send).toHaveBeenCalledTimes(3);
	});

	it('says so when the call never confirms', async () => {
		const send = vi.fn(() => Promise.resolve(null));
		await expect(deliverJoinMedia(send, wanted, options)).resolves.toBe(
			false
		);
		expect(send).toHaveBeenCalledTimes(3);
	});

	it('asks only about what it sent', async () => {
		const send = vi.fn(() =>
			Promise.resolve({ audio_enabled: false, video_enabled: true })
		);
		await expect(
			deliverJoinMedia(send, { audio_enabled: false }, options)
		).resolves.toBe(true);
	});

	it('stops when the call has gone', async () => {
		const send = vi.fn(() => Promise.resolve(null));
		await deliverJoinMedia(send, wanted, {
			...options,
			stopped: () => true
		});
		expect(send).not.toHaveBeenCalled();
	});
});
