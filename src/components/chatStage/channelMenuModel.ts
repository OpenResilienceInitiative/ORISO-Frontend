/**
 * Pure model behind the channel menu card (T20, Figma "Menu" 9763:62964,
 * Frank's mockup "Abzweigungen zu diesem Gespräch / Ableitende Gespräche").
 *
 * One list for both hosts — the side-panel header and the FAB: the side
 * ROOMS first in a fixed order — supervision (⇧S), then the Teamberatung
 * (⇧T, Frank 09.09.) — then the threads ORDERED by their
 * most recent message but NUMBERED by their root message (review v6:
 * "Thread #1" and ⇧1 keep meaning the thread that was started first, no
 * matter which one got the latest reply), each with a one-line
 * "Author: text…" preview. Keyboard helpers for the roving focus and the
 * shortcuts live here too, so the component only renders and dispatches.
 *
 * No React, no DOM, no i18n — labels are the component's business.
 */
import type {
	SecondaryChannel,
	SecondaryChannelKind,
	SecondaryChannelLastMessage
} from './channelSwitcherState';

/**
 * The side rooms in their fixed card order. A thread is not one of these:
 * it lives in the main room and is numbered, not named.
 */
export const SIDE_ROOM_KINDS = ['supervision', 'team'] as const;
export type SideRoomKind = (typeof SIDE_ROOM_KINDS)[number];

export const isSideRoomKind = (
	kind: SecondaryChannelKind
): kind is SideRoomKind =>
	(SIDE_ROOM_KINDS as readonly string[]).includes(kind);

/** Longest preview text (characters, ellipsis included). */
export const CHANNEL_MENU_PREVIEW_MAX = 80;

export interface ChannelMenuPreview {
	author: string;
	text: string;
}

export interface ChannelMenuRow {
	id: string;
	kind: SecondaryChannelKind;
	/** Given label of the channel (fallback when the host has no i18n). */
	label: string;
	/**
	 * Stable 1-based number by root message (creation order); `null` for
	 * the supervision chat. Not the row position — rows sort by recency.
	 */
	threadNumber: number | null;
	/** "⇧S", "⇧1" … "⇧9"; empty when no shortcut exists. */
	shortcut: string;
	preview: ChannelMenuPreview | null;
	unread: number;
	active: boolean;
}

const collapse = (value: string) => value.replace(/\s+/g, ' ').trim();

const clampUnread = (value?: number): number =>
	Number.isFinite(value) && (value as number) > 0
		? Math.round(value as number)
		: 0;

export const formatChannelPreview = (
	lastMessage: SecondaryChannelLastMessage | undefined,
	max: number = CHANNEL_MENU_PREVIEW_MAX
): ChannelMenuPreview | null => {
	if (!lastMessage) {
		return null;
	}
	const author = collapse(lastMessage.author ?? '');
	let text = collapse(lastMessage.text ?? '');
	if (!author && !text) {
		return null;
	}
	if (text.length > max) {
		text = `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
	}
	return { author, text };
};

const SHORTCUT_MAX_THREADS = 9;

export const threadShortcut = (threadNumber: number): string =>
	threadNumber >= 1 && threadNumber <= SHORTCUT_MAX_THREADS
		? `⇧${threadNumber}`
		: '';

export const SUPERVISION_SHORTCUT = '⇧S';
export const TEAM_SHORTCUT = '⇧T';

/** One shortcut per side room; the letter is also the key `resolveMenuShortcut` reads. */
export const SIDE_ROOM_SHORTCUT: Record<SideRoomKind, string> = {
	supervision: SUPERVISION_SHORTCUT,
	team: TEAM_SHORTCUT
};

const SIDE_ROOM_SHORTCUT_KEY: Record<SideRoomKind, string> = {
	supervision: 's',
	team: 't'
};

const lastMessageTs = (channel: SecondaryChannel): number =>
	Number.isFinite(channel.lastMessage?.ts)
		? (channel.lastMessage!.ts as number)
		: Number.NEGATIVE_INFINITY;

const createdTs = (channel: SecondaryChannel): number =>
	Number.isFinite(channel.createdTs)
		? (channel.createdTs as number)
		: Number.POSITIVE_INFINITY;

/**
 * Stable numbers: threads sorted by their root message, oldest = #1;
 * threads without `createdTs` follow in the given order.
 */
export const numberThreads = (
	channels: SecondaryChannel[]
): Map<string, number> => {
	const ordered = channels
		.filter((channel) => channel.kind === 'thread')
		.map((channel, index) => ({ channel, index }))
		.sort(
			(a, b) =>
				createdTs(a.channel) - createdTs(b.channel) || a.index - b.index
		);
	return new Map(
		ordered.map(({ channel }, position) => [channel.id, position + 1])
	);
};

export const buildChannelMenu = (
	channels: SecondaryChannel[],
	activeChannelId?: string
): ChannelMenuRow[] => {
	// Side rooms lead the card in ONE fixed order (supervision, then the
	// Teamberatung) — unlike the threads they never re-sort by recency, so a
	// row never moves under the pointer while a message arrives.
	const sideRooms = SIDE_ROOM_KINDS.flatMap((kind) =>
		channels.filter((channel) => channel.kind === kind)
	);
	const numbers = numberThreads(channels);
	// Most recent message first; threads without one keep their given
	// order at the end (stable sort on a decorated index).
	const threads = channels
		.filter((channel) => channel.kind === 'thread')
		.map((channel, index) => ({ channel, index }))
		.sort(
			(a, b) =>
				lastMessageTs(b.channel) - lastMessageTs(a.channel) ||
				a.index - b.index
		)
		.map(({ channel }) => channel);

	const row = (
		channel: SecondaryChannel,
		threadNumber: number | null
	): ChannelMenuRow => ({
		id: channel.id,
		kind: channel.kind,
		label: channel.label,
		threadNumber,
		shortcut: isSideRoomKind(channel.kind)
			? SIDE_ROOM_SHORTCUT[channel.kind]
			: threadNumber === null
				? ''
				: threadShortcut(threadNumber),
		preview: formatChannelPreview(channel.lastMessage),
		unread: clampUnread(channel.unread),
		active: activeChannelId !== undefined && channel.id === activeChannelId
	});

	return [
		...sideRooms.map((channel) => row(channel, null)),
		...threads.map((channel) => row(channel, numbers.get(channel.id)!))
	];
};

export interface MenuShortcutKey {
	key: string;
	code?: string;
	shiftKey: boolean;
	ctrlKey?: boolean;
	altKey?: boolean;
	metaKey?: boolean;
}

/**
 * ⇧S → supervision, ⇧T → Teamberatung, ⇧1…⇧9 → the n-th thread. Letters and
 * digits are read from the physical key (`code`) first: with shift held most
 * layouts turn "1" into "!" and the like.
 */
export const resolveMenuShortcut = (
	event: MenuShortcutKey,
	rows: ChannelMenuRow[]
): ChannelMenuRow | null => {
	if (!event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) {
		return null;
	}
	const code = event.code ?? '';
	const typed = event.key.toLowerCase();
	const sideRoom = SIDE_ROOM_KINDS.find(
		(kind) =>
			code === `Key${SIDE_ROOM_SHORTCUT_KEY[kind].toUpperCase()}` ||
			(!code.startsWith('Key') &&
				typed === SIDE_ROOM_SHORTCUT_KEY[kind])
	);
	if (sideRoom) {
		return rows.find((row) => row.kind === sideRoom) ?? null;
	}
	const digitFromCode = /^(?:Digit|Numpad)([1-9])$/.exec(code)?.[1];
	const digitFromKey = /^[1-9]$/.test(event.key) ? event.key : undefined;
	const digit = digitFromCode ?? digitFromKey;
	if (!digit) {
		return null;
	}
	const threadNumber = Number(digit);
	return rows.find((row) => row.threadNumber === threadNumber) ?? null;
};

/** Roving focus: ArrowDown/ArrowUp wrap, Home/End jump; anything else stays. */
export const moveMenuFocus = (
	current: number,
	key: string,
	count: number
): number => {
	if (count <= 0) {
		return 0;
	}
	// Below zero = nothing focused yet: the arrows enter at either end.
	const none = current < 0;
	const inRange = Math.min(Math.max(current, 0), count - 1);
	switch (key) {
		case 'ArrowDown':
			return none ? 0 : (inRange + 1) % count;
		case 'ArrowUp':
			return none ? count - 1 : (inRange - 1 + count) % count;
		case 'Home':
			return 0;
		case 'End':
			return count - 1;
		default:
			return inRange;
	}
};
