import { describe, expect, it } from 'vitest';
import { DEFAULT_NOTIFICATION_SETTINGS } from './model';
import {
	assetForEvent,
	createSoundThrottle,
	resolveEventSound,
	selectEventToAnnounce,
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
