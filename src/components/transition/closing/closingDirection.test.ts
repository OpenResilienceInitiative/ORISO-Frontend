import { describe, expect, it } from 'vitest';
import {
	CLOSING_DESKTOP_MIN_WIDTH,
	CLOSING_DIRECTIONS,
	closingDirectionFor
} from './closingDirection';

/**
 * ORISO-Frontend#1737. One design, the slide reveal. It sweeps sideways beside
 * the brand stage (desktop) and upward on a phone or tablet, where the screen
 * is a single column.
 */
describe('closingDirectionFor', () => {
	it('sweeps sideways on a desktop width', () => {
		expect(closingDirectionFor(true)).toBe('horizontal');
	});

	it('sweeps upward on anything narrower', () => {
		expect(closingDirectionFor(false)).toBe('vertical');
	});

	it('knows exactly the two directions', () => {
		expect([...CLOSING_DIRECTIONS]).toEqual(['horizontal', 'vertical']);
	});

	it('draws the line between desktop and mobile at 1200 px, where the stage stands beside the room', () => {
		expect(CLOSING_DESKTOP_MIN_WIDTH).toBe(1200);
	});
});
