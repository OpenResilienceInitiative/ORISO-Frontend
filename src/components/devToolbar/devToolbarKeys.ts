import { STORAGE_KEY_E2EE_DISABLED } from '../../utils/e2eeSettings';

export const STORAGE_KEY_LOCALE = 'locale';
export const STORAGE_KEY_2FA = '2fa';
export const STORAGE_KEY_DISABLE_2FA_DUTY = 'disable 2fa_duty';

/**
 * Switches that weaken a security control and must therefore never be honoured
 * outside a local development build (FE-M10). Hiding them from the toolbar UI is
 * not enough - the stored value has to be ignored as well, otherwise anyone can
 * set the localStorage key by hand in production.
 */
export const DEV_ONLY_SWITCH_KEYS = new Set([
	STORAGE_KEY_E2EE_DISABLED,
	STORAGE_KEY_2FA,
	STORAGE_KEY_DISABLE_2FA_DUTY
]);

export const canUseStoredValue = (
	key: string,
	nodeEnv: string = process.env.NODE_ENV
): boolean => !DEV_ONLY_SWITCH_KEYS.has(key) || nodeEnv === 'development';
