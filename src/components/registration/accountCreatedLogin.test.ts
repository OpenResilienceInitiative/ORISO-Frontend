// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	clearAccountCreatedLogin,
	readAccountCreatedLogin,
	stageAccountCreatedLogin
} from './accountCreatedLogin';

/**
 * A registration that created the account but could not log it in sends the
 * person to the login page (#1533). The login page has to know why they are
 * there, and which User-ID they just chose — across a document load, so the
 * handoff goes through session storage: this tab only, read once, and never
 * the password.
 */
describe('account-created login handoff', () => {
	afterEach(() => {
		vi.restoreAllMocks();
		sessionStorage.clear();
	});

	it('hands the User-ID to the login page', () => {
		stageAccountCreatedLogin('blaue-wolke');

		expect(readAccountCreatedLogin()).toEqual({ username: 'blaue-wolke' });
	});

	it('is gone once the login page has cleared it', () => {
		stageAccountCreatedLogin('blaue-wolke');
		clearAccountCreatedLogin();

		expect(readAccountCreatedLogin()).toBeNull();
	});

	it('reports nothing on an ordinary visit to the login page', () => {
		expect(readAccountCreatedLogin()).toBeNull();
	});

	it('never stores the password', () => {
		stageAccountCreatedLogin('blaue-wolke');

		const stored = Object.keys(sessionStorage).map((key) =>
			sessionStorage.getItem(key)
		);
		expect(stored.join(' ')).not.toMatch(/password/i);
	});

	it('ignores a value it did not write', () => {
		sessionStorage.setItem('oriso.accountCreatedLogin', '{"username":42}');
		expect(readAccountCreatedLogin()).toBeNull();

		sessionStorage.setItem('oriso.accountCreatedLogin', 'not json');
		expect(readAccountCreatedLogin()).toBeNull();
	});

	it('does not throw when the browser refuses storage', () => {
		vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
			throw new Error('storage is disabled');
		});
		vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
			throw new Error('storage is disabled');
		});
		vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
			throw new Error('storage is disabled');
		});

		expect(() => stageAccountCreatedLogin('blaue-wolke')).not.toThrow();
		expect(readAccountCreatedLogin()).toBeNull();
		expect(() => clearAccountCreatedLogin()).not.toThrow();
	});
});
