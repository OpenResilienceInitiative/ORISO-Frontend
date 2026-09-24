/**
 * Pure math behind `ResizableHandle` (list ↔ chat and, since T2, chat ↔
 * side panel). The handle sits on one edge of the element it resizes:
 *
 * - `anchor: 'end'`   — handle on the right edge, the element grows with
 *                       the pointer moving right (session list column);
 * - `anchor: 'start'` — handle on the left edge, the element grows with
 *                       the pointer moving left (side panel).
 */
import { SESSIONS_LIST_RESIZE } from './sessionsListResize.constants';

export type ResizeAnchor = 'start' | 'end';

export interface PointerWidthInput {
	clientX: number;
	/** Bounding box of the element being resized. */
	left: number;
	right: number;
	anchor: ResizeAnchor;
}

export const widthFromPointer = ({
	clientX,
	left,
	right,
	anchor
}: PointerWidthInput): number =>
	Math.round(anchor === 'start' ? right - clientX : clientX - left);

export const clampWidth = (width: number, minWidth: number, maxWidth: number) =>
	Math.min(Math.max(width, minWidth), maxWidth);

/**
 * Session-list rule: never strand the column in the truncated mid-range —
 * it is either the icon rail or at least the expanded minimum (Figma 115).
 */
export const snapSessionsListWidth = (
	width: number,
	minWidth: number,
	maxWidth: number
): number => {
	const {
		ICON_ONLY_THRESHOLD,
		SNAP_THRESHOLD,
		EXPANDED_MIN_WIDTH,
		EXPANDED_SNAP_THRESHOLD
	} = SESSIONS_LIST_RESIZE;
	let next = clampWidth(width, minWidth, maxWidth);
	if (next > minWidth && next < ICON_ONLY_THRESHOLD) {
		next = next < SNAP_THRESHOLD ? minWidth : ICON_ONLY_THRESHOLD;
	}
	if (next > ICON_ONLY_THRESHOLD && next < EXPANDED_MIN_WIDTH) {
		next =
			next < EXPANDED_SNAP_THRESHOLD
				? ICON_ONLY_THRESHOLD
				: EXPANDED_MIN_WIDTH;
	}
	return next;
};

export const getToggledSidebarWidth = (
	currentWidth: number,
	minWidth: number,
	expandedMinWidth: number
) => (currentWidth <= minWidth + 1 ? expandedMinWidth : minWidth);

/**
 * T5 / Frank (*****): "drag/halten macht das Einklappen". Pressing the handle
 * and holding still for this long toggles the pane (collapse ↔ expand);
 * moving the pointer beyond the tolerance first turns the press into a drag.
 */
export const HOLD_TO_COLLAPSE_MS = 450;
export const HOLD_TOLERANCE_PX = 4;

export const isHoldGesture = ({ movedPx }: { movedPx: number }): boolean =>
	movedPx < HOLD_TOLERANCE_PX;
