import { describe, expect, it } from 'vitest';
import { getUsernameHelperTextKey } from './usernameHelperText';

describe('getUsernameHelperTextKey', () => {
	it('shows the retry message when username availability check failed', () => {
		expect(
			getUsernameHelperTextKey({
				usernameHasError: true,
				usernameAvailabilityFailed: true,
				isUsernameAvailable: true,
				usernameAvailabilityChecked: false
			})
		).toBe('registration.account.username.error.retry');
	});

	it('shows the too-short message only for local username validation errors', () => {
		expect(
			getUsernameHelperTextKey({
				usernameHasError: true,
				usernameAvailabilityFailed: false,
				isUsernameAvailable: true,
				usernameAvailabilityChecked: false
			})
		).toBe('registration.account.username.error.tooShort');
	});
});
