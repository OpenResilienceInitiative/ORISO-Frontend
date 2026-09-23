/**
 * The session card body's geometry — the single source for its numbers.
 * The stylesheet reads them as custom properties set by `SessionCardBody`.
 */
export interface SessionCardGeometry {
	avatar: number;
	gap: number;
	nameLine: number;
	previewLine: number;
	previewLines: number;
	/** Where the glyph band starts inside a preview line box. */
	ink: number;
	inset: number;
	/** Height of the trailing marks (Mail …), centred on the last line. */
	mark: number;
	/** Text keeps this far clear of the marks from the second line on. */
	trailingClearance: number;
}

export const SESSION_CARD_GEOMETRY: SessionCardGeometry = {
	avatar: 48,
	gap: 12,
	nameLine: 24,
	previewLine: 16,
	previewLines: 3,
	ink: 3,
	inset: 16,
	mark: 24,
	trailingClearance: 24
};

/**
 * Left edge of each preview line, from the avatar's left edge: the avatar
 * plus gap, then where the circle meets the second line's glyph band, then
 * the same step again (Frank, 16.09.2026: never back to the card's edge).
 */
export const sessionCardPreviewIndents = (g: SessionCardGeometry): number[] => {
	const r = g.avatar / 2;
	// The avatar is level with the name, so its centre sits `nameLine - r`
	// above the first preview line.
	const centreY = r - g.nameLine;
	const dy = g.previewLine + g.ink - centreY;
	const first = g.avatar + g.gap;
	const second = Math.round(
		r + Math.sqrt(Math.max(0, r * r - dy * dy)) + g.gap
	);
	const step = first - second;
	return Array.from({ length: g.previewLines }, (_, line) =>
		line === 0 ? first : second - step * (line - 1)
	);
};

export const sessionCardBodyHeight = (g: SessionCardGeometry): number =>
	g.nameLine +
	g.previewLine * g.previewLines +
	(g.mark - g.previewLine) / 2 +
	g.inset;

/** One polygon step per preview line, for the avatar's `shape-outside`. */
export const sessionCardShapeOutside = (g: SessionCardGeometry): string => {
	const points = sessionCardPreviewIndents(g).flatMap((x, line) => [
		`${x}px ${line === 0 ? 0 : `${line * g.previewLine}px`}`,
		`${x}px ${(line + 1) * g.previewLine}px`
	]);
	return `polygon(0 0, ${points.join(', ')}, 0 ${g.previewLine * g.previewLines}px)`;
};
