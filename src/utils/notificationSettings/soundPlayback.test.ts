import { describe, expect, it } from 'vitest';
import { DEFAULT_NOTIFICATION_SETTINGS } from './model';
import {
	assetForEvent,
	createSoundThrottle,
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
