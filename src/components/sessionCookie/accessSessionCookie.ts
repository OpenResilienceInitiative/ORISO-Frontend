const AUTH_STORAGE_KEYS: Record<string, string> = {
	keycloak: 'auth.keycloak',
	refreshToken: 'auth.refreshToken'
};

const getAuthStorageKey = (name: string) => AUTH_STORAGE_KEYS[name];

const setAuthStorageValue = (name: string, value: string) => {
	const storageKey = getAuthStorageKey(name);
	if (!storageKey) return;

	try {
		window.localStorage.setItem(storageKey, value);
	} catch {
		// Keep cookie-only behavior if localStorage is unavailable.
	}
};

const getAuthStorageValue = (name: string) => {
	const storageKey = getAuthStorageKey(name);
	if (!storageKey) return '';

	try {
		return window.localStorage.getItem(storageKey) ?? '';
	} catch {
		return '';
	}
};

const removeAuthStorageValue = (name: string) => {
	const storageKey = getAuthStorageKey(name);
	if (!storageKey) return;

	try {
		window.localStorage.removeItem(storageKey);
	} catch {
		// Keep cookie cleanup working if localStorage is unavailable.
	}
};

/**
 * Session cookies are written by the frontend, so they cannot be HttpOnly (FE-H01).
 * SameSite=Strict and, on https, the secure flag are the part we can enforce here:
 * they keep the cookie out of cross-site requests and off plaintext connections.
 * The secure flag is omitted on http so local development keeps working.
 */
const getCookieSecurityAttributes = () => {
	const secure = window.location.protocol === 'https:' ? '; secure' : '';
	return `SameSite=Strict${secure}`;
};

export const setValueInCookie = (
	name: string,
	value: string,
	path: string = '/'
) => {
	document.cookie = `${name}=${value};path=${path};${getCookieSecurityAttributes()}`;
	setAuthStorageValue(name, value);
};

export const deleteCookieByName = (name: string, path: string = '/') => {
	document.cookie = `${name}=; path=${path}; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
	removeAuthStorageValue(name);
};

export const getValueFromCookie = (targetValue: string) => {
	const targetName = targetValue + '=';
	const decodedCookie = decodeURIComponent(document.cookie);

	const ca = decodedCookie.split(';');

	for (let i = 0; i < ca.length; i++) {
		let c = ca[i];
		while (c.charAt(0) === ' ') {
			c = c.substring(1);
		}
		if (c.indexOf(targetName) === 0) {
			return c.substring(targetName.length, c.length);
		}
	}
	return getAuthStorageValue(targetValue);
};

export const removeAllCookies = (allowlist: string[] = []) => {
	const retainedCookies = [
		...allowlist,
		...(process.env.REACT_APP_COOKIES_ALLOWEDLIST ?? '').split(',')
	];

	document.cookie.split(';').forEach(function (c) {
		const name = c.trim().split('=')[0];
		if (retainedCookies.includes(name)) return;

		document.cookie =
			name + '=;path=/; expires=Thu, 27 May 1992 08:32:00 MET;';
	});

	Object.keys(AUTH_STORAGE_KEYS).forEach((name) => {
		if (!retainedCookies.includes(name)) {
			removeAuthStorageValue(name);
		}
	});
};
