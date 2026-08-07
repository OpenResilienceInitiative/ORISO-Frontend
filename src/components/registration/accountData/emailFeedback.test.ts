import { describe, expect, it } from 'vitest';
import { getEmailFeedback } from './emailFeedback';

const base = {
	visible: true,
	required: false,
	wasBlurred: false,
	email: ''
};

describe('getEmailFeedback', () => {
	it('is satisfied and shows no error when the field is not visible at all, regardless of content', () => {
		const feedback = getEmailFeedback({
			...base,
			visible: false,
			required: true,
			email: 'not-an-email'
		});

		expect(feedback.isSatisfied).toBe(true);
		expect(feedback.hasError).toBe(false);
	});

	it('is satisfied when visible, optional and empty', () => {
		const feedback = getEmailFeedback({
			...base,
			required: false,
			email: ''
		});

		expect(feedback.isSatisfied).toBe(true);
		expect(feedback.hasError).toBe(false);
	});

	it('is not satisfied when visible, required and empty', () => {
		const feedback = getEmailFeedback({
			...base,
			required: true,
			email: ''
		});

		expect(feedback.isSatisfied).toBe(false);
	});

	it('only shows the required error after the field was blurred', () => {
		const feedback = getEmailFeedback({
			...base,
			required: true,
			email: '',
			wasBlurred: false
		});

		expect(feedback.hasError).toBe(false);

		const blurred = getEmailFeedback({
			...base,
			required: true,
			email: '',
			wasBlurred: true
		});

		expect(blurred.hasError).toBe(true);
		expect(blurred.helperTextKey).toBe(
			'registration.account.email.error.required'
		);
	});

	it('is not satisfied when filled with an invalid format, required or not', () => {
		const optional = getEmailFeedback({
			...base,
			required: false,
			email: 'not-an-email',
			wasBlurred: true
		});

		expect(optional.isSatisfied).toBe(false);
		expect(optional.hasError).toBe(true);
		expect(optional.helperTextKey).toBe(
			'registration.account.email.error.invalid'
		);
	});

	it('is satisfied with a valid email, required or optional', () => {
		const required = getEmailFeedback({
			...base,
			required: true,
			email: 'max@mustermann.de'
		});
		const optional = getEmailFeedback({
			...base,
			required: false,
			email: 'max@mustermann.de'
		});

		expect(required.isSatisfied).toBe(true);
		expect(required.hasError).toBe(false);
		expect(optional.isSatisfied).toBe(true);
		expect(optional.hasError).toBe(false);
	});

	it('does not flag an empty optional field as an error even after blur', () => {
		const feedback = getEmailFeedback({
			...base,
			required: false,
			email: '',
			wasBlurred: true
		});

		expect(feedback.hasError).toBe(false);
		expect(feedback.helperTextKey).toBe('registration.account.email.info');
	});
});
