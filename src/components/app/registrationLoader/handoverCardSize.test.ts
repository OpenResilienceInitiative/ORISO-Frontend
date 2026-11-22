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
		expect(cardWidth.sm).toMatch(/^clamp\(12rem, .*, 90rem\)$/);
		// Sized from the free height and at most 1.5 across, not three across.
		// A share of the window, so zoom does not change the card's size.
		expect(cardWidth.sm).toContain('35.347vw');
		expect(cardWidth.sm).toContain('var(--handover-block-w');
		expect(cardWidth.sm).toContain('/ 2.6');
		expect(cardWidth.sm).not.toContain('/ 3');
		expect(`${cardWidth.xs} ${cardWidth.sm}`).not.toMatch(/\dpx/);
	});

	it('sizes inner lengths as a share of the window, from their design value', () => {
		// 20 px padding on a 1440 px window: 1.389 % of the window, at least
		// 80 % of 20 px (1rem), at most its share of a 90rem card.
		expect(fluid(20)).toBe('clamp(1rem, 1.389vw, 4.8387rem)');
		expect(fluid(36, 3)).toBe('clamp(1.8rem, 2.5vw, 3rem)');
		expect(rem(170)).toBe('10.625rem');
	});

	it('expects the phone width below sm and the fluid range above', () => {
		expect(expectedCardWidthRange(document, 390, 520)).toEqual({
			min: 300,
			max: 300
		});
		expect(expectedCardWidthRange(document, 2560, 520)).toEqual({
			min: 192,
			max: 1440
		});
	});

	it('resolves the sm width like the browser: window share, few across, floor, cap', () => {
		// 1440 window: 509 px, one and a half across (Frank, 2026-11-20).
		expect(expectedSmCardWidthPx(784, 1440)).toBeCloseTo(509, 0);
		// 1920 window: the same share, 679 px.
		expect(expectedSmCardWidthPx(1072, 1920)).toBeCloseTo(678.7, 0);
		// 1440 at 150 % zoom (960 CSS px): the same share, 339 CSS px =
		// 509 screen px.
		expect(expectedSmCardWidthPx(880, 960)).toBeCloseTo(339.3, 1);
		// A tiny window: the 12rem floor.
		expect(expectedSmCardWidthPx(300, 400)).toBe(192);
		// 3840 window at 100 %: still the baseline's share, 1357 px.
		expect(expectedSmCardWidthPx(2224, 3840)).toBeCloseTo(1357.3, 1);
	});
});
