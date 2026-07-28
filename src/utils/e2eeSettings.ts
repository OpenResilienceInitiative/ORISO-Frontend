export const STORAGE_KEY_E2EE_DISABLED = 'e2ee_disabled';

export const isDevelopmentEnvironment = (nodeEnv?: string): boolean =>
	nodeEnv === 'development';

/**
 * localStorage E2EE disable flag is honoured only in development builds.
 */
export const resolveE2eeDisabledFromLocalStorage = (
	localStorageValue: string | null | undefined,
	nodeEnv?: string
): boolean => {
	if (!isDevelopmentEnvironment(nodeEnv)) {
		return false;
	}

	return parseInt(localStorageValue || '0', 10) === 1;
};

export const resolveIsE2eeEnabled = (
	settingEnabled: boolean | undefined | null,
	localStorageValue: string | null | undefined,
	nodeEnv?: string
): boolean => {
	if (resolveE2eeDisabledFromLocalStorage(localStorageValue, nodeEnv)) {
		return false;
	}

	return !!settingEnabled;
};
