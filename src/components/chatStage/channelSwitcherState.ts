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

export type SecondaryChannelKind = 'supervision' | 'thread';

export interface SecondaryChannel {
	id: string;
	kind: SecondaryChannelKind;
	/** Already resolved label (see `resolveChannelLabel`). */
	label: string;
	unread?: number;
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
	/** Top-to-bottom order of the speed dial; threads first, supervision last. */
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

	// Figma stacks the segments so the supervision entry is the one right
	// above the FAB; threads pile up on top in the order the caller gives.
	const items = [
		...normalised.filter((item) => item.kind === 'thread'),
		...normalised.filter((item) => item.kind === 'supervision')
	];

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
