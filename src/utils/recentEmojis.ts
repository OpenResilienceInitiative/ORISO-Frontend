/**
 * Recently used emojis, remembered per browser.
 *
 * The quick-reaction row in the message action menu and the composer's emoji
 * picker feed the same store, so an emoji picked anywhere is offered first
 * everywhere. Storage is localStorage only — emoji choices are user content and
 * must never reach server-visible state.
 */

const STORAGE_KEY = 'oriso.recentEmojis';

/** How many entries the quick row shows — Figma reaction row is six wide. */
export const RECENT_EMOJI_SLOTS = 6;

/** Shown until the user has reacted enough times to fill the row themselves. */
export const DEFAULT_QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

const readStored = (): string[] => {
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		if (!raw) {
			return [];
		}
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) {
			return [];
		}
		return parsed.filter(
			(entry): entry is string =>
				typeof entry === 'string' && entry.length > 0
		);
	} catch {
		// Private mode, quota, or a corrupt value must never break the menu.
		return [];
	}
};

/**
 * The emojis to offer in a quick row: the user's most recent picks first,
 * padded with the defaults so the row is always full and never jumps in width.
 */
export const getQuickEmojis = (
	slots: number = RECENT_EMOJI_SLOTS
): string[] => {
	const result: string[] = [];
	for (const emoji of [...readStored(), ...DEFAULT_QUICK_EMOJIS]) {
		if (result.length >= slots) {
			break;
		}
		if (!result.includes(emoji)) {
			result.push(emoji);
		}
	}
	return result;
};

/** Move `emoji` to the front of the recent list. */
export const rememberEmoji = (emoji: string): void => {
	if (!emoji) {
		return;
	}
	const next = [emoji, ...readStored().filter((entry) => entry !== emoji)]
		// Keep a little history beyond the visible row so that unreacting or
		// picking a one-off emoji does not immediately evict the regulars.
		.slice(0, RECENT_EMOJI_SLOTS * 3);
	try {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
	} catch {
		// Storing is best-effort; the row still works off the defaults.
	}
};
