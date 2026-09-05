/**
 * Pure state behind the channel-switcher FAB (Figma "FAB menu" 9748:60084).
 *
 * The FAB sits bottom-right above the composer and represents every
 * *secondary* channel of the open conversation: the supervision side room
 * and any open threads. It is grey while everything is read, takes the
 * unread/error role as soon as one channel has new messages, and becomes a
 * speed-dial menu once there is more than one channel to switch to.
 *
 * No React, no DOM — the component only renders what this returns.
 */
import { buildChannelMenu } from './channelMenuModel';

export type SecondaryChannelKind = 'supervision' | 'thread';

/** T20: the newest message of a channel — orders the threads, feeds the preview. */
export interface SecondaryChannelLastMessage {
	/** Display name of the author ("Elena P."). */
	author: string;
	/** Plain text of the message (already free of markup). */
	text: string;
	/** Epoch milliseconds. */
	ts: number;
}

export interface SecondaryChannel {
	id: string;
	kind: SecondaryChannelKind;
	/** Already resolved label (see `resolveChannelLabel`). */
	label: string;
	unread?: number;
	lastMessage?: SecondaryChannelLastMessage;
}

export interface ChannelSwitcherItem {
	id: string;
	kind: SecondaryChannelKind;
	label: string;
	unread: number;
}

export type ChannelSwitcherVariant = 'idle' | 'attention';
export type ChannelSwitcherMode = 'single' | 'menu';

export interface ChannelSwitcherState {
	/** `attention` = at least one channel carries unread messages. */
	variant: ChannelSwitcherVariant;
	/** `menu` = speed dial with one segment per channel. */
	mode: ChannelSwitcherMode;
	/** Top-to-bottom order of the menu: supervision first, then threads by recency (T20). */
	items: ChannelSwitcherItem[];
	totalUnread: number;
	/** Glyph on the closed FAB: the channel needing attention, else the first. */
	iconKind: SecondaryChannelKind | null;
}

const clampUnread = (value?: number): number =>
	Number.isFinite(value) && (value as number) > 0
		? Math.round(value as number)
		: 0;

export const deriveChannelSwitcherState = (
	channels: SecondaryChannel[]
): ChannelSwitcherState => {
	const normalised: ChannelSwitcherItem[] = channels.map((channel) => ({
		id: channel.id,
		kind: channel.kind,
		label: channel.label,
		unread: clampUnread(channel.unread)
	}));

	// T20: one order for every host — the supervision chat first, then the
	// threads by their most recent message (`channelMenuModel`).
	const order = new Map(
		buildChannelMenu(channels).map((row, index) => [row.id, index])
	);
	const items = [...normalised].sort(
		(a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)
	);

	const totalUnread = items.reduce((sum, item) => sum + item.unread, 0);
	const attention = items.find((item) => item.unread > 0);

	return {
		variant: totalUnread > 0 ? 'attention' : 'idle',
		mode: items.length > 1 ? 'menu' : 'single',
		items,
		totalUnread,
		iconKind: (attention ?? items[0])?.kind ?? null
	};
};

export type ChannelLabelMode = 'topic' | 'person';

export interface ChannelLabelSource {
	kind: SecondaryChannelKind;
	/** "Supervision" / the thread's root excerpt. */
	topic?: string;
	/** Supervisor name / thread author. */
	person?: string;
}

/**
 * Open question from Frank (04.09.): should the switcher say "Supervision"
 * (topic) or "Bettina B." (person)? Both are built from the same source so
 * the stories can show them side by side.
 */
export const resolveChannelLabel = (
	source: ChannelLabelSource,
	mode: ChannelLabelMode
): string => {
	const topic = source.topic?.trim() ?? '';
	const person = source.person?.trim() ?? '';
	if (mode === 'person') {
		return person || topic;
	}
	return topic || person;
};
