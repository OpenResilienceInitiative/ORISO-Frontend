/**
 * A toolbar that scrolls sideways instead of wrapping (T22) — the pure
 * rules (review v6):
 *
 * - `overflowEdges` says on which side content is hidden, so the bar can
 *   fade that edge (a cut icon reads as "there is more", not as a bug);
 * - `wheelToHorizontal` turns a mouse's vertical wheel into sideways
 *   travel: without it desktop mouse users reach the last icon only with
 *   Shift+wheel. Trackpad and Shift+wheel already scroll sideways and are
 *   left to the browser.
 */
export interface ScrollMetrics {
	scrollLeft: number;
	scrollWidth: number;
	clientWidth: number;
}

export interface OverflowEdges {
	start: boolean;
	end: boolean;
}

/** Sub-pixel scroll positions must not flicker the fade on and off. */
const EDGE_TOLERANCE = 1;

export const overflowEdges = ({
	scrollLeft,
	scrollWidth,
	clientWidth
}: ScrollMetrics): OverflowEdges => {
	const hidden = scrollWidth - clientWidth;
	if (hidden <= EDGE_TOLERANCE) {
		return { start: false, end: false };
	}
	return {
		start: scrollLeft > EDGE_TOLERANCE,
		end: scrollLeft < hidden - EDGE_TOLERANCE
	};
};

export interface WheelInput {
	deltaX: number;
	deltaY: number;
	shiftKey?: boolean;
	/** 0 = pixels, 1 = lines, 2 = pages (`WheelEvent.deltaMode`). */
	deltaMode?: number;
}

const LINE_HEIGHT_PX = 16;
const PAGE_WIDTH_PX = 280;

/**
 * Wheel travel in pixels, whatever unit the device reports (`deltaMode`
 * 0 = pixels, 1 = lines, 2 = pages). Shared by this toolbar and the chat
 * dock's wheel forwarding (`session/composerWheel.ts`, #2513).
 */
export const wheelDeltaPx = (
	delta: number,
	deltaMode: number,
	pageSize: number
): number =>
	deltaMode === 1
		? delta * LINE_HEIGHT_PX
		: deltaMode === 2
			? delta * pageSize
			: delta;

/** Sideways travel to apply, or `null` to leave the event to the browser. */
export const wheelToHorizontal = ({
	deltaX,
	deltaY,
	shiftKey = false,
	deltaMode = 0
}: WheelInput): number | null => {
	if (shiftKey || deltaX !== 0 || deltaY === 0) {
		return null;
	}
	return wheelDeltaPx(deltaY, deltaMode, PAGE_WIDTH_PX);
};

/**
 * Whether a scroller at `position` (of `total`, showing `visible`) can still
 * move in the direction of `delta`. Works for either axis.
 */
export const canScrollAlong = (
	position: number,
	total: number,
	visible: number,
	delta: number
): boolean =>
	delta > 0
		? position + visible < total - EDGE_TOLERANCE
		: position > EDGE_TOLERANCE;

/** Whether the bar can still move in the direction of `delta`. */
export const canScrollBy = (
	{ scrollLeft, scrollWidth, clientWidth }: ScrollMetrics,
	delta: number
): boolean => canScrollAlong(scrollLeft, scrollWidth, clientWidth, delta);
