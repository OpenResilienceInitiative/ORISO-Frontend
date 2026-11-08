// @vitest-environment oriso-jsdom
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';
import { observeAppSession } from './observeAppSession';
import { getValueFromCookie, setValueInCookie } from './accessSessionCookie';
import { REFRESH_TOKEN_VALID_UNTIL_KEY } from './accessSessionLocalStorage';

const appExpiryKey = REFRESH_TOKEN_VALID_UNTIL_KEY;
const notifyStorage = (key = appExpiryKey) => {
	window.dispatchEvent(
		new StorageEvent('storage', { key, storageArea: localStorage })
	);
};

const clearAuthCookies = () => {
	for (const name of ['keycloak', 'refreshToken']) {
		document.cookie = `${name}=;path=/;expires=Thu, 01 Jan 1970 00:00:00 GMT`;
	}
};

const setAppSession = (sid: string, rotation: number) => {
	const claims = btoa(
		JSON.stringify({
			iss: 'https://identity.example.test',
			sub: 'synthetic-account',
			sid,
			rotation
		})
	);
	const token = `header.${claims}.signature`;
	setValueInCookie('keycloak', token);
	setValueInCookie('refreshToken', token);
	return token;
};

describe('observe the mounted App session', () => {
	beforeEach(() => {
		localStorage.clear();
		document.cookie = 'keycloak=synthetic-access;path=/';
		document.cookie = 'refreshToken=synthetic-refresh;path=/';
		localStorage.setItem(appExpiryKey, '1');
	});

	afterEach(() => {
		clearAuthCookies();
		localStorage.clear();
	});

	it('ends a mounted view when the shared App session is removed by a peer', () => {
		const endView = vi.fn();
		const unsubscribe = observeAppSession(endView);

		clearAuthCookies();
		localStorage.removeItem(appExpiryKey);
		notifyStorage();

		expect(endView).toHaveBeenCalledTimes(1);
		unsubscribe();
	});

	it('accepts token renewal within the same session', () => {
		setAppSession('same-session', 1);
		const endView = vi.fn();
		const unsubscribe = observeAppSession(endView);
		setAppSession('same-session', 2);

		notifyStorage();

		expect(endView).not.toHaveBeenCalled();
		unsubscribe();
	});

	it('ends the old view after a new sign-in to the same account', () => {
		setAppSession('first-session', 1);
		const endView = vi.fn();
		const unsubscribe = observeAppSession(endView);
		const newToken = setAppSession('fresh-session', 1);
		const adminExpiryKey = 'oriso-admin.auth.refresh_token_valid_until';
		localStorage.setItem(adminExpiryKey, '2');

		notifyStorage(adminExpiryKey);
		expect(endView).not.toHaveBeenCalled();
		notifyStorage();

		expect(endView).toHaveBeenCalledTimes(1);
		expect(getValueFromCookie('keycloak')).toBe(newToken);
		expect(localStorage.getItem(adminExpiryKey)).toBe('2');
		unsubscribe();
	});

	it('rechecks a restored page and releases its listeners on unmount', () => {
		const endView = vi.fn();
		const unsubscribe = observeAppSession(endView);
		clearAuthCookies();

		window.dispatchEvent(new Event('pageshow'));
		window.dispatchEvent(new Event('pageshow'));

		expect(endView).toHaveBeenCalledTimes(1);
		unsubscribe();

		setAppSession('temporary-session', 1);
		const unmounted = vi.fn();
		const stop = observeAppSession(unmounted);
		stop();
		clearAuthCookies();
		notifyStorage();
		window.dispatchEvent(new Event('pageshow'));
		expect(unmounted).not.toHaveBeenCalled();
	});
});
