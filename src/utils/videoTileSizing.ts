/**
 * Pure layout helpers for video call stage sizing.
 * Used by FloatingCallWidget / GroupCallWidget — no DOM dependency.
 */

export type Size = { width: number; height: number };

export type StageBounds = {
	minWidth: number;
	minHeight: number;
	maxWidth: number;
	maxHeight: number;
};

const DEFAULT_ASPECT = 16 / 9;

/** Prefer intrinsic track ratio; fall back when metadata is missing. */
export function normalizeAspectRatio(
	videoWidth: number,
	videoHeight: number,
	fallback: number = DEFAULT_ASPECT
): number {
	if (
		!Number.isFinite(videoWidth) ||
		!Number.isFinite(videoHeight) ||
		videoWidth <= 0 ||
		videoHeight <= 0
	) {
		return fallback;
	}
	return videoWidth / videoHeight;
}

/**
 * Letterbox a content box inside a container (object-fit: contain math).
 * Returns the drawn size and top-left offset within the container.
 */
export function computeContainFit(
	contentWidth: number,
	contentHeight: number,
	containerWidth: number,
	containerHeight: number
): Size & { x: number; y: number } {
	if (
		contentWidth <= 0 ||
		contentHeight <= 0 ||
		containerWidth <= 0 ||
		containerHeight <= 0
	) {
		return { width: 0, height: 0, x: 0, y: 0 };
	}

	const contentAspect = contentWidth / contentHeight;
	const containerAspect = containerWidth / containerHeight;

	let width: number;
	let height: number;
	if (contentAspect > containerAspect) {
		width = containerWidth;
		height = containerWidth / contentAspect;
	} else {
		height = containerHeight;
		width = containerHeight * contentAspect;
	}

	return {
		width,
		height,
		x: (containerWidth - width) / 2,
		y: (containerHeight - height) / 2
	};
}

/**
 * Clamp a stage size to bounds while preserving aspect ratio.
 * Prefers the proposed width when both axes would clamp.
 */
export function clampStageSize(
	proposed: Size,
	bounds: StageBounds,
	aspectRatio: number
): Size {
	const aspect =
		Number.isFinite(aspectRatio) && aspectRatio > 0
			? aspectRatio
			: DEFAULT_ASPECT;

	let width = Math.max(
		bounds.minWidth,
		Math.min(bounds.maxWidth, proposed.width)
	);
	let height = width / aspect;

	if (height > bounds.maxHeight) {
		height = bounds.maxHeight;
		width = height * aspect;
	}
	if (height < bounds.minHeight) {
		height = bounds.minHeight;
		width = height * aspect;
	}

	// Re-clamp width after height-driven adjustments
	if (width > bounds.maxWidth) {
		width = bounds.maxWidth;
		height = width / aspect;
	}
	if (width < bounds.minWidth) {
		width = bounds.minWidth;
		height = width / aspect;
	}

	// Final hard clamp if aspect cannot satisfy both mins (degenerate bounds)
	width = Math.max(bounds.minWidth, Math.min(bounds.maxWidth, width));
	height = Math.max(bounds.minHeight, Math.min(bounds.maxHeight, height));

	return { width: Math.round(width), height: Math.round(height) };
}

/**
 * Optimal stage size: fit preferred box inside available space, keep aspect.
 * If preferred is omitted, uses the largest box that fits max bounds.
 */
export function getAutoFitStageSize(options: {
	aspectRatio: number;
	maxWidth: number;
	maxHeight: number;
	preferredWidth?: number;
	preferredHeight?: number;
	minWidth?: number;
	minHeight?: number;
}): Size {
	const aspect =
		Number.isFinite(options.aspectRatio) && options.aspectRatio > 0
			? options.aspectRatio
			: DEFAULT_ASPECT;

	const preferredWidth =
		options.preferredWidth ??
		Math.min(options.maxWidth, options.maxHeight * aspect);
	const preferredHeight = options.preferredHeight ?? preferredWidth / aspect;

	const fitted = computeContainFit(
		preferredWidth,
		preferredHeight,
		options.maxWidth,
		options.maxHeight
	);

	return clampStageSize(
		{ width: fitted.width, height: fitted.height },
		{
			minWidth: options.minWidth ?? 1,
			minHeight: options.minHeight ?? 1,
			maxWidth: options.maxWidth,
			maxHeight: options.maxHeight
		},
		aspect
	);
}

/** Derive height from width at a fixed aspect (for SE-corner resize). */
export function sizeFromWidth(width: number, aspectRatio: number): Size {
	const aspect =
		Number.isFinite(aspectRatio) && aspectRatio > 0
			? aspectRatio
			: DEFAULT_ASPECT;
	return { width, height: width / aspect };
}

export type ResizeEdge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export type Point = { x: number; y: number };

const ANCHORS_WEST = new Set<ResizeEdge>(['w', 'nw', 'sw']);
const ANCHORS_NORTH = new Set<ResizeEdge>(['n', 'ne', 'nw']);

/**
 * Aspect-preserving resize from a pointer delta on a given edge/corner.
 * Keeps the opposite edge(s) fixed by adjusting position.
 */
export function resizeStageFromPointer(options: {
	edge: ResizeEdge;
	startSize: Size;
	startPosition: Point;
	dx: number;
	dy: number;
	aspectRatio: number;
	bounds: StageBounds;
}): { size: Size; position: Point } {
	const aspect =
		Number.isFinite(options.aspectRatio) && options.aspectRatio > 0
			? options.aspectRatio
			: DEFAULT_ASPECT;

	const { edge, startSize, startPosition, dx, dy, bounds } = options;

	let proposed: Size;
	switch (edge) {
		case 'e':
			proposed = sizeFromWidth(startSize.width + dx, aspect);
			break;
		case 'w':
			proposed = sizeFromWidth(startSize.width - dx, aspect);
			break;
		case 's':
			proposed = {
				width: (startSize.height + dy) * aspect,
				height: startSize.height + dy
			};
			break;
		case 'n':
			proposed = {
				width: (startSize.height - dy) * aspect,
				height: startSize.height - dy
			};
			break;
		case 'se':
		case 'ne':
		case 'sw':
		case 'nw': {
			const widthDelta =
				edge === 'se' || edge === 'ne'
					? startSize.width + dx
					: startSize.width - dx;
			const heightDelta =
				edge === 'se' || edge === 'sw'
					? startSize.height + dy
					: startSize.height - dy;
			const fromW = sizeFromWidth(widthDelta, aspect);
			const fromH = {
				width: heightDelta * aspect,
				height: heightDelta
			};
			// Prefer the axis with larger pointer travel for smoother corners
			proposed = Math.abs(dx) >= Math.abs(dy) ? fromW : fromH;
			break;
		}
		default:
			proposed = { ...startSize };
	}

	const size = clampStageSize(proposed, bounds, aspect);

	let x = startPosition.x;
	let y = startPosition.y;
	if (ANCHORS_WEST.has(edge)) {
		x = startPosition.x + startSize.width - size.width;
	}
	if (ANCHORS_NORTH.has(edge)) {
		y = startPosition.y + startSize.height - size.height;
	}

	return { size, position: { x, y } };
}

export const RESIZE_EDGES: ResizeEdge[] = [
	'n',
	's',
	'e',
	'w',
	'ne',
	'nw',
	'se',
	'sw'
];

export function resizeCursorForEdge(edge: ResizeEdge): string {
	switch (edge) {
		case 'n':
		case 's':
			return 'ns-resize';
		case 'e':
		case 'w':
			return 'ew-resize';
		case 'ne':
		case 'sw':
			return 'nesw-resize';
		case 'nw':
		case 'se':
		default:
			return 'nwse-resize';
	}
}
