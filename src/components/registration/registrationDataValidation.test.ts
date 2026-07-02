import { describe, expect, it } from 'vitest';
import { REGISTRATION_DATA_VALIDATION } from './registrationDataValidation';

describe('REGISTRATION_DATA_VALIDATION', () => {
	it('treats empty postcode values as invalid without throwing', () => {
		expect(REGISTRATION_DATA_VALIDATION.zipcode.validation()).toBe(false);
		expect(REGISTRATION_DATA_VALIDATION.zipcode.validation(undefined)).toBe(
			false
		);
		expect(REGISTRATION_DATA_VALIDATION.zipcode.validation('')).toBe(false);
	});

	it('validates five digit postcodes only', () => {
		expect(REGISTRATION_DATA_VALIDATION.zipcode.validation('50667')).toBe(
			true
		);
		expect(REGISTRATION_DATA_VALIDATION.zipcode.validation('5066')).toBe(
			false
		);
		expect(REGISTRATION_DATA_VALIDATION.zipcode.validation('5066a')).toBe(
			false
		);
	});
});
