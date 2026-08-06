import { describe, expect, it } from 'vitest';
import { chipSpan, chipSpans } from './chipLayout';

describe('chipSpan', () => {
	it('splits an even amount into half-width chips only', () => {
		expect(chipSpans(4)).toEqual(['half', 'half', 'half', 'half']);
	});

	it('gives the last chip of an uneven amount the full row', () => {
		expect(chipSpans(5)).toEqual(['half', 'half', 'half', 'half', 'full']);
	});

	it('renders a single chip full width', () => {
		expect(chipSpans(1)).toEqual(['full']);
	});

	it('keeps a pair side by side', () => {
		expect(chipSpans(2)).toEqual(['half', 'half']);
	});

	it('is defensive about out-of-range input', () => {
		expect(chipSpan(-1, 3)).toBe('half');
		expect(chipSpan(3, 3)).toBe('half');
		expect(chipSpans(0)).toEqual([]);
	});
});
