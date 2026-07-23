import { hasNumber, hasSpecialChar } from '../../../utils/validateInputValue';

export const passwordCriteria = [
	{
		info: 'registration.account.password.criteria1',
		validation: (val: string) => val.length >= 16
	},
	{
		info: 'registration.account.password.criteria2',
		validation: (val: string) => hasNumber(val)
	},
	{
		info: 'registration.account.password.criteria3',
		validation: (val: string) => /[A-Z]/.test(val)
	},
	{
		info: 'registration.account.password.criteria4',
		validation: (val: string) => /[a-z]/.test(val)
	},
	{
		info: 'registration.account.password.criteria5',
		validation: (val: string) => hasSpecialChar(val)
	}
] as const;

export const allPasswordCriteriaPass = (password: string): boolean =>
	passwordCriteria.every((criteria) => criteria.validation(password));
