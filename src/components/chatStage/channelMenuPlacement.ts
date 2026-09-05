/**
 * Where the channel card opens and how tall it may be (review v6, T20).
 *
 * The card sits next to an anchor — below the panel header, above the FAB
 * — inside some bounds: the chat card / panel for an absolute FAB, the
 * viewport for a fixed one, the space above the docked composer for the
 * header. It takes the room on its preferred side; when that room is too
 * small it flips to the other side if that one is larger (FAB only — the
 * header card never opens over the title) and otherwise clamps, so the
 * row list scrolls inside instead of the card being cut or sliding
 * behind the composer. Pure numbers in one coordinate space; the hook
 * `useChannelMenuPlacement` measures the DOM and feeds it.
 */
export type ChannelMenuSide = 'up' | 'down';

export interface ChannelMenuSpace {
	anchorTop: number;
	anchorBottom: number;
	boundsTop: number;
	boundsBottom: number;
	/** Natural (unclamped) height of the card. */
	needed: number;
	/** Space kept between anchor and card. Default 4 px. */
	gap?: number;
	prefer: ChannelMenuSide;
	/** May the card change side? Default true. */
	flip?: boolean;
}

export interface ChannelMenuPlacement {
	side: ChannelMenuSide;
	maxHeight: number;
}

/** Header + separator + one and a half rows — below that the card is useless. */
export const CHANNEL_MENU_MIN_HEIGHT = 192;

export const CHANNEL_MENU_GAP = 4;

export const placeChannelMenu = ({
	anchorTop,
	anchorBottom,
	boundsTop,
	boundsBottom,
	needed,
	gap = CHANNEL_MENU_GAP,
	prefer,
	flip = true
}: ChannelMenuSpace): ChannelMenuPlacement => {
	const room: Record<ChannelMenuSide, number> = {
		up: Math.floor(anchorTop - boundsTop - gap),
		down: Math.floor(boundsBottom - anchorBottom - gap)
	};
	const other: ChannelMenuSide = prefer === 'up' ? 'down' : 'up';
	const side =
		flip && room[prefer] < needed && room[other] > room[prefer]
			? other
			: prefer;
	return {
		side,
		maxHeight: Math.max(CHANNEL_MENU_MIN_HEIGHT, room[side])
	};
};
