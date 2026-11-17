/**
 * Avatar colours in the calendar (prototype v17, Frank 2026-11-15): every
 * person gets one of six deep tones, picked from the name, so the same
 * colleague or advice seeker has the same colour in the header, the people
 * bar, "Als Nächstes", the grid and the menus. "ich" is always the primary
 * colour. The tones live in calendar.styles.scss (`.calAvatar--tone-N`).
 */

export const AVATAR_TONES = 6;

/** Same rule as the prototype: the sum of the character codes, modulo 6. */
export const avatarToneOf = (name: string): number =>
	[...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % AVATAR_TONES;

/** The modifier class for a person's avatar; `me` for one's own. */
export const avatarToneClass = (name: string, me = false): string =>
	me ? 'calAvatar--me' : `calAvatar--tone-${avatarToneOf(name)}`;
