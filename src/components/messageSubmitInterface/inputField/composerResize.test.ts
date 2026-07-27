import { describe, expect, it } from 'vitest';
import {
	clampComposerHeight,
	COMPOSER_MAX_VIEWPORT_FRACTION,
	getComposerHeightBounds,
	stepComposerHeight
} from './composerResize';

describe('getComposerHeightBounds', () => {
	it('caps the composer at two thirds of the viewport height', () => {
		const bounds = getComposerHeightBounds({
			viewportWidth: 1280,
			viewportHeight: 900
		});
		expect(bounds.maxHeight).toBe(600);
		expect(COMPOSER_MAX_VIEWPORT_FRACTION).toBeCloseTo(2 / 3);
	});

	it('uses the mobile minimum below the breakpoint', () => {
		expect(
			getComposerHeightBounds({ viewportWidth: 375, viewportHeight: 812 })
				.minHeight
		).toBe(180);
		expect(
			getComposerHeightBounds({
				viewportWidth: 1280,
				viewportHeight: 900
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
