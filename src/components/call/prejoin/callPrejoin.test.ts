import { afterEach, describe, expect, it } from 'vitest';
import {
	devicesForCall,
	forgetAllJoinMedia,
	initialControlsFor,
	joinMediaFrom,
	peekJoinMedia,
	rememberJoinMedia,
	isInCall,
	shouldShowDeviceCheck,
	takeJoinMedia
} from './callPrejoin';

describe('isInCall (#2016)', () => {
	it('is true while this browser is in that call', () => {
		expect(isInCall({ callId: 'c1', state: 'connected' }, 'c1')).toBe(true);
	});

	it('is false once that call was left, so a rejoin gets the check', () => {
		expect(isInCall({ callId: 'c1', state: 'left' }, 'c1')).toBe(false);
	});

	it('is false for another call or none', () => {
		expect(isInCall({ callId: 'c2', state: 'connected' }, 'c1')).toBe(
			false
		);
		expect(isInCall(null, 'c1')).toBe(false);
	});
});

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
