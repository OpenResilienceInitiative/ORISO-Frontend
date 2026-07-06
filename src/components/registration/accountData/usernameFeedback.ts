/**
 * Maps the username-field state during registration to the helper text
 * shown under the input.
 *
 * Ordering matters: a failed availability check (5xx / network error on
 * `GET /service/users/availability/{name}`) must never surface as a
 * validation error such as "your username is too short" — it is a neutral,
 * retryable state that says nothing about the username itself.
 */

export interface UsernameFeedbackState {
	/** The user left the field at least once */
	wasBlurred: boolean;
	/** Local validation: minimum length reached */
	isLongEnough: boolean;
	/** Last availability check result (only meaningful when checked) */
	isAvailable: boolean;
	/** An availability check completed successfully */
	availabilityChecked: boolean;
	/** The availability check itself failed (5xx / network) */
	availabilityCheckFailed: boolean;
}

export interface UsernameFeedback {
	hasError: boolean;
	helperTextKey:
		| 'registration.account.username.error.retry'
		| 'registration.account.username.error.tooShort'
		| 'registration.account.username.error.unavailable'
		| 'registration.account.username.success'
		| 'registration.account.username.info';
}

export const getUsernameFeedback = (
	state: UsernameFeedbackState
): UsernameFeedback => {
	if (state.availabilityCheckFailed) {
		// Server hiccup — not a statement about the username. Show the
		// neutral "could not check, please retry" message.
		return {
			hasError: true,
			helperTextKey: 'registration.account.username.error.retry'
		};
	}
	if (state.wasBlurred && !state.isLongEnough) {
		return {
			hasError: true,
			helperTextKey: 'registration.account.username.error.tooShort'
		};
	}
	if (state.availabilityChecked && !state.isAvailable) {
		return {
			hasError: true,
			helperTextKey: 'registration.account.username.error.unavailable'
		};
	}
	if (state.availabilityChecked && state.isAvailable) {
		return {
			hasError: false,
			helperTextKey: 'registration.account.username.success'
		};
	}
	return {
		hasError: false,
		helperTextKey: 'registration.account.username.info'
	};
};
