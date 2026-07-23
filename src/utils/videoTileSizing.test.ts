import { describe, it, expect } from 'vitest';
import {
	normalizeAspectRatio,
	computeContainFit,
	clampStageSize,
	getAutoFitStageSize,
	sizeFromWidth,
	resizeStageFromPointer
} from './videoTileSizing';

describe('videoTileSizing', () => {
	describe('normalizeAspectRatio', () => {
		it('returns width/height for valid dimensions', () => {
			expect(normalizeAspectRatio(1080, 1920)).toBeCloseTo(1080 / 1920);
			expect(normalizeAspectRatio(1920, 1080)).toBeCloseTo(16 / 9);
		});

		it('falls back when dimensions are missing', () => {
			expect(normalizeAspectRatio(0, 1080)).toBeCloseTo(16 / 9);
			expect(normalizeAspectRatio(1920, 0)).toBeCloseTo(16 / 9);
			expect(normalizeAspectRatio(NaN, 100, 4 / 3)).toBeCloseTo(4 / 3);
		});
	});

	describe('computeContainFit', () => {
		it('letterboxes a portrait stream in a landscape container', () => {
			const fit = computeContainFit(1080, 1920, 520, 320);
			expect(fit.width).toBeLessThanOrEqual(520);
			expect(fit.height).toBeLessThanOrEqual(320);
			expect(fit.width / fit.height).toBeCloseTo(1080 / 1920, 5);
			expect(fit.x).toBeGreaterThan(0);
			expect(fit.y).toBe(0);
		});

		it('pillarboxes a landscape stream in a portrait container', () => {
			const fit = computeContainFit(1920, 1080, 300, 500);
			expect(fit.width).toBeLessThanOrEqual(300);
			expect(fit.height).toBeLessThanOrEqual(500);
			expect(fit.width / fit.height).toBeCloseTo(16 / 9, 5);
			expect(fit.y).toBeGreaterThan(0);
		});

		it('returns zeros for invalid input', () => {
			expect(computeContainFit(0, 100, 200, 200)).toEqual({
				width: 0,
				height: 0,
				x: 0,
				y: 0
			});
		});
	});

	describe('clampStageSize', () => {
		const bounds = {
			minWidth: 280,
			minHeight: 200,
			maxWidth: 800,
			maxHeight: 600
		};

		it('preserves aspect while clamping to max', () => {
			const result = clampStageSize(
				{ width: 2000, height: 1125 },
				bounds,
				16 / 9
			);
			expect(result.width).toBeLessThanOrEqual(800);
			expect(result.height).toBeLessThanOrEqual(600);
			expect(result.width / result.height).toBeCloseTo(16 / 9, 1);
		});

		it('preserves aspect while clamping to min', () => {
			const result = clampStageSize(
				{ width: 50, height: 50 },
				bounds,
				16 / 9
			);
			expect(result.width).toBeGreaterThanOrEqual(280);
			expect(result.height).toBeGreaterThanOrEqual(200);
		});
	});

	describe('getAutoFitStageSize', () => {
		it('fits preferred landscape stage into available space', () => {
			const size = getAutoFitStageSize({
				aspectRatio: 16 / 9,
				maxWidth: 1000,
				maxHeight: 400,
				preferredWidth: 520,
				preferredHeight: 292.5,
				minWidth: 280,
				minHeight: 180
			});
			expect(size.width).toBeLessThanOrEqual(1000);
			expect(size.height).toBeLessThanOrEqual(400);
			expect(size.width / size.height).toBeCloseTo(16 / 9, 1);
		});

		it('fits portrait preferred stage without exceeding viewport', () => {
			const size = getAutoFitStageSize({
				aspectRatio: 9 / 16,
				maxWidth: 400,
				maxHeight: 700,
				preferredWidth: 360,
				preferredHeight: 640,
				minWidth: 200,
				minHeight: 280
			});
			expect(size.width).toBeLessThanOrEqual(400);
			expect(size.height).toBeLessThanOrEqual(700);
			expect(size.width / size.height).toBeCloseTo(9 / 16, 1);
		});
	});

	describe('sizeFromWidth', () => {
		it('derives height from width and aspect', () => {
			expect(sizeFromWidth(320, 16 / 9)).toEqual({
				width: 320,
				height: 320 / (16 / 9)
			});
		});
	});

	describe('resizeStageFromPointer', () => {
		const bounds = {
			minWidth: 200,
			minHeight: 100,
			maxWidth: 800,
			maxHeight: 600
		};
		const startSize = { width: 400, height: 225 };
		const startPosition = { x: 100, y: 80 };
		const aspect = 16 / 9;

		it('grows SE without moving position', () => {
			const result = resizeStageFromPointer({
				edge: 'se',
				startSize,
				startPosition,
				dx: 80,
				dy: 45,
				aspectRatio: aspect,
				bounds
			});
			expect(result.size.width).toBeGreaterThan(startSize.width);
			expect(result.size.width / result.size.height).toBeCloseTo(
				aspect,
				1
			);
			expect(result.position).toEqual(startPosition);
		});

		it('grows SW while anchoring the east edge', () => {
			const result = resizeStageFromPointer({
				edge: 'sw',
				startSize,
				startPosition,
				dx: -80,
				dy: 45,
				aspectRatio: aspect,
				bounds
			});
			expect(result.size.width).toBeGreaterThan(startSize.width);
			expect(result.position.x + result.size.width).toBeCloseTo(
				startPosition.x + startSize.width,
				0
			);
			expect(result.position.y).toBe(startPosition.y);
		});

		it('grows NW while anchoring the SE corner', () => {
			const result = resizeStageFromPointer({
				edge: 'nw',
				startSize,
				startPosition,
				dx: -80,
				dy: -45,
				aspectRatio: aspect,
				bounds
			});
			expect(result.size.width).toBeGreaterThan(startSize.width);
			expect(result.position.x + result.size.width).toBeCloseTo(
				startPosition.x + startSize.width,
				0
			);
			expect(result.position.y + result.size.height).toBeCloseTo(
				startPosition.y + startSize.height,
				0
			);
		});

		it('resizes from east edge using dx only', () => {
			const result = resizeStageFromPointer({
				edge: 'e',
				startSize,
				startPosition,
				dx: 100,
				dy: 999,
				aspectRatio: aspect,
				bounds
			});
			expect(result.size.width).toBeGreaterThan(startSize.width);
			expect(result.position).toEqual(startPosition);
		});
	});
});
