import { describe, expect, it } from 'vitest';
import {
	counsellorInitials,
	counsellorMotifFile,
	hasCounsellorAvatar,
	resolveCounsellorAvatarKind
} from './counsellorAvatar';

describe('hasCounsellorAvatar', () => {
	it('is true only for a real choice', () => {
		expect(
			hasCounsellorAvatar({ avatarKind: 'ICON', avatarId: 'fox' })
		).toBe(true);
		expect(hasCounsellorAvatar({ avatarKind: 'INITIALS' })).toBe(true);
	});

	it('is false for a consultant who never chose — no regression', () => {
		expect(hasCounsellorAvatar({})).toBe(false);
		expect(hasCounsellorAvatar({ avatarKind: null })).toBe(false);
	});

	it('is false for PICTURE until its upload ships (#1048/#1049)', () => {
		expect(hasCounsellorAvatar({ avatarKind: 'PICTURE' })).toBe(false);
	});
});

describe('resolveCounsellorAvatarKind', () => {
	it('paints the motif when one was chosen', () => {
		expect(
			resolveCounsellorAvatarKind({ avatarKind: 'ICON', avatarId: 'fox' })
		).toBe('ICON');
	});

	it('degrades an ICON without a motif id to initials', () => {
		expect(
			resolveCounsellorAvatarKind({ avatarKind: 'ICON', avatarId: '  ' })
		).toBe('INITIALS');
	});
});

describe('counsellorInitials', () => {
	it('prefers the public display name', () => {
		expect(
			counsellorInitials({
				displayName: 'Lena B.',
				firstName: 'Marie',
				lastName: 'Muster'
			})
		).toBe('LB');
	});

	it('falls back to first and last name, then the username', () => {
		expect(
			counsellorInitials({ firstName: 'Marie', lastName: 'Muster' })
		).toBe('MM');
		expect(counsellorInitials({ username: 'beraterin' })).toBe('B');
	});

	it('takes at most two letters and returns empty when nothing is known', () => {
		expect(counsellorInitials({ displayName: 'Anna Maria Lena' })).toBe(
			'AM'
		);
		expect(counsellorInitials({ displayName: '   ' })).toBe('');
	});
});

describe('counsellorMotifFile', () => {
	const FILES = ['fox.svg', 'bear.svg', 'Nightingale.svg'];

	it('resolves an id case-insensitively — the set is mixed-case on disk', () => {
		expect(counsellorMotifFile('fox', FILES)).toBe('fox.svg');
		expect(counsellorMotifFile('nightingale', FILES)).toBe(
			'Nightingale.svg'
		);
	});

	it('returns null for an id outside the set, so the caller shows initials', () => {
		expect(counsellorMotifFile('unicorn', FILES)).toBeNull();
		expect(counsellorMotifFile('', FILES)).toBeNull();
		expect(counsellorMotifFile(null, FILES)).toBeNull();
	});
});
