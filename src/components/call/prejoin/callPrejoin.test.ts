import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	callStartFor,
	chosenDeviceLabel,
	devicesForCall,
	forgetAllJoinMedia,
	initialControlsFor,
	joinMediaFrom,
	peekJoinMedia,
	rememberJoinMedia,
	shouldShowDeviceCheck,
	switchDevicesOnReady,
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

	it('passes the picked microphone and camera by label (ElementCall#116)', () => {
		expect(
			joinMediaFrom({
				...base,
				microphoneLabel: 'Jabra Evolve2 Headset',
				cameraLabel: 'Logitech C920'
			})
		).toEqual({
			audio_enabled: true,
			video_enabled: true,
			microphoneLabel: 'Jabra Evolve2 Headset',
			cameraLabel: 'Logitech C920'
		});
	});

	it('passes no camera label for a phone call or a missing camera', () => {
		const labelled = {
			...base,
			microphoneLabel: 'Jabra Evolve2 Headset',
			cameraLabel: 'Logitech C920'
		};
		expect(
			joinMediaFrom({ ...labelled, modality: 'audio' })
		).not.toHaveProperty('cameraLabel');
		expect(
			joinMediaFrom({ ...labelled, cameraAvailable: false })
		).not.toHaveProperty('cameraLabel');
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

	it('switches in the call only on/off, never the labels', () => {
		expect(
			devicesForCall(true, {
				audio_enabled: true,
				video_enabled: false,
				microphoneLabel: 'Jabra Evolve2 Headset',
				cameraLabel: 'Logitech C920'
			})
		).toEqual({ audio_enabled: true, video_enabled: false });
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

describe('chosenDeviceLabel (ElementCall#116)', () => {
	const microphones = [
		{ id: 'mic-1', label: 'MacBook Pro-Mikrofon' },
		{ id: 'mic-2', label: 'Jabra Evolve2 Headset' }
	];

	it('is the label of the picked device', () => {
		expect(chosenDeviceLabel(microphones, 'mic-2')).toBe(
			'Jabra Evolve2 Headset'
		);
	});

	it('is the label of the device the check showed when nothing was picked', () => {
		// The picker shows the first device as chosen; the call gets that one.
		expect(chosenDeviceLabel(microphones, undefined)).toBe(
			'MacBook Pro-Mikrofon'
		);
	});

	it('is nothing without devices', () => {
		expect(chosenDeviceLabel([], undefined)).toBeUndefined();
	});
});

describe('callStartFor: the choice on the widget URL (ElementCall#116)', () => {
	const media = {
		audio_enabled: false,
		video_enabled: false,
		microphoneLabel: 'Jabra Evolve2 Headset',
		cameraLabel: 'Logitech C920'
	};

	it('starts a video call with both switches and both devices', () => {
		expect(callStartFor(true, media)).toEqual({
			audioEnabled: false,
			videoEnabled: false,
			audioInput: 'Jabra Evolve2 Headset',
			videoInput: 'Logitech C920'
		});
	});

	it('tells a phone call only about the microphone', () => {
		expect(callStartFor(false, media)).toEqual({
			audioEnabled: false,
			audioInput: 'Jabra Evolve2 Headset'
		});
	});

	it('leaves out a device that was not named', () => {
		expect(
			callStartFor(true, { audio_enabled: true, video_enabled: true })
		).toEqual({ audioEnabled: true, videoEnabled: true });
	});

	it('is nothing without a check', () => {
		expect(callStartFor(true, null)).toBe(null);
	});
});

describe('switchDevicesOnReady: the fallback for an older call (CodeRabbit 4457278942)', () => {
	const media = { audio_enabled: true, video_enabled: false };

	it('tries again when the call did not take it', async () => {
		const send = vi
			.fn()
			.mockRejectedValueOnce(new Error('timeout'))
			.mockResolvedValueOnce(undefined);
		await expect(
			switchDevicesOnReady(send, media, { delayMs: 0 })
		).resolves.toBe(true);
		expect(send).toHaveBeenCalledTimes(2);
		expect(send).toHaveBeenLastCalledWith(media);
	});

	it('gives up after a few tries', async () => {
		const send = vi.fn().mockRejectedValue(new Error('gone'));
		await expect(
			switchDevicesOnReady(send, media, { attempts: 3, delayMs: 0 })
		).resolves.toBe(false);
		expect(send).toHaveBeenCalledTimes(3);
	});

	it('does not report success to a call that went away meanwhile (CodeRabbit 4457965169)', async () => {
		let current = true;
		const send = vi.fn().mockImplementation(async () => {
			current = false;
		});
		await expect(
			switchDevicesOnReady(send, media, {
				delayMs: 0,
				isCurrent: () => current
			})
		).resolves.toBe(false);
	});

	it('stops once the call is no longer there', async () => {
		let current = true;
		const send = vi.fn().mockImplementation(async () => {
			current = false;
			throw new Error('closed');
		});
		await expect(
			switchDevicesOnReady(send, media, {
				delayMs: 0,
				isCurrent: () => current
			})
		).resolves.toBe(false);
		expect(send).toHaveBeenCalledTimes(1);
	});
});
