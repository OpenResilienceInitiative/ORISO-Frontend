import { describe, expect, it } from 'vitest';
import { ALL_ANIMAL_FILES } from './pseudonymGenerator';
import {
	avatarFileOfId,
	avatarIdOfFile,
	chosenAvatarOf,
	counsellorChoiceOf,
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
			kind: 'animal'
		});
		expect(chosenAvatarOf({ avatarKind: 'ICON', avatarId: 'fox' })).toEqual(
			{
				file: 'fox.svg',
				kind: 'motif'
			}
		);
	});

	it('falls back to the default without a usable choice', () => {
		expect(chosenAvatarOf({})).toBeNull();
		expect(chosenAvatarOf(null)).toBeNull();
		expect(
			chosenAvatarOf({ avatarKind: 'INITIALS', avatarId: null })
		).toEqual({ kind: 'initials' });
		expect(
			chosenAvatarOf({ avatarKind: 'ICON', avatarId: 'unicorn' })
		).toEqual({ kind: 'initials' });
		expect(
			chosenAvatarOf({ avatarKind: 'PICTURE', avatarId: 'picture-1' })
		).toBeNull();
	});
});

describe('counsellorChoiceOf', () => {
	it('keeps a chosen motif and explicit initials', () => {
		expect(counsellorChoiceOf({ kind: 'motif', file: 'fox.svg' })).toEqual({
			kind: 'motif',
			file: 'fox.svg'
		});
		expect(counsellorChoiceOf({ kind: 'initials' })).toEqual({
			kind: 'initials'
		});
	});

	it('shows a counsellor without any choice on the primary pair as initials', () => {
		expect(counsellorChoiceOf(null)).toEqual({ kind: 'initials' });
		expect(counsellorChoiceOf(undefined)).toEqual({ kind: 'initials' });
	});

	it('moves a legacy animal pick onto the primary pair, keeping the icon', () => {
		expect(counsellorChoiceOf({ kind: 'animal', file: 'fox.svg' })).toEqual(
			{
				kind: 'motif',
				file: 'fox.svg'
			}
		);
	});

	it('never offers the crane, which is outside the counsellor motif set', () => {
		expect(
			counsellorChoiceOf({ kind: 'animal', file: 'crane.svg' })
		).toEqual({ kind: 'initials' });
	});
});
