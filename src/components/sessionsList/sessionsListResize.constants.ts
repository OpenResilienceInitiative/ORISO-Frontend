export const SESSIONS_LIST_RESIZE = {
	// Icon-only mode starts below this width (see `sessionsList.styles.scss`)
	ICON_ONLY_THRESHOLD: 220,
	// Snap midpoint between `minWidth` (80) and icon-only (220) for a crisp toggle
	SNAP_THRESHOLD: 150,
	// Expanded (non-compact) desktop bounds — Figma node 115-27170 sizes the
	// chat-history element to min 397px / max 500px. Below `EXPANDED_MIN_WIDTH`
	// the sidebar snaps back to the icon-only compact rail.
	EXPANDED_MIN_WIDTH: 397,
	EXPANDED_MAX_WIDTH: 500,
	// Snap midpoint between the icon-only rail (220) and the expanded min (397).
	EXPANDED_SNAP_THRESHOLD: 308,
	SCROLL_THUMB_MIN_PX: 18,
	SCROLL_THUMB_MAX_PX: 44
} as const;
