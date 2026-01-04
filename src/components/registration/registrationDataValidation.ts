import { passwordCriteria } from './accountData/AccountData';

interface RegistrationDataValidation {
	[key: string]: {
		validation(val: string): boolean;
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
		validation: (val: string) => {
			const reg = /^\d*$/;
			return val.length === 5 && reg.test(val);
		}
	},
	password: {
		validation: (val) =>
			passwordCriteria.every((criteria) => criteria.validation(val))
	},
	username: {
		validation: (val) => {
			// Only allow lowercase letters, numbers, underscores and dashes
			const usernameRegex = /^[a-z0-9_-]+$/;
			return val.length > 4 && usernameRegex.test(val);
		}
	}
};
