// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	DEFAULT_LOCAL_DEVICE_SETTINGS,
	DEFAULT_NOTIFICATION_SETTINGS
} from './model';
import { setKindField } from './notificationConfig';
import {
	__resetSharedAudioForTests,
	__resetSoundThrottlesForTests,
	createSoundThrottle,
	installAudioUnlock,
	playNotificationSound,
	selectEventToAnnounce,
	soundAssetFor
} from './soundPlayback';

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
		// mirror the real element: idle until play(), which keeps it "busy"
		paused = true;
		ended = false;
		constructor(src?: string) {
			this.src = src ?? '';
		}
		play() {
			this.paused = false;
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
		// keep specs order-independent: never leak the primed singleton
		__resetSharedAudioForTests();
		__resetSoundThrottlesForTests();
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

	// #586 audit: the ring is the most time-critical sound we have — neither a
	// preceding message tone's throttle window nor its element reuse may eat it.
	it('a message tone does NOT swallow a call ring in the same throttle window', () => {
		const t0 = nextNow();
		playNotificationSound(
			settingsWith('conversations', 'standard', 'ton-3', 0.5),
			DEFAULT_LOCAL_DEVICE_SETTINGS,
			'messages',
			'message.new',
			false,
			t0
		);
		// 100ms later — well inside the 2s gap — an incoming call arrives
		playNotificationSound(
			DEFAULT_NOTIFICATION_SETTINGS,
			DEFAULT_LOCAL_DEVICE_SETTINGS,
			'calls',
			'call.started',
			false,
			t0 + 100
		);
		expect(played).toHaveLength(2);
		expect(played[1].src).toContain('incomingCall');
	});

	it('still throttles a burst WITHIN one family', () => {
		const t0 = nextNow();
		const settings = settingsWith(
			'conversations',
			'standard',
			'ton-3',
			0.5
		);
		playNotificationSound(
			settings,
			DEFAULT_LOCAL_DEVICE_SETTINGS,
			'messages',
			'message.new',
			false,
			t0
		);
		playNotificationSound(
			settings,
			DEFAULT_LOCAL_DEVICE_SETTINGS,
			'messages',
			'message.new',
			false,
			t0 + 100
		);
		expect(played).toHaveLength(1);
	});

	it('never reassigns src on an element that is still playing', () => {
		// prime the shared element, then leave it "playing"
		const target = document.createElement('div');
		installAudioUnlock(target);
		target.dispatchEvent(new Event('pointerdown'));
		const primed = played.length;
		playNotificationSound(
			settingsWith('conversations', 'standard', 'ton-3', 0.5),
			DEFAULT_LOCAL_DEVICE_SETTINGS,
			'messages',
			'message.new',
			false,
			nextNow()
		);
		// a fresh element was used, so the in-flight (primed) sound survives
		expect(played).toHaveLength(primed + 1);
		expect(played[primed].src).toContain('ton-3');
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

describe('selectEventToAnnounce', () => {
	const unread = (id: string) => ({ id, readAt: null });
	const read = (id: string) => ({ id, readAt: '2026-01-01T00:00:00Z' });

	it('seeds the marker on first load without announcing backlog', () => {
		const { announce, nextMarker } = selectEventToAnnounce(
			[unread('b'), unread('a')],
			null
		);
		expect(announce).toBeNull();
		expect(nextMarker).toBe('b');
	});

	it('announces a genuinely newer unread top event and advances the marker', () => {
		const { announce, nextMarker } = selectEventToAnnounce(
			[unread('c'), unread('b'), unread('a')],
			'b'
		);
		expect(announce?.id).toBe('c');
		expect(nextMarker).toBe('c');
	});

	it('stays silent when the top event is unchanged', () => {
		const { announce, nextMarker } = selectEventToAnnounce(
			[unread('b'), unread('a')],
			'b'
		);
		expect(announce).toBeNull();
		expect(nextMarker).toBe('b');
	});

	// Regression (#576): reading the top event must not re-announce the older
	// unread now surfaced beneath it. Keying on the newest slot (feed[0]), not
	// the first unread, keeps it silent.
	it('does not announce backlog when the newest event is read', () => {
		const { announce, nextMarker } = selectEventToAnnounce(
			[read('b'), unread('a')],
			'b'
		);
		expect(announce).toBeNull();
		expect(nextMarker).toBe('b');
	});

	it('advances the marker without a sound for a new-but-already-read top event', () => {
		const { announce, nextMarker } = selectEventToAnnounce(
			[read('c'), unread('a')],
			'a'
		);
		expect(announce).toBeNull();
		expect(nextMarker).toBe('c');
	});
});
