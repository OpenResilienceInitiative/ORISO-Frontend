import { passwordCriteria } from './accountData/passwordRules';

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
			return val.length > 4 && usernameRegex.test(val);
		}
	},
	age: {
		validation: (val = '') => /^\d+$/.test(val)
	},
	state: {
		validation: (val = '') => /^([0-9]|1[0-6])$/.test(val)
	}
};
