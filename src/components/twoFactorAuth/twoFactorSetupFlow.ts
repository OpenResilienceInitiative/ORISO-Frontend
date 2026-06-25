import {
	OTP_LENGTH,
	TWO_FACTOR_TYPES,
	TwoFactorType
} from './twoFactorAuthConstants';

export type TwoFactorSetupMethod =
	| typeof TWO_FACTOR_TYPES.APP
	| typeof TWO_FACTOR_TYPES.EMAIL;

export type TwoFactorSetupStep =
	| 'decision'
	| 'app-install'
	| 'app-connect'
	| 'app-verify'
	| 'app-success'
	| 'email-select'
	| 'email-connect'
	| 'email-success';

export interface TwoFactorSetupStepDefinition {
	key: TwoFactorSetupStep;
	icon: 'decision' | 'install' | 'select' | 'connect' | 'verify' | 'confirm';
	labelKey: string;
}

export const APP_SETUP_STEPS: TwoFactorSetupStepDefinition[] = [
	{
		key: 'decision',
		icon: 'decision',
		labelKey: 'twoFactorAuth.setupDialog.step.decide'
	},
	{
		key: 'app-install',
		icon: 'install',
		labelKey: 'twoFactorAuth.setupDialog.step.install'
	},
	{
		key: 'app-connect',
		icon: 'connect',
		labelKey: 'twoFactorAuth.setupDialog.step.connect'
	},
	{
		key: 'app-verify',
		icon: 'verify',
		labelKey: 'twoFactorAuth.setupDialog.step.verify'
	},
	{
		key: 'app-success',
		icon: 'confirm',
		labelKey: 'twoFactorAuth.setupDialog.step.confirm'
	}
];

export const EMAIL_SETUP_STEPS: TwoFactorSetupStepDefinition[] = [
	{
		key: 'decision',
		icon: 'decision',
		labelKey: 'twoFactorAuth.setupDialog.step.decide'
	},
	{
		key: 'email-select',
		icon: 'select',
		labelKey: 'twoFactorAuth.setupDialog.step.select'
	},
	{
		key: 'email-connect',
		icon: 'connect',
		labelKey: 'twoFactorAuth.setupDialog.step.connect'
	},
	{
		key: 'email-success',
		icon: 'confirm',
		labelKey: 'twoFactorAuth.setupDialog.step.confirm'
	}
];

const FLOW_ORDER: TwoFactorSetupStep[] = [
	'decision',
	'app-install',
	'app-connect',
	'app-verify',
	'app-success',
	'email-select',
	'email-connect',
	'email-success'
];

export const getStepMethod = (
	step: TwoFactorSetupStep,
	selectedMethod?: TwoFactorType
): TwoFactorSetupMethod =>
	step.startsWith('email')
		? TWO_FACTOR_TYPES.EMAIL
		: step.startsWith('app')
			? TWO_FACTOR_TYPES.APP
			: selectedMethod === TWO_FACTOR_TYPES.EMAIL
				? TWO_FACTOR_TYPES.EMAIL
				: TWO_FACTOR_TYPES.APP;

export const getSetupSteps = (
	step: TwoFactorSetupStep,
	selectedMethod?: TwoFactorType
): TwoFactorSetupStepDefinition[] =>
	getStepMethod(step, selectedMethod) === TWO_FACTOR_TYPES.EMAIL
		? EMAIL_SETUP_STEPS
		: APP_SETUP_STEPS;

export const getStepIndex = (
	step: TwoFactorSetupStep,
	selectedMethod?: TwoFactorType
): number => {
	const steps = getSetupSteps(step, selectedMethod);
	const index = steps.findIndex((item) => item.key === step);

	return index === -1 ? 0 : index;
};

export const getNextSetupStep = (
	step: TwoFactorSetupStep,
	method: TwoFactorSetupMethod
): TwoFactorSetupStep => {
	if (step === 'decision') {
		return method === TWO_FACTOR_TYPES.EMAIL
			? 'email-select'
			: 'app-install';
	}

	const steps = getSetupSteps(step, method);
	const nextStep = steps[getStepIndex(step, method) + 1];

	return nextStep?.key ?? step;
};

export const getPreviousSetupStep = (
	step: TwoFactorSetupStep
): TwoFactorSetupStep => {
	if (step === 'decision') {
		return step;
	}

	const method = getStepMethod(step);
	const previousStep = getSetupSteps(step, method)[
		getStepIndex(step, method) - 1
	];

	return previousStep?.key ?? 'decision';
};

export const normalizeOtp = (value: string): string =>
	value.replace(/\D/g, '').slice(0, OTP_LENGTH);

export const isOtpValid = (value: string): boolean =>
	new RegExp(`^\\d{${OTP_LENGTH}}$`).test(value);

export const hasSetupStep = (step: string): step is TwoFactorSetupStep =>
	FLOW_ORDER.includes(step as TwoFactorSetupStep);
