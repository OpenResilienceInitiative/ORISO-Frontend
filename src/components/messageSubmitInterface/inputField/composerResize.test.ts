import { describe, expect, it } from 'vitest';
import {
	calculateAutoComposerHeight,
	clampComposerHeight,
	COMPOSER_MAX_VIEWPORT_FRACTION,
	getEffectiveComposerHeight,
	getComposerHeightBounds,
	stepComposerHeight
} from './composerResize';

describe('calculateAutoComposerHeight', () => {
	const bounds = { minHeight: 196, maxHeight: 600 };

	it('keeps the 196px default while content fits', () => {
		expect(
			calculateAutoComposerHeight({
				contentHeight: 44.8,
				lineHeight: 22.4,
				composerChromeHeight: 122,
				bounds
			})
		).toBe(196);
	});

	it('grows with content up to fourteen lines', () => {
		expect(
			calculateAutoComposerHeight({
				contentHeight: 224,
				lineHeight: 22.4,
				composerChromeHeight: 122,
				bounds
			})
		).toBe(346);
	});

	it('caps automatic growth at fourteen lines before scrolling', () => {
		expect(
			calculateAutoComposerHeight({
				contentHeight: 448,
				lineHeight: 22.4,
				composerChromeHeight: 122,
				bounds
			})
		).toBe(436);
	});

	it('lets an explicit drag height override automatic growth', () => {
		expect(getEffectiveComposerHeight(520, 436, 196)).toBe(520);
		expect(getEffectiveComposerHeight(300, 436, 196)).toBe(436);
		expect(getEffectiveComposerHeight(null, 196, 196)).toBeNull();
	});
});

describe('getComposerHeightBounds', () => {
	it('caps the composer at two thirds of the viewport height', () => {
		const bounds = getComposerHeightBounds({
			viewportWidth: 1280,
			viewportHeight: 900
		});
		expect(bounds.maxHeight).toBe(600);
		expect(COMPOSER_MAX_VIEWPORT_FRACTION).toBeCloseTo(2 / 3);
	});

	it('uses the one-line mobile minimum below the breakpoint (T10)', () => {
		// Toolbar strip (66 px to the editor top) + one 22 px line + 10 px
		// bottom inset + 2 × 2 px card border = 102 px — no dock, no spare
		// line under the placeholder (stage v3 review, 05.09.).
		expect(
			getComposerHeightBounds({ viewportWidth: 375, viewportHeight: 812 })
				.minHeight
		).toBe(102);
		expect(
			getComposerHeightBounds({
				viewportWidth: 1280,
				viewportHeight: 900
			}).minHeight
		).toBe(196);
	});

	it('T35: compact (dual mode) desktop composers rest at one line', () => {
		// 84 px from the card top to the editor (1 px border + 16 px dock +
		// 66 px toolbar strip) + one 22 px line + 36 px below (18 px editor
		// inset + 16 px dock + 1 px border + rounding) = 142 px — the same
		// one-line rule as the phone, with the desktop's insets.
		expect(
			getComposerHeightBounds({
				viewportWidth: 1280,
				viewportHeight: 900,
				compact: true
			}).minHeight
		).toBe(142);
		// The phone already rests at one line; compact changes nothing there.
		expect(
			getComposerHeightBounds({
				viewportWidth: 375,
				viewportHeight: 812,
				compact: true
			}).minHeight
		).toBe(102);
		// Off by default.
		expect(
			getComposerHeightBounds({
				viewportWidth: 1280,
				viewportHeight: 900,
				compact: false
			}).minHeight
		).toBe(196);
	});

	it('never returns a max below the min (tiny viewports)', () => {
		const bounds = getComposerHeightBounds({
			viewportWidth: 1280,
			viewportHeight: 240
		});
		expect(bounds.maxHeight).toBe(bounds.minHeight);
	});
});

describe('clampComposerHeight', () => {
	const bounds = { minHeight: 196, maxHeight: 600 };

	it('clamps above the two-thirds maximum', () => {
		expect(clampComposerHeight(2000, bounds)).toBe(600);
	});

	it('clamps below the minimum', () => {
		expect(clampComposerHeight(10, bounds)).toBe(196);
	});

	it('rounds in-range values', () => {
		expect(clampComposerHeight(300.6, bounds)).toBe(301);
	});
});

describe('stepComposerHeight', () => {
	const bounds = { minHeight: 196, maxHeight: 600 };

	it('grows with ArrowUp and shrinks with ArrowDown', () => {
		expect(
			stepComposerHeight(300, { key: 'ArrowUp', shiftKey: false }, bounds)
		).toBe(324);
		expect(
			stepComposerHeight(
				300,
				{ key: 'ArrowDown', shiftKey: false },
				bounds
			)
		).toBe(276);
	});

	it('uses the large step with shift', () => {
		expect(
			stepComposerHeight(300, { key: 'ArrowUp', shiftKey: true }, bounds)
		).toBe(348);
	});

	it('jumps to min/max with Home and End', () => {
		expect(
			stepComposerHeight(300, { key: 'Home', shiftKey: false }, bounds)
		).toBe(196);
		expect(
			stepComposerHeight(300, { key: 'End', shiftKey: false }, bounds)
		).toBe(600);
	});

	it('clamps stepped values at the bounds', () => {
		expect(
			stepComposerHeight(590, { key: 'ArrowUp', shiftKey: true }, bounds)
		).toBe(600);
	});

	it('returns null for unhandled keys', () => {
		expect(
			stepComposerHeight(300, { key: 'Enter', shiftKey: false }, bounds)
		).toBeNull();
	});
});
