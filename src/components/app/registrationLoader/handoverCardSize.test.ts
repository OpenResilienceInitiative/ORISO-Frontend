// @vitest-environment oriso-jsdom
import { describe, expect, it } from 'vite-plus/test';
import {
	cardWidth,
	expectedCardWidthRange,
	expectedSmCardWidthPx,
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

	it('resolves the sm width like the browser: width, height, floor, cap', () => {
		// 2560×1440: three across a 1456 px block.
		expect(expectedSmCardWidthPx(1456, 1440)).toBeCloseTo(472, 0);
		// 2560×900: the height bound wins, the card stays below 372 px.
		expect(expectedSmCardWidthPx(1456, 900)).toBeCloseTo(357.14, 1);
		// 1920 at 150 % zoom (1280×720 CSS px): the height bound, 200 px.
		expect(expectedSmCardWidthPx(1112, 720)).toBe(200);
		// Shorter still: the 12rem floor.
		expect(expectedSmCardWidthPx(1112, 640)).toBe(192);
		// 3840×2160: three across would be 728 px; the 45rem cap holds it.
		expect(expectedSmCardWidthPx(2224, 2160)).toBe(720);
	});
});
