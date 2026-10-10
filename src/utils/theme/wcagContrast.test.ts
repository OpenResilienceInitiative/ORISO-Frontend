// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { effectiveBackground, wcagContrast } from './wcagContrast';

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

describe('effectiveBackground', () => {
	const nested = (outer: string, inner: string) => {
		const parent = document.createElement('div');
		parent.style.backgroundColor = outer;
		const child = document.createElement('div');
		child.style.backgroundColor = inner;
		parent.appendChild(child);
		document.body.appendChild(parent);
		return child;
	};

	it('paints a translucent background over what lies beneath it', () => {
		const footer = nested('rgb(0, 0, 0)', 'rgba(255, 255, 255, 0.5)');

		expect(effectiveBackground(footer)).toBe('rgb(128, 128, 128)');
	});

	it('keeps an opaque background as it is', () => {
		const card = nested('rgb(0, 0, 0)', 'rgb(252, 249, 249)');

		expect(effectiveBackground(card)).toBe('rgb(252, 249, 249)');
	});
});
