import { describe, expect, it } from 'vitest';
import { chipRevealScrollLeft } from './chipRowReveal';

describe('chipRevealScrollLeft', () => {
	it('leaves a fully visible chip alone', () => {
		expect(chipRevealScrollLeft(0, 300, 40, 120)).toBeNull();
	});

	it('scrolls right so a chip cut off at the right edge ends inside the gutter', () => {
		// Supervision chip at 460–600 in a 520px row (Frank's screenshot).
		expect(chipRevealScrollLeft(0, 520, 460, 600)).toBe(600 + 12 - 520);
	});

	it('scrolls left for a chip hidden at the left edge, never below 0', () => {
		expect(chipRevealScrollLeft(200, 300, 150, 230)).toBe(138);
		expect(chipRevealScrollLeft(50, 300, 4, 60)).toBe(0);
	});
});
