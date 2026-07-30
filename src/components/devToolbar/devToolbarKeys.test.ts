import { describe, expect, it } from 'vitest';
import {
	canUseStoredValue,
	DEV_ONLY_SWITCH_KEYS,
	STORAGE_KEY_2FA,
	STORAGE_KEY_DISABLE_2FA_DUTY,
	STORAGE_KEY_LOCALE
} from './devToolbarKeys';
import { STORAGE_KEY_E2EE_DISABLED } from '../../utils/e2eeSettings';

describe('dev-only DevToolbar switches (FE-M10)', () => {
	it('treats the security-relevant switches as dev-only', () => {
		expect(DEV_ONLY_SWITCH_KEYS.has(STORAGE_KEY_E2EE_DISABLED)).toBe(true);
		expect(DEV_ONLY_SWITCH_KEYS.has(STORAGE_KEY_2FA)).toBe(true);
		expect(DEV_ONLY_SWITCH_KEYS.has(STORAGE_KEY_DISABLE_2FA_DUTY)).toBe(
			true
		);
	});

	it('ignores a stored value for dev-only switches outside development', () => {
		expect(canUseStoredValue(STORAGE_KEY_2FA, 'production')).toBe(false);
		expect(
			canUseStoredValue(STORAGE_KEY_DISABLE_2FA_DUTY, 'production')
		).toBe(false);
		expect(canUseStoredValue(STORAGE_KEY_E2EE_DISABLED, 'production')).toBe(
			false
		);
	});

	it('honours a stored value for dev-only switches during development', () => {
		expect(canUseStoredValue(STORAGE_KEY_2FA, 'development')).toBe(true);
		expect(
			canUseStoredValue(STORAGE_KEY_E2EE_DISABLED, 'development')
		).toBe(true);
	});

	it('leaves harmless switches usable everywhere', () => {
		expect(canUseStoredValue(STORAGE_KEY_LOCALE, 'production')).toBe(true);
		expect(canUseStoredValue(STORAGE_KEY_LOCALE, 'development')).toBe(true);
	});
});
