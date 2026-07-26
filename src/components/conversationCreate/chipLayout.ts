/**
 * Layout rules for the person chips that overlay the create card's media area
 * (Figma "Internal Group Chat Configuration", node 8480-27986).
 *
 * Chips are split evenly into two columns. Names never wrap to a second line —
 * the chip keeps its column width and the label is truncated instead. With an
 * uneven amount the last chip spans the full row.
 */

export type ChipSpan = 'half' | 'full';

export const chipSpan = (index: number, total: number): ChipSpan => {
	if (total <= 0 || index < 0 || index >= total) {
		return 'half';
	}
	const isLast = index === total - 1;
	const isUneven = total % 2 === 1;
	return isLast && isUneven ? 'full' : 'half';
};

export const chipSpans = (total: number): ChipSpan[] =>
	Array.from({ length: total }, (_, index) => chipSpan(index, total));
