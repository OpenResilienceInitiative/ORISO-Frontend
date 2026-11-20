// @vitest-environment oriso-jsdom
import { afterEach, expect, it } from 'vite-plus/test';
import {
	deleteCookieByName,
	setValueInCookie
} from '../components/sessionCookie/accessSessionCookie';
import { getDraftAuthSessionIdentity } from './draftAuthSession';

const token = (sid: string) =>
	`x.${btoa(JSON.stringify({ iss: 'issuer', sub: 'subject', sid }))}.x`;

afterEach(() => {
	deleteCookieByName('keycloak');
	deleteCookieByName('refreshToken');
});

it('uses the actual access cookie and keeps identity stable across renewal', () => {
	setValueInCookie('keycloak', token('session'));
	const identity = getDraftAuthSessionIdentity();
	expect(identity).toBeTruthy();
	setValueInCookie('keycloak', token('session') + 'renewed');
	expect(getDraftAuthSessionIdentity()).toBe(identity);
	setValueInCookie('keycloak', token('another'));
	expect(getDraftAuthSessionIdentity()).not.toBe(identity);
});

it('only trusts an access mirror when its identity matches an actual refresh cookie', () => {
	window.localStorage.setItem('auth.keycloak', token('session'));
	expect(getDraftAuthSessionIdentity()).toBeNull();
	setValueInCookie('refreshToken', token('another'));
	expect(getDraftAuthSessionIdentity()).toBeNull();
	setValueInCookie('refreshToken', token('session'));
	expect(getDraftAuthSessionIdentity()).toBeTruthy();
	deleteCookieByName('refreshToken');
	expect(getDraftAuthSessionIdentity()).toBeNull();
});
