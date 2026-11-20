/**
 * Avatar colours in the calendar (prototype v17, Frank 2026-11-15): every
 * person gets one of six deep tones, picked from the name, so the same
 * colleague or advice seeker has the same colour in the header, the people
 * bar, "Als Nächstes", the grid and the menus. "ich" is always the primary
 * colour. The tones live in calendar.styles.scss (`.calAvatar--tone-N`).
 */

import {
	type AvatarIdentity,
	chosenAvatarOf,
	counsellorChoiceOf
} from '../../utils/avatarChoice';
import type { CalendarPersonAvatar } from './calendarModel';
import { AVATAR_SIZES } from '../pseudonym/avatarSizes';

export const AVATAR_TONES = 6;

/** Same rule as the prototype: the sum of the character codes, modulo 6. */
export const avatarToneOf = (name: string): number =>
	[...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % AVATAR_TONES;

/** "A. Kaya" → "AK", "ruhiges_yak" → "RY". */
export const initialsOf = (name: string) =>
	name
		.split(/[\s._-]+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((part) => part[0]!.toUpperCase())
		.join('');

/** The modifier class for a person's avatar; `me` for one's own. */
export const avatarToneClass = (name: string, me = false): string =>
	me ? 'calAvatar--me' : `calAvatar--tone-${avatarToneOf(name)}`;

/** The part of a conversation list item a person's avatar is made from. */
export interface AvatarSessionItem {
	session?: {
		askerMatrixUserId?: string | null;
		consultantMatrixUserId?: string | null;
	} | null;
	user?: (AvatarIdentity & { username?: string | null }) | null;
	consultant?:
		| (AvatarIdentity & {
				id?: string | null;
				consultantId?: string | null;
				username?: string | null;
		  })
		| null;
}

/**
 * FE#2325: the avatar of the other person in a conversation, with the same
 * key and saved choice the conversation list passes to `UserAvatar`
 * (`SessionListItemComponent`). A counsellor sees the advice seeker; an
 * advice seeker sees the counsellor, on the counsellor rules.
 */
export const personAvatarOfSession = (
	item: AvatarSessionItem,
	consultantView: boolean
): CalendarPersonAvatar | undefined => {
	if (consultantView) {
		const username = item.user?.username;
		if (!username) return undefined;
		return {
			userId: item.session?.askerMatrixUserId || username,
			username,
			choice: chosenAvatarOf(item.user)
		};
	}
	const consultant = item.consultant;
	if (!consultant) return undefined;
	return {
		userId:
			item.session?.consultantMatrixUserId ||
			consultant.id ||
			consultant.consultantId ||
			'unknown',
		username: consultant.username ?? '',
		choice: counsellorChoiceOf(chosenAvatarOf(consultant))
	};
};

/**
 * Each appointment gets the avatar of its conversation; entries without
 * one stay the same object.
 */
export const withPersonAvatars = <
	E extends { sessionId?: number | null; avatar?: CalendarPersonAvatar }
>(
	entries: E[],
	conversations: { sessionId: number; avatar?: CalendarPersonAvatar }[]
): E[] => {
	const bySession = new Map(
		conversations
			.filter((c) => c.avatar)
			.map((c) => [c.sessionId, c.avatar as CalendarPersonAvatar])
	);
	if (bySession.size === 0) return entries;
	return entries.map((entry) => {
		const avatar =
			entry.sessionId != null
				? bySession.get(entry.sessionId)
				: undefined;
		return avatar ? { ...entry, avatar } : entry;
	});
};

/** The avatar dot of an entry too low for a full avatar (prototype v17). */
export const ENTRY_DOT_AVATAR_PX = 18;

/** An entry box's padding and border above and below its content. */
const ENTRY_BOX_CHROME_PX = 6;

/**
 * FE#2325: entries show the person at `AVATAR_SIZES.default` (32 px, the
 * nearest avatar size of at least 30 px) wherever it fits: every list row
 * and every time-grid box high enough for it at the current zoom. A short
 * box and the month's one-line entries keep the 18 px dot, which a 32 px
 * avatar would be cut off in.
 */
export const entryAvatarSize = (
	view: 'list' | 'timeGrid' | 'dayGrid',
	minutes: number,
	slotPx: number
): number => {
	if (view === 'list') return AVATAR_SIZES.default;
	if (view === 'dayGrid') return ENTRY_DOT_AVATAR_PX;
	const boxPx = (minutes / 30) * slotPx;
	return boxPx - ENTRY_BOX_CHROME_PX >= AVATAR_SIZES.default
		? AVATAR_SIZES.default
		: ENTRY_DOT_AVATAR_PX;
};
