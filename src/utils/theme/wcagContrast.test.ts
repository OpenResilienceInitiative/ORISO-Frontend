import { describe, expect, it } from 'vitest';
import { wcagContrast } from './wcagContrast';

describe('wcagContrast', () => {
	it('matches the WCAG reference values', () => {
		expect(wcagContrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
		expect(wcagContrast('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
		// #767676 on white is the classic 4.54:1 grey.
		expect(wcagContrast('#767676', '#ffffff')).toBeCloseTo(4.54, 2);
	});

	it('reads the rgb() form getComputedStyle returns', () => {
		expect(wcagContrast('rgb(180, 221, 238)', 'rgb(255, 255, 255)')).toBe(
			wcagContrast('#b4ddee', '#ffffff')
		);
	});
});
