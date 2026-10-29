import { describe, expect, it } from 'vitest';
import {
	CELL,
	DIGITS,
	digitCells,
	FACE_MAX,
	faceDigitCount,
	faceDigits
} from './waitingClockDigits';

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

	it('faceDigits splits a padded value into digit indices', () => {
		expect(faceDigits(0)).toEqual([0, 0]);
		expect(faceDigits(7)).toEqual([0, 7]);
		expect(faceDigits(42)).toEqual([4, 2]);
		expect(faceDigits(59)).toEqual([5, 9]);
	});

	// #1499: the face used to clamp at 99, so a group 140 minutes late drew
	// "99" while its timer label said 140. It grows a third cell instead.
	it('faceDigits grows a third cell from 100 up', () => {
		expect(faceDigits(99)).toEqual([9, 9]);
		expect(faceDigits(100)).toEqual([1, 0, 0]);
		expect(faceDigits(140)).toEqual([1, 4, 0]);
		expect(faceDigitCount(99)).toBe(2);
		expect(faceDigitCount(100)).toBe(3);
	});

	it('faceDigits stops at three cells', () => {
		expect(faceDigits(FACE_MAX)).toEqual([9, 9, 9]);
		expect(faceDigits(FACE_MAX + 1)).toEqual([9, 9, 9]);
		expect(faceDigits(12345)).toEqual([9, 9, 9]);
		expect(faceDigitCount(12345)).toBe(3);
	});

	it('faceDigits clamps negatives and floors fractions', () => {
		expect(faceDigits(-5)).toEqual([0, 0]);
		expect(faceDigits(23.9)).toEqual([2, 3]);
	});
});
