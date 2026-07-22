// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	DEFAULT_LOCAL_DEVICE_SETTINGS,
	DEFAULT_NOTIFICATION_SETTINGS
} from './model';
import { setKindField } from './notificationConfig';
import {
	assetForEvent,
	createSoundThrottle,
	installAudioUnlock,
	playNotificationSound,
	resolveEventSound,
	soundAssetFor
} from './soundPlayback';

const withSounds = (message: any, mention: any) => ({
	...DEFAULT_NOTIFICATION_SETTINGS,
	sounds: { message, mention }
});

describe('resolveEventSound', () => {
	it('uses the message slot for non-mentions', () => {
		expect(resolveEventSound(withSounds('ding', 'soft'), false)).toBe(
			'ding'
		);
	});

	it('uses the mention slot for mentions', () => {
		expect(resolveEventSound(withSounds('ding', 'soft'), true)).toBe(
			'soft'
		);
	});

	it("mention 'default' inherits the message slot", () => {
		expect(resolveEventSound(withSounds('chime', 'default'), true)).toBe(
			'chime'
		);
	});
});

describe('soundAssetFor', () => {
	it('none and default are silent', () => {
		expect(soundAssetFor('none')).toBeNull();
		expect(soundAssetFor('default')).toBeNull();
	});

	it('chime/ding/soft resolve to an asset', () => {
		expect(soundAssetFor('chime')).toBeTruthy();
		expect(soundAssetFor('ding')).toBeTruthy();
		expect(soundAssetFor('soft')).toBeTruthy();
	});
});

describe('assetForEvent', () => {
	it('calls family uses its own call sound regardless of the message slot', () => {
		const asset = assetForEvent(withSounds('none', 'none'), 'calls', false);
		expect(asset).toBeTruthy();
	});

	it('a muted message slot yields silence for message events', () => {
		expect(
			assetForEvent(withSounds('none', 'default'), 'messages', false)
		).toBeNull();
	});
});

describe('createSoundThrottle', () => {
	it('plays the first, suppresses within the gap, plays again after it', () => {
		const shouldPlay = createSoundThrottle(2000);
		expect(shouldPlay(0)).toBe(true);
		expect(shouldPlay(500)).toBe(false);
		expect(shouldPlay(1999)).toBe(false);
		expect(shouldPlay(2000)).toBe(true);
	});
});

/* ------------------------------------------------------------------ *
 * #576 — event playback driven by the config dialog (area×kind incl.
 * volume), plus the Safari audio unlock.
 * ------------------------------------------------------------------ */

describe('playNotificationSound (config-driven)', () => {
	const played: Array<{ src: string; volume: number }> = [];
	// far apart so the module-level 2s throttle never interferes
	let now = 1_000_000;
	const nextNow = () => (now += 10_000);

	class FakeAudio {
		src: string;
		volume = 1;
		muted = false;
		constructor(src?: string) {
			this.src = src ?? '';
		}
		play() {
			played.push({ src: this.src, volume: this.volume });
			return Promise.resolve();
		}
	}

	beforeEach(() => {
		played.length = 0;
		vi.stubGlobal('Audio', FakeAudio);
	});
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	const settingsWith = (
		area: 'requests' | 'conversations',
		kind: 'new' | 'standard' | 'mention',
		sound: string,
		volume: number
	) => ({
		...DEFAULT_NOTIFICATION_SETTINGS,
		notificationConfig: setKindField(
			setKindField(
				DEFAULT_NOTIFICATION_SETTINGS.notificationConfig,
				area,
				kind,
				'sound',
				sound as never
			),
			area,
			kind,
			'volume',
			volume
		)
	});

	it('plays the configured tone at the configured volume', () => {
		playNotificationSound(
			settingsWith('requests', 'new', 'ton-2', 0.75),
			DEFAULT_LOCAL_DEVICE_SETTINGS,
			'requests',
			'request.new',
			false,
			nextNow()
		);
		expect(played).toHaveLength(1);
		expect(played[0].volume).toBe(0.75);
		expect(played[0].src).toContain('ton-2');
	});

	it('a mention uses the mention row of the conversations area', () => {
		playNotificationSound(
			settingsWith('conversations', 'mention', 'ton-9', 1),
			DEFAULT_LOCAL_DEVICE_SETTINGS,
			'messages',
			'message.new',
			true,
			nextNow()
		);
		expect(played).toHaveLength(1);
		expect(played[0].src).toContain('ton-9');
		expect(played[0].volume).toBe(1);
	});

	it('stays silent when the configured kind has no sound', () => {
		playNotificationSound(
			DEFAULT_NOTIFICATION_SETTINGS, // every kind defaults to none
			DEFAULT_LOCAL_DEVICE_SETTINGS,
			'messages',
			'message.new',
			false,
			nextNow()
		);
		expect(played).toHaveLength(0);
	});

	it('stays silent under global mute even with a configured tone', () => {
		playNotificationSound(
			{
				...settingsWith('requests', 'new', 'ton-2', 0.5),
				globalMute: true
			},
			DEFAULT_LOCAL_DEVICE_SETTINGS,
			'requests',
			'request.new',
			false,
			nextNow()
		);
		expect(played).toHaveLength(0);
	});

	it('calls family rings the dedicated call sound', () => {
		playNotificationSound(
			DEFAULT_NOTIFICATION_SETTINGS,
			DEFAULT_LOCAL_DEVICE_SETTINGS,
			'calls',
			'call.started',
			false,
			nextNow()
		);
		expect(played).toHaveLength(1);
		expect(played[0].src).toContain('incomingCall');
	});

	it('installAudioUnlock primes a shared element on the first gesture', () => {
		const target = document.createElement('div');
		const remove = installAudioUnlock(target);
		expect(played).toHaveLength(0);
		target.dispatchEvent(new Event('pointerdown'));
		expect(played).toHaveLength(1);
		expect(played[0].src).toContain('data:audio/wav');
		// second gesture does not prime again
		target.dispatchEvent(new Event('pointerdown'));
		expect(played).toHaveLength(1);
		remove();
	});
});
