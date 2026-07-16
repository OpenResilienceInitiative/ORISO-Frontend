import { describe, expect, it } from 'vitest';
import { getDisplayablePostcode } from './sessionClassification';

describe('sessionClassification', () => {
	it('formats real postcodes and suppresses anonymous postcode sentinels', () => {
		expect(getDisplayablePostcode(12345)).toBe('12345');
		expect(getDisplayablePostcode(' 99322 ')).toBe('99322');
		expect(getDisplayablePostcode(0)).toBeNull();
		expect(getDisplayablePostcode('00000')).toBeNull();
		expect(getDisplayablePostcode('')).toBeNull();
	});
});
