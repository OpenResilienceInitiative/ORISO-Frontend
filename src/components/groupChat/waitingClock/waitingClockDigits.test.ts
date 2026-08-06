import { describe, expect, it } from 'vitest';
import { CELL, DIGITS, digitCells, twoDigits } from './waitingClockDigits';

const PRESETS = Object.values(CELL);

describe('waitingClockDigits', () => {
	it('encodes all ten digits', () => {
		expect(DIGITS).toHaveLength(10);
	});

	it('draws each digit with exactly 24 mini-clocks (4×6 grid)', () => {
		DIGITS.forEach((cells) => expect(cells).toHaveLength(24));
	});

	it('only uses the seven defined stroke presets', () => {
		DIGITS.flat().forEach((cell) => {
			expect(PRESETS).toContainEqual(cell);
		});
	});

	it('digitCells falls back to 0 for out-of-range input', () => {
		expect(digitCells(7)).toBe(DIGITS[7]);
		expect(digitCells(99)).toBe(DIGITS[0]);
		expect(digitCells(-1)).toBe(DIGITS[0]);
	});

	it('twoDigits splits a padded value into digit indices', () => {
		expect(twoDigits(0)).toEqual([0, 0]);
		expect(twoDigits(7)).toEqual([0, 7]);
		expect(twoDigits(42)).toEqual([4, 2]);
		expect(twoDigits(59)).toEqual([5, 9]);
	});

	it('twoDigits clamps negatives and floors fractions', () => {
		expect(twoDigits(-5)).toEqual([0, 0]);
		expect(twoDigits(23.9)).toEqual([2, 3]);
	});
});
