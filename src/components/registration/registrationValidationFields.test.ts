import { describe, expect, it } from 'vitest';
import { REGISTRATION_DATA_VALIDATION } from './registrationDataValidation';
import {
	getRegistrationValidationFields,
	toRegistrationValidationField
} from './registrationValidationFields';

describe('getRegistrationValidationFields', () => {
	it('maps step mandatory field names to validation keys', () => {
		expect(toRegistrationValidationField('mainTopic')).toBe('mainTopicId');
		expect(toRegistrationValidationField('agency')).toBe('agencyId');
		expect(toRegistrationValidationField('username')).toBe('username');
	});

	it('returns only keys that exist in REGISTRATION_DATA_VALIDATION', () => {
		const fields = getRegistrationValidationFields([
			{ mandatoryFields: ['mainTopic'] },
			{ mandatoryFields: ['username', 'password'] }
		]);

		fields.forEach((field) => {
			expect(REGISTRATION_DATA_VALIDATION[field]).toBeDefined();
		});
		expect(fields).not.toContain('mainTopic');
		expect(fields).not.toContain('agency');
	});
});
