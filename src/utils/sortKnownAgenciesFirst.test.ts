import { describe, expect, it } from 'vitest';
import { sortKnownAgenciesFirst } from './sortKnownAgenciesFirst';

const agency = (id: number) => ({ id }) as any;

describe('sortKnownAgenciesFirst', () => {
	it('moves known agencies to the front, keeping relative order', () => {
		const result = sortKnownAgenciesFirst(
			[agency(1), agency(2), agency(3), agency(4)],
			[3, 4]
		);
		expect(result.map((a) => a.id)).toEqual([3, 4, 1, 2]);
	});

	it('is a no-op without known ids', () => {
		const result = sortKnownAgenciesFirst([agency(1), agency(2)]);
		expect(result.map((a) => a.id)).toEqual([1, 2]);
	});

	it('does not mutate the input array', () => {
		const input = [agency(1), agency(2)];
		sortKnownAgenciesFirst(input, [2]);
		expect(input.map((a) => a.id)).toEqual([1, 2]);
	});
});
