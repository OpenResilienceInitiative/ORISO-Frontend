import { describe, expect, it } from 'vitest';
import { decideMenuPlacement } from './menuDirection';

describe('decideMenuPlacement', () => {
	it('opens downwards when the menu fits below the anchor', () => {
		expect(
			decideMenuPlacement({
				anchorTop: 100,
				anchorBottom: 156,
				viewportHeight: 800,
				menuHeight: 400
			})
		).toEqual({ direction: 'down', maxHeight: 400 });
	});

	it('opens upwards when it only fits above', () => {
		expect(
			decideMenuPlacement({
				anchorTop: 600,
				anchorBottom: 656,
				viewportHeight: 800,
				menuHeight: 400
			})
		).toEqual({ direction: 'up', maxHeight: 400 });
	});

	it('caps the height and scrolls when the menu fits on neither side', () => {
		const placement = decideMenuPlacement({
			anchorTop: 500,
			anchorBottom: 556,
			viewportHeight: 800,
			menuHeight: 900
		});
		expect(placement.direction).toBe('up');
		expect(placement.maxHeight).toBe(484);
	});

	it('prefers the larger side when constrained', () => {
		const placement = decideMenuPlacement({
			anchorTop: 100,
			anchorBottom: 156,
			viewportHeight: 800,
			menuHeight: 900
		});
		expect(placement.direction).toBe('down');
		expect(placement.maxHeight).toBe(628);
	});
});
