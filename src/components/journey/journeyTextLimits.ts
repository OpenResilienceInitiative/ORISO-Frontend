/**
 * How long journey texts may be on screen (Frank, 2026-11-20). The check-in shows one question per
 * screen without scrolling, so the words have to fit: a question in at most two lines, the line
 * under a step title in at most four. Beyond that the text is cut with "…" here; the Admin editor
 * warns while typing and marks the field "zu lang" before it ever gets this far
 * (ORISO-Admin#1551, same numbers).
 */
export const TEXT_LINES = {
	stepTitle: 2,
	stepDescription: 4,
	question: 2,
	help: 3
} as const;

/** Cuts a block after `lines` lines with an ellipsis; the full text stays in the DOM for screen readers. */
export const clampLines = (lines: number) =>
	({
		display: '-webkit-box',
		WebkitLineClamp: lines,
		WebkitBoxOrient: 'vertical',
		overflow: 'hidden'
	}) as const;
