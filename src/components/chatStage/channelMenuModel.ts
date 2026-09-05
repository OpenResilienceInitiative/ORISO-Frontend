/**
 * Pure model behind the channel menu card (T20, Figma "Menu" 9763:62964,
 * Frank's mockup "Abzweigungen zu diesem Gespräch / Ableitende Gespräche").
 *
 * One list for both hosts — the side-panel header and the FAB: the
 * supervision chat always first (⇧S), then the threads numbered by their
 * most recent message (⇧1, ⇧2 …), each with a one-line "Author: text…"
 * preview of that message. Keyboard helpers for the roving focus and the
 * shortcuts live here too, so the component only renders and dispatches.
 *
 * No React, no DOM, no i18n — labels are the component's business.
 */
import type {
	SecondaryChannel,
	SecondaryChannelKind,
	SecondaryChannelLastMessage
} from './channelSwitcherState';

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
	/** 1-based position among the threads; `null` for the supervision chat. */
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

const lastMessageTs = (channel: SecondaryChannel): number =>
	Number.isFinite(channel.lastMessage?.ts)
		? (channel.lastMessage!.ts as number)
		: Number.NEGATIVE_INFINITY;

export const buildChannelMenu = (
	channels: SecondaryChannel[],
	activeChannelId?: string
): ChannelMenuRow[] => {
	const supervision = channels.filter(
		(channel) => channel.kind === 'supervision'
	);
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
		shortcut:
			threadNumber === null
				? SUPERVISION_SHORTCUT
				: threadShortcut(threadNumber),
		preview: formatChannelPreview(channel.lastMessage),
		unread: clampUnread(channel.unread),
		active: activeChannelId !== undefined && channel.id === activeChannelId
	});

	return [
		...supervision.map((channel) => row(channel, null)),
		...threads.map((channel, index) => row(channel, index + 1))
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
 * ⇧S → supervision, ⇧1…⇧9 → the n-th thread. Digits are read from the
 * physical key (`code`) first: with shift held most layouts turn "1" into
 * "!" and the like.
 */
export const resolveMenuShortcut = (
	event: MenuShortcutKey,
	rows: ChannelMenuRow[]
): ChannelMenuRow | null => {
	if (!event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) {
		return null;
	}
	const code = event.code ?? '';
	if (code === 'KeyS' || event.key.toLowerCase() === 's') {
		return rows.find((row) => row.kind === 'supervision') ?? null;
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
