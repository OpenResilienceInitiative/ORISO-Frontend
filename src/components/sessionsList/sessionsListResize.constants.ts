export const SESSIONS_LIST_RESIZE = {
	// Icon-only mode starts below this width (see `sessionsList.styles.scss`)
	ICON_ONLY_THRESHOLD: 220,
	// Snap midpoint between `minWidth` (80) and icon-only (220) for a crisp toggle
	SNAP_THRESHOLD: 150,
	SCROLL_THUMB_MIN_PX: 18,
	SCROLL_THUMB_MAX_PX: 44
} as const;
