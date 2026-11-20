export const ACCESS_TOKEN_VALID_UNTIL_KEY = 'auth.access_token_valid_until';
export const REFRESH_TOKEN_VALID_UNTIL_KEY = 'auth.refresh_token_valid_until';

export type LocalStorageKey =
	| typeof ACCESS_TOKEN_VALID_UNTIL_KEY
	| typeof REFRESH_TOKEN_VALID_UNTIL_KEY;

export const getLocalStorageItem = (key: LocalStorageKey): string => {
	return localStorage.getItem(key);
};

export const removeLocalStorageItem = (key: LocalStorageKey): void => {
	localStorage.removeItem(key);
};

export const setTokenExpiryInLocalStorage = (
	key: LocalStorageKey,
	expiresInMs: number
) => {
	const validUntilTime = new Date().getTime() + expiresInMs * 1000;
	localStorage.setItem(key, validUntilTime.toString());
};

export const getTokenExpiryFromLocalStorage = () => {
	return {
		accessTokenValidUntilTime: parseInt(
			getLocalStorageItem(ACCESS_TOKEN_VALID_UNTIL_KEY) ?? '0'
		),
		refreshTokenValidUntilTime: parseInt(
			getLocalStorageItem(REFRESH_TOKEN_VALID_UNTIL_KEY) ?? '0'
		)
	};
};

export const removeTokenExpiryFromLocalStorage = () => {
	removeLocalStorageItem(ACCESS_TOKEN_VALID_UNTIL_KEY);
	removeLocalStorageItem(REFRESH_TOKEN_VALID_UNTIL_KEY);
};
