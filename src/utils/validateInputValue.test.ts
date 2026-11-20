import { describe, expect, it } from 'vitest';
import { passwordCriteria } from '../components/registration/accountData/passwordRules';
import {
	PASSWORD_MIN_LENGTH,
	strengthIndicator,
	validatePasswordCriteria
} from './validateInputValue';

// Registration and password change must enforce the same minimum length
// (OBP 2.1 #116): the change form used to accept 9 characters.
describe('password minimum length', () => {
	const tooShort = 'Abcdef1!Abcdef1';
	const longEnough = 'Abcdef1!Abcdef1!';

	it('is 16 characters', () => {
		expect(PASSWORD_MIN_LENGTH).toBe(16);
		expect(tooShort).toHaveLength(15);
		expect(longEnough).toHaveLength(16);
	});

	it('is the same rule the registration criteria apply', () => {
		const registrationLength = passwordCriteria[0].validation;
		expect(registrationLength(tooShort)).toBe(false);
		expect(registrationLength(longEnough)).toBe(true);
	});

	it('rejects a 15 character password in the change form', () => {
		expect(validatePasswordCriteria(tooShort).hasMinLength).toBe(false);
		expect(validatePasswordCriteria(longEnough).hasMinLength).toBe(true);
	});

	it('does not rate a 15 character password as strong', () => {
		expect(strengthIndicator(tooShort)).toBeLessThan(4);
		expect(strengthIndicator(longEnough)).toBe(4);
	});
});
