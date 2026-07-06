import { describe, expect, it } from 'vitest';
import { getUsernameFeedback } from './usernameFeedback';

const base = {
	wasBlurred: false,
	isLongEnough: true,
	isAvailable: true,
	availabilityChecked: false,
	availabilityCheckFailed: false
};

describe('getUsernameFeedback', () => {
	it('maps a failed availability check (5xx / network) to the neutral retry message — never "too short"', () => {
		// Regression: a 28-char username with a 500 from
		// GET /service/users/availability/{name} used to show
		// "Ihr Benutzername ist zu kurz."
		const feedback = getUsernameFeedback({
			...base,
			wasBlurred: true,
			availabilityCheckFailed: true
		});

		expect(feedback.hasError).toBe(true);
		expect(feedback.helperTextKey).toBe(
			'registration.account.username.error.retry'
		);
	});

	it('prefers the retry message over stale availability results when the check failed', () => {
		const feedback = getUsernameFeedback({
			...base,
			availabilityChecked: true,
			isAvailable: false,
			availabilityCheckFailed: true
		});

		expect(feedback.helperTextKey).toBe(
			'registration.account.username.error.retry'
		);
	});

	it('maps a genuinely too short username (after blur) to the too-short message', () => {
		const feedback = getUsernameFeedback({
			...base,
			wasBlurred: true,
			isLongEnough: false
		});

		expect(feedback.hasError).toBe(true);
		expect(feedback.helperTextKey).toBe(
			'registration.account.username.error.tooShort'
		);
	});

	it('maps a taken username (409 result) to the unavailable message', () => {
		const feedback = getUsernameFeedback({
			...base,
			availabilityChecked: true,
			isAvailable: false
		});

		expect(feedback.hasError).toBe(true);
		expect(feedback.helperTextKey).toBe(
			'registration.account.username.error.unavailable'
		);
	});

	it('maps a successful check to the success message', () => {
		const feedback = getUsernameFeedback({
			...base,
			availabilityChecked: true
		});

		expect(feedback.hasError).toBe(false);
		expect(feedback.helperTextKey).toBe(
			'registration.account.username.success'
		);
	});

	it('shows the info text before any check ran', () => {
		const feedback = getUsernameFeedback(base);

		expect(feedback.hasError).toBe(false);
		expect(feedback.helperTextKey).toBe(
			'registration.account.username.info'
		);
	});

	it('does not flag a short username before the field was blurred', () => {
		const feedback = getUsernameFeedback({
			...base,
			isLongEnough: false
		});

		expect(feedback.hasError).toBe(false);
		expect(feedback.helperTextKey).toBe(
			'registration.account.username.info'
		);
	});
});
