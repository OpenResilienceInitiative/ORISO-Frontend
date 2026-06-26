export const OTP_LENGTH = 6;

export const TWO_FACTOR_TYPES = {
	EMAIL: 'EMAIL',
	APP: 'APP',
	NONE: ''
} as const;

export type TwoFactorType =
	(typeof TWO_FACTOR_TYPES)[keyof typeof TWO_FACTOR_TYPES];
