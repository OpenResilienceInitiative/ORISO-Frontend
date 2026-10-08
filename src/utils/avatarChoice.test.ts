import { describe, expect, it } from 'vitest';
import { ALL_ANIMAL_FILES } from './pseudonymGenerator';
import {
	avatarFileOfId,
	avatarIdOfFile,
	chosenAvatarOf,
	COUNSELLOR_MOTIF_FILES
} from './avatarChoice';

describe('avatarChoice (#1240)', () => {
	it('maps the stored id to the app file and back', () => {
		expect(avatarFileOfId('magpie')).toBe('magpie.svg');
		// The app ships this one capitalised; Admin and the backend store `nightingale`.
		expect(avatarFileOfId('nightingale')).toBe('Nightingale.svg');
		expect(avatarIdOfFile('Nightingale.svg')).toBe('nightingale');
		expect(avatarFileOfId('unicorn')).toBeNull();
		expect(avatarFileOfId(null)).toBeNull();
	});

	it('offers counsellors exactly the Admin motif set', () => {
		expect(COUNSELLOR_MOTIF_FILES).not.toContain('crane.svg');
		expect(COUNSELLOR_MOTIF_FILES).toHaveLength(
			ALL_ANIMAL_FILES.length - 1
		);
	});

	it('reads an advice seeker animal and a counsellor motif', () => {
		expect(chosenAvatarOf({ avatarId: 'fox' })).toEqual({
			file: 'fox.svg',
			onPrimary: false
		});
		expect(chosenAvatarOf({ avatarKind: 'ICON', avatarId: 'fox' })).toEqual(
			{
				file: 'fox.svg',
				onPrimary: true
			}
		);
	});

	it('falls back to the default without a usable choice', () => {
		expect(chosenAvatarOf({})).toBeNull();
		expect(chosenAvatarOf(null)).toBeNull();
		expect(
			chosenAvatarOf({ avatarKind: 'INITIALS', avatarId: null })
		).toBeNull();
		expect(
			chosenAvatarOf({ avatarKind: 'ICON', avatarId: 'unicorn' })
		).toBeNull();
	});
});
