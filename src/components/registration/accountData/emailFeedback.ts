import { isStringValidEmail } from '../registrationHelpers';

/**
 * Maps the (tenant-configurable) email field state during registration to
 * the helper text shown under the input and whether it satisfies the
 * step's validation gate.
 */

export interface EmailFeedbackState {
	/** Tenant setting: is the field shown at all */
	visible: boolean;
	/** Tenant setting: is a value mandatory when the field is shown */
	required: boolean;
	/** The user left the field at least once */
	wasBlurred: boolean;
	email: string;
}

export interface EmailFeedback {
	hasError: boolean;
	/** Whether this field's state should block the step's "Next" gate */
	isSatisfied: boolean;
	helperTextKey?:
		| 'registration.account.email.error.required'
		| 'registration.account.email.error.invalid'
		| 'registration.account.email.info';
}

export const getEmailFeedback = (state: EmailFeedbackState): EmailFeedback => {
	if (!state.visible) {
		return { hasError: false, isSatisfied: true };
	}

	const trimmed = state.email.trim();
	const isEmpty = trimmed.length === 0;

	if (isEmpty) {
		if (state.required) {
			return {
				hasError: state.wasBlurred,
				isSatisfied: false,
				helperTextKey: state.wasBlurred
					? 'registration.account.email.error.required'
					: 'registration.account.email.info'
			};
		}
		return {
			hasError: false,
			isSatisfied: true,
			helperTextKey: 'registration.account.email.info'
		};
	}

	if (!isStringValidEmail(trimmed)) {
		return {
			hasError: true,
			isSatisfied: false,
			helperTextKey: 'registration.account.email.error.invalid'
		};
	}

	return { hasError: false, isSatisfied: true };
};
