/**
 * Pure rules behind the side-panel header's channel menu (T15).
 *
 * With a panel open the FAB steps back, so the header's channel button is
 * the only way to jump between the session's secondary channels. The menu
 * therefore lists *every* secondary channel — threads and supervision —
 * marks the one on screen and stays enabled only while there is another
 * one to switch to. When the title column is tight (phone, narrow panel)
 * the channel word gives way to the participant count, like the room
 * header's "+N".
 *
 * No React, no DOM — `PanelHeader` only renders what this returns.
 */
import {
	deriveChannelSwitcherState,
	type ChannelSwitcherItem,
	type SecondaryChannel
} from './channelSwitcherState';
import { numberThreads } from './channelMenuModel';

export interface PanelChannelMenuItem extends ChannelSwitcherItem {
	/** The channel currently shown in the panel. */
	active: boolean;
}

export interface PanelChannelMenu {
	items: PanelChannelMenuItem[];
	activeId?: string;
	/** At least one channel other than the shown one exists. */
	switchable: boolean;
}

export const derivePanelChannelMenu = (
	channels: SecondaryChannel[],
	activeChannelId?: string
): PanelChannelMenu => {
	const items = deriveChannelSwitcherState(channels).items.map((item) => ({
		...item,
		active: item.id === activeChannelId
	}));
	return {
		items,
		activeId: activeChannelId,
		switchable: items.some((item) => !item.active)
	};
};

/**
 * T26: the channel word under the hairline names the shown thread with
 * the SAME stable number the channel card uses ("Thread #2" here means
 * "Thread #2" in the card and ⇧2 on the keyboard). `null` for the
 * supervision chat or when the shown channel is not a listed thread.
 */
export const resolveActiveThreadNumber = (
	channels: SecondaryChannel[],
	activeChannelId?: string
): number | null => {
	if (!activeChannelId) {
		return null;
	}
	return numberThreads(channels).get(activeChannelId) ?? null;
};

/**
 * Below this width of the title column the label gives way to the
 * participant count: "Supervision" in label/medium is ~78 px, the icon 16 px
 * plus gap — 120 px keeps the word from being cut mid-way on a phone.
 */
export const PANEL_KIND_LABEL_MIN_WIDTH = 120;

export type PanelKindLabelMode = 'label' | 'count';

export interface PanelKindLabelInput {
	/** Measured width of the title column; `null` before the first measure. */
	titleWidth: number | null;
	label: string;
	participantCount: number;
}

export interface PanelKindLabel {
	mode: PanelKindLabelMode;
	text: string;
}

export const resolvePanelKindLabel = ({
	titleWidth,
	label,
	participantCount
}: PanelKindLabelInput): PanelKindLabel => {
	if (
		titleWidth !== null &&
		Number.isFinite(titleWidth) &&
		titleWidth < PANEL_KIND_LABEL_MIN_WIDTH &&
		participantCount > 0
	) {
		return { mode: 'count', text: String(participantCount) };
	}
	return { mode: 'label', text: label };
};
