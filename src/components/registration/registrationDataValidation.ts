import { passwordCriteria } from './accountData/passwordRules';

// Keep in sync with the UserService backend (UserHelper.USERNAME_MIN/MAX_LENGTH).
// The backend rejects usernames outside this range with HTTP 400, so the
// frontend must enforce the same bounds before submitting the registration.
export const USERNAME_MIN_LENGTH = 5;
export const USERNAME_MAX_LENGTH = 30;

interface RegistrationDataValidation {
	[key: string]: {
		validation(val?: string): boolean;
	};
}

export const REGISTRATION_DATA_VALIDATION: RegistrationDataValidation = {
	mainTopicId: {
		validation: (val) => !!val
	},
	agencyId: {
		validation: (val) => !!val
	},
	zipcode: {
		validation: (val) => {
			const reg = /^\d*$/;
			return Boolean(val && val.length === 5 && reg.test(val));
		}
	},
	password: {
		validation: (val = '') =>
			passwordCriteria.every((criteria) => criteria.validation(val))
	},
	username: {
		validation: (val = '') => {
			// Only allow lowercase letters, numbers, underscores and dashes
			const usernameRegex = /^[a-z0-9_-]+$/;
			return (
				val.length >= USERNAME_MIN_LENGTH &&
				val.length <= USERNAME_MAX_LENGTH &&
				usernameRegex.test(val)
			);
		}
	},
	age: {
		validation: (val = '') => /^\d+$/.test(val)
	},
	state: {
		validation: (val = '') => /^([0-9]|1[0-6])$/.test(val)
	}
};
