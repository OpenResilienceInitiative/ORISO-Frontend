import { describe, expect, it } from 'vite-plus/test';
import { stepperWindow } from './stepperWindow';

const shape = (total: number, current: number, max: number) =>
	stepperWindow(total, current, max).map((slot) =>
		slot.kind === 'step' ? slot.index : `${slot.side}:${slot.count}`
	);

describe('stepperWindow (#2333)', () => {
	it('shows every step while they fit', () => {
		expect(shape(2, 0, 5)).toEqual([0, 1]);
		expect(shape(5, 4, 5)).toEqual([0, 1, 2, 3, 4]);
	});

	it('folds the steps far ahead into one marker at the start', () => {
		expect(shape(8, 0, 5)).toEqual([0, 1, 2, 3, 'after:4']);
	});

	it('folds both sides in the middle and keeps the current step and the one before it', () => {
		expect(shape(9, 4, 5)).toEqual(['before:4', 4, 5, 6, 'after:2']);
	});

	it('near the end folds only what lies behind', () => {
		expect(shape(8, 7, 5)).toEqual(['before:4', 4, 5, 6, 7]);
	});

	it('always keeps the current step visible', () => {
		for (let total = 6; total <= 12; total += 1) {
			for (let current = 0; current < total; current += 1) {
				const slots = stepperWindow(total, current, 5);
				expect(slots).toHaveLength(5);
				expect(
					slots.some(
						(slot) => slot.kind === 'step' && slot.index === current
					)
				).toBe(true);
			}
		}
	});
});
