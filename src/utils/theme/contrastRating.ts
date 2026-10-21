import { wcagContrast } from './wcagContrast';

/**
 * WCAG 2.2 contrast thresholds the high-contrast candidates (#1134) are
 * judged against.
 *
 * - `text`: 1.4.3 needs 4.5:1 (AA); the high-contrast target is 7:1 (AAA).
 * - `ui`: 1.4.11 needs 3:1 for the parts of a control or icon that identify
 *   it (outline, focus ring, status glyph). WCAG has no stricter tier, so
 *   meeting 3:1 is also the high-contrast bar.
 */
export type ContrastKind = 'text' | 'ui';
export type ContrastGrade = 'AAA' | 'AA' | 'pass' | 'fail';

export interface ContrastRating {
	ratio: number;
	kind: ContrastKind;
	/** The WCAG minimum for this kind. */
	required: number;
	grade: ContrastGrade;
	meetsMinimum: boolean;
	meetsHighContrast: boolean;
}

export const TEXT_AA = 4.5;
export const TEXT_AAA = 7;
export const UI_MINIMUM = 3;

export const rateContrast = (
	foreground: string,
	background: string,
	kind: ContrastKind
): ContrastRating => {
	const ratio = wcagContrast(foreground, background);
	if (kind === 'ui') {
		const meets = ratio >= UI_MINIMUM;
		return {
			ratio,
			kind,
			required: UI_MINIMUM,
			grade: meets ? 'pass' : 'fail',
			meetsMinimum: meets,
			meetsHighContrast: meets
		};
	}
	return {
		ratio,
		kind,
		required: TEXT_AA,
		grade: ratio >= TEXT_AAA ? 'AAA' : ratio >= TEXT_AA ? 'AA' : 'fail',
		meetsMinimum: ratio >= TEXT_AA,
		meetsHighContrast: ratio >= TEXT_AAA
	};
};

/**
 * "4.49:1", truncated rather than rounded: a ratio of 4.499 must not be
 * displayed as the 4.50 that would pass.
 */
export const formatRatio = (ratio: number): string =>
	`${(Math.floor(ratio * 100) / 100).toFixed(2)}:1`;
