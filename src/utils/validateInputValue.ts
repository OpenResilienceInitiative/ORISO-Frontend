export const hasNumber = (value: string) => {
	return new RegExp(/[0-9]/).test(value);
};

export const hasMixedLetters = (value: string) => {
	return (
		new RegExp(/[a-zßäöü]/).test(value) &&
		new RegExp(/[A-ZÄÖÜ]/).test(value)
	);
};

export const hasSpecialChar = (value: string) => {
	return new RegExp(/[^a-zßäöüA-ZÄÖÜ0-9]/).test(value);
};

export const strengthColor = (count: number) => {
	if (count < 4) return 'red';

	if (count >= 4) return 'green';
};

// Single frontend source for the minimum password length; keep in sync with
// the Keycloak realm password policy. Registration, password change and
// password reset all use it (OBP 2.1 #116).
export const PASSWORD_MIN_LENGTH = 16;

export const strengthIndicator = (value: string) => {
	let passwordStrength: number = 0;

	if (value.length >= PASSWORD_MIN_LENGTH) passwordStrength++;

	if (hasNumber(value)) passwordStrength++;

	if (hasMixedLetters(value)) passwordStrength++;

	if (hasSpecialChar(value)) passwordStrength++;

	return passwordStrength;
};

export type passwordCriteria = {
	hasUpperLowerCase: boolean;
	hasNumber: boolean;
	hasSpecialChar: boolean;
	hasMinLength: boolean;
};

export const validatePasswordCriteria = (value: string) => {
	const passwordValidationParams: passwordCriteria = {
		hasUpperLowerCase: false,
		hasNumber: false,
		hasSpecialChar: false,
		hasMinLength: false
	};

	if (hasMixedLetters(value))
		passwordValidationParams.hasUpperLowerCase = true;
	if (hasNumber(value)) passwordValidationParams.hasNumber = true;
	if (hasSpecialChar(value)) passwordValidationParams.hasSpecialChar = true;
	if (value.length >= PASSWORD_MIN_LENGTH)
		passwordValidationParams.hasMinLength = true;

	return passwordValidationParams;
};

export const inputValuesFit = (firstValue: string, secondValue: string) => {
	if (firstValue === secondValue) return true;

	return false;
};
