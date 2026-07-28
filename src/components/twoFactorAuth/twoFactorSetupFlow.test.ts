import { describe, expect, it } from 'vitest';
import { TWO_FACTOR_TYPES } from './twoFactorAuthConstants';
import {
	getNextSetupStep,
	getPreviousSetupStep,
	getSetupSteps,
	getStepIndex,
	getStepMethod,
	hasSetupStep,
	isOtpValid,
	normalizeOtp
} from './twoFactorSetupFlow';

describe('twoFactorSetupFlow', () => {
	it('routes the decision step into the selected app or email flow', () => {
		expect(getNextSetupStep('decision', TWO_FACTOR_TYPES.APP)).toBe(
			'app-install'
		);
		expect(getNextSetupStep('decision', TWO_FACTOR_TYPES.EMAIL)).toBe(
			'email-select'
		);
	});

	it('keeps app flow ordering stable', () => {
		expect(getSetupSteps('app-connect')).toEqual([
			expect.objectContaining({ key: 'decision' }),
			expect.objectContaining({ key: 'app-install' }),
			expect.objectContaining({ key: 'app-connect' }),
			expect.objectContaining({ key: 'app-verify' }),
			expect.objectContaining({ key: 'app-success' })
		]);
		expect(getNextSetupStep('app-connect', TWO_FACTOR_TYPES.APP)).toBe(
			'app-verify'
		);
		expect(getPreviousSetupStep('app-connect')).toBe('app-install');
	});

	it('keeps email flow ordering stable', () => {
		expect(getSetupSteps('email-connect')).toEqual([
			expect.objectContaining({ key: 'decision' }),
			expect.objectContaining({ key: 'email-select' }),
			expect.objectContaining({ key: 'email-connect' }),
			expect.objectContaining({ key: 'email-success' })
		]);
		expect(getNextSetupStep('email-select', TWO_FACTOR_TYPES.EMAIL)).toBe(
			'email-connect'
		);
		expect(getPreviousSetupStep('email-connect')).toBe('email-select');
	});

	it('derives method and index from the active setup step', () => {
		expect(getStepMethod('email-connect')).toBe(TWO_FACTOR_TYPES.EMAIL);
		expect(getStepMethod('app-verify')).toBe(TWO_FACTOR_TYPES.APP);
		expect(getStepIndex('email-connect')).toBe(2);
	});

	it('normalizes and validates six-digit OTP values', () => {
		expect(normalizeOtp('12 34-a567')).toBe('123456');
		expect(isOtpValid('123456')).toBe(true);
		expect(isOtpValid('12345')).toBe(false);
		expect(isOtpValid('12345a')).toBe(false);
	});

	it('guards unknown setup steps', () => {
		expect(hasSetupStep('decision')).toBe(true);
		expect(hasSetupStep('email-success')).toBe(true);
		expect(hasSetupStep('email-verify')).toBe(false);
	});
});
