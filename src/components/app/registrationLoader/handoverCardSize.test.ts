// @vitest-environment oriso-jsdom
import { describe, expect, it } from 'vite-plus/test';
import {
	cardWidth,
	expectedCardWidthRange,
	fluid,
	rem
} from './handoverCardSize';

describe('handoverCardSize', () => {
	it('sizes the card in rem and clamp(), never in fixed px', () => {
		expect(cardWidth.xs).toBe('18.75rem');
		expect(cardWidth.sm).toMatch(/^clamp\(12rem, .*, 45rem\)$/);
		expect(cardWidth.sm).toContain('100cqi');
		expect(cardWidth.sm).toContain('100dvh');
		expect(`${cardWidth.xs} ${cardWidth.sm}`).not.toMatch(/\dpx/);
	});

	it('grows inner lengths with the card from their old design value', () => {
		// 20 px padding on the 372 px design card: 5.376 % of the card, at
		// least 80 % of 20 px (1rem), at most its share of a 45rem card.
		expect(fluid(20)).toBe('clamp(1rem, 5.376cqi, 2.4194rem)');
		expect(fluid(36, 3)).toBe('clamp(1.8rem, 9.677cqi, 3rem)');
		expect(rem(170)).toBe('10.625rem');
	});

	it('expects the phone width below sm and the fluid range above', () => {
		expect(expectedCardWidthRange(document, 390, 520)).toEqual({
			min: 300,
			max: 300
		});
		expect(expectedCardWidthRange(document, 2560, 520)).toEqual({
			min: 192,
			max: 720
		});
	});
});
