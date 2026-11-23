import { describe, expect, it } from 'vite-plus/test';
import {
	AVATAR_TONES,
	ENTRY_DOT_AVATAR_PX,
	avatarToneClass,
	avatarToneOf,
	entryAvatarSize,
	personAvatarOfSession,
	withPersonAvatars
} from './calendarAvatar';
import { AVATAR_SIZES } from '../pseudonym/avatarSizes';

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

describe('real avatars for calendar people (FE#2325)', () => {
	const sessionOf = (over: Record<string, unknown> = {}) => ({
		session: {
			id: 7,
			askerMatrixUserId: '@asker-7:oriso',
			consultantMatrixUserId: '@counsellor:oriso'
		},
		user: { username: 'mutige_eule', avatarId: 'magpie' },
		consultant: { id: 'c-1', consultantId: 'c-1', username: 'kaya' },
		...over
	});

	it('gives the advice seeker the inputs the conversation list hands UserAvatar', () => {
		expect(personAvatarOfSession(sessionOf(), true)).toEqual({
			userId: '@asker-7:oriso',
			username: 'mutige_eule',
			choice: { kind: 'animal', file: 'magpie.svg' }
		});
	});

	it('derives the animal from the username when the Matrix id is missing', () => {
		const item = sessionOf({
			session: { id: 7 },
			user: { username: 'mutige_eule' }
		});
		expect(personAvatarOfSession(item, true)).toEqual({
			userId: 'mutige_eule',
			username: 'mutige_eule',
			choice: null
		});
	});

	it('gives an advice seeker the counsellor, on the counsellor rules', () => {
		const item = sessionOf({
			user: undefined,
			consultant: {
				id: 'c-1',
				username: 'kaya',
				avatarKind: 'INITIALS'
			}
		});
		expect(personAvatarOfSession(item, false)).toEqual({
			userId: '@counsellor:oriso',
			username: 'kaya',
			choice: { kind: 'initials' }
		});
	});

	it('knows no avatar without a person', () => {
		expect(
			personAvatarOfSession({ session: { id: 7 } }, true)
		).toBeUndefined();
	});

	it('puts the conversation’s avatar on its appointments only', () => {
		const avatar = { userId: '@asker-7:oriso', username: 'mutige_eule' };
		const entries = [
			{ id: 'a', sessionId: 7 },
			{ id: 'b', sessionId: 8 },
			{ id: 'c' }
		];
		const out = withPersonAvatars(entries, [
			{ sessionId: 7, username: 'mutige_eule', avatar }
		]);
		expect(out[0]).toEqual({ id: 'a', sessionId: 7, avatar });
		expect(out[1]).toBe(entries[1]);
		expect(out[2]).toBe(entries[2]);
	});
});

describe('entry avatar size (FE#2325)', () => {
	it('is 32 px in every list row', () => {
		expect(entryAvatarSize('list', 15, 22)).toBe(AVATAR_SIZES.default);
	});

	it('is 32 px in a time-grid box with room for it', () => {
		// One hour at the starting zoom: 44 px high.
		expect(entryAvatarSize('timeGrid', 60, 22)).toBe(AVATAR_SIZES.default);
		// Half an hour from the 40 px zoom step on.
		expect(entryAvatarSize('timeGrid', 30, 40)).toBe(AVATAR_SIZES.default);
	});

	it('keeps the small dot where 32 px would be cut off', () => {
		// Half an hour at the starting zoom is 22 px high.
		expect(entryAvatarSize('timeGrid', 30, 22)).toBe(ENTRY_DOT_AVATAR_PX);
		// One hour at the smallest zoom is 36 px high.
		expect(entryAvatarSize('timeGrid', 60, 18)).toBe(ENTRY_DOT_AVATAR_PX);
		// The month has one line per entry.
		expect(entryAvatarSize('dayGrid', 120, 22)).toBe(ENTRY_DOT_AVATAR_PX);
	});
});
