/**
 * The closing animation (ORISO-Frontend#1737) is one design, the slide reveal:
 * a red sheet sweeps over the room and on across the destination. It goes
 * sideways where the room stands beside the brand stage, and upward on a phone
 * or a tablet, where the screen is one column.
 */
export const CLOSING_DIRECTIONS = ['horizontal', 'vertical'] as const;
export type ClosingDirection = (typeof CLOSING_DIRECTIONS)[number];

/** From this width on the waiting room stands beside the brand stage: "desktop". */
export const CLOSING_DESKTOP_MIN_WIDTH = 1200;

export const closingDirectionFor = (desktop: boolean): ClosingDirection =>
	desktop ? 'horizontal' : 'vertical';
