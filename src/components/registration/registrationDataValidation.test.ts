import { describe, expect, it } from 'vitest';
import {
	REGISTRATION_DATA_VALIDATION,
	USERNAME_MAX_LENGTH,
	USERNAME_MIN_LENGTH
} from './registrationDataValidation';

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

	describe('username', () => {
		const validate = REGISTRATION_DATA_VALIDATION.username.validation;
		const repeat = (length: number) => 'a'.repeat(length);

		it('rejects usernames shorter than the minimum length', () => {
			expect(validate(repeat(USERNAME_MIN_LENGTH - 1))).toBe(false);
			expect(validate(repeat(USERNAME_MIN_LENGTH))).toBe(true);
		});

		it('rejects usernames longer than the backend maximum length', () => {
			expect(validate(repeat(USERNAME_MAX_LENGTH))).toBe(true);
			expect(validate(repeat(USERNAME_MAX_LENGTH + 1))).toBe(false);
		});

		it('rejects invalid characters', () => {
			expect(validate('Katze_Mika')).toBe(false);
			expect(validate('katze mika')).toBe(false);
			expect(validate('katze_mika_1234')).toBe(true);
		});
	});
});
