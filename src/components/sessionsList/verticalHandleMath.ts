/**
 * Pure math for the vertical `ResizableHandle` (drag axis = Y): the handle
 * sits on the bottom edge of the area it reveals — the chat-history "future"
 * above the "Jetzt" line — and its height snaps to a few resting points.
 */

/** Largest overshoot (px) a drag may show past the last item before it springs back. */
export const RUBBER_BAND_MAX_PX = 32;
const RUBBER_BAND_RESISTANCE = 0.25;

/** Height of the area for a pointer at `clientY`, handle on the area's bottom edge. */
export const heightFromPointerY = (clientY: number, top: number): number =>
	Math.round(clientY - top);

export const clampReveal = (height: number, maxHeight: number): number =>
	Math.min(Math.max(height, 0), Math.max(0, maxHeight));

/**
 * What a drag shows: the true height up to `maxHeight`, then a stretched
 * 25 % of the excess (never more than `RUBBER_BAND_MAX_PX`). Releasing snaps
 * back, so the area can never be pulled past the last appointment.
 */
export const rubberBand = (height: number, maxHeight: number): number => {
	if (height <= 0) return 0;
	if (height <= maxHeight) return height;
	return (
		maxHeight +
		Math.min(
			RUBBER_BAND_MAX_PX,
			(height - maxHeight) * RUBBER_BAND_RESISTANCE
		)
	);
};

/**
 * Resting points: closed, one item, half the list, almost all of it. Points
 * the content cannot fill are dropped; the content height itself is the last
 * stop, so one single appointment ends the area right after it.
 */
export const revealSnapPoints = ({
	itemHeight,
	listHeight,
	contentHeight
}: {
	itemHeight: number;
	listHeight: number;
	contentHeight: number;
}): number[] => {
	if (contentHeight <= 0) return [0];
	const raw = [0, itemHeight, listHeight * 0.5, listHeight * 0.85]
		.map((point) => Math.round(point))
		.filter((point) => point < contentHeight);
	return [...new Set([...raw, Math.round(contentHeight)])].sort(
		(a, b) => a - b
	);
};

export const nearestSnap = (height: number, points: number[]): number =>
	points.reduce(
		(best, point) =>
			Math.abs(point - height) < Math.abs(best - height) ? point : best,
		points[0] ?? 0
	);

/** Next resting point below / above `height` (keyboard Up/Down). */
export const stepSnap = (
	height: number,
	points: number[],
	direction: 1 | -1
): number => {
	if (direction === 1) return points.find((p) => p > height) ?? height;
	return [...points].reverse().find((p) => p < height) ?? height;
};
