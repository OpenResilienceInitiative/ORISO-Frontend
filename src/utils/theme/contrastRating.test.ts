import { describe, expect, it } from 'vitest';
import { formatRatio, rateContrast } from './contrastRating';

// Expected values are the published WCAG 2.2 figures for well-known greys,
// not recomputed with the production formula:
// #767676 / white = 4.54:1 (the lightest grey that passes AA for text),
// #777777 / white = 4.48:1 (the next one up, which fails),
// #949494 / white = 3.03:1 and #959595 / white = 2.97:1 (the 3:1 edge).
describe('rateContrast', () => {
	it('rates black on white as AAA text', () => {
		const rating = rateContrast('#000000', '#ffffff', 'text');

		expect(rating.ratio).toBeCloseTo(21, 5);
		expect(rating.grade).toBe('AAA');
		expect(rating.meetsMinimum).toBe(true);
		expect(rating.meetsHighContrast).toBe(true);
	});

	it('passes text at 4.5:1 as AA but not as high contrast', () => {
		const rating = rateContrast('#767676', '#ffffff', 'text');

		expect(rating.grade).toBe('AA');
		expect(rating.required).toBe(4.5);
		expect(rating.meetsMinimum).toBe(true);
		expect(rating.meetsHighContrast).toBe(false);
	});

	it('fails text just under 4.5:1', () => {
		const rating = rateContrast('#777777', '#ffffff', 'text');

		expect(rating.grade).toBe('fail');
		expect(rating.meetsMinimum).toBe(false);
	});

	it('judges UI components and icons against 3:1', () => {
		const passing = rateContrast('#949494', '#ffffff', 'ui');
		const failing = rateContrast('#959595', '#ffffff', 'ui');

		expect(passing.required).toBe(3);
		expect(passing.grade).toBe('pass');
		expect(passing.meetsHighContrast).toBe(true);
		expect(failing.grade).toBe('fail');
	});

	it('accepts the rgb() form getComputedStyle returns', () => {
		expect(
			rateContrast('rgb(0, 0, 0)', 'rgb(255, 255, 255)', 'text').grade
		).toBe('AAA');
	});
});

describe('formatRatio', () => {
	it('shows two decimals and never rounds a miss up to a pass', () => {
		expect(formatRatio(4.499)).toBe('4.49:1');
		expect(formatRatio(7)).toBe('7.00:1');
		expect(formatRatio(21)).toBe('21.00:1');
	});
});
