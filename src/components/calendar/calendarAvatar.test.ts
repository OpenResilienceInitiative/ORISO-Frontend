import { describe, expect, it } from 'vite-plus/test';
import { AVATAR_TONES, avatarToneClass, avatarToneOf } from './calendarAvatar';

describe('calendar avatar tones', () => {
	it('gives the same name the same tone every time', () => {
		expect(avatarToneOf('mutige_eule')).toBe(avatarToneOf('mutige_eule'));
	});

	it('stays within the six tones', () => {
		for (const name of ['A. Kaya', 'L. Meier', 'ruhiges_yak', '', 'Ö']) {
			const tone = avatarToneOf(name);
			expect(tone).toBeGreaterThanOrEqual(0);
			expect(tone).toBeLessThan(AVATAR_TONES);
		}
	});

	it('matches the prototype rule (sum of character codes modulo 6)', () => {
		// "ab" = 97 + 98 = 195, 195 % 6 = 3
		expect(avatarToneOf('ab')).toBe(3);
	});

	it('uses the primary colour for one’s own avatar', () => {
		expect(avatarToneClass('anything', true)).toBe('calAvatar--me');
		expect(avatarToneClass('ab')).toBe('calAvatar--tone-3');
	});
});
