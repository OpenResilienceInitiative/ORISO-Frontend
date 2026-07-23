import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
	CONSULTANT_LOGIN_BLOCKED_ERROR,
	consumeConsultantLoginBlocked,
	isConsultantAccessToken,
	markConsultantLoginBlocked
} from './consultantLoginBlock';

const createAccessToken = (payload: unknown) => {
	const encodedPayload = btoa(JSON.stringify(payload));
	return `header.${encodedPayload}.signature`;
};

describe('consultantLoginBlock', () => {
	beforeEach(() => {
		const storage = new Map<string, string>();
		globalThis.sessionStorage = {
			getItem: (key: string) => storage.get(key) ?? null,
			setItem: (key: string, value: string) => {
				storage.set(key, value);
			},
			removeItem: (key: string) => {
				storage.delete(key);
			},
			clear: () => {
				storage.clear();
			},
			key: () => null,
			length: 0
		};
	});

	afterEach(() => {
		delete (globalThis as { sessionStorage?: Storage }).sessionStorage;
	});

	it('uses a stable error code for blocked consultant logins', () => {
		expect(CONSULTANT_LOGIN_BLOCKED_ERROR).toBe('CONSULTANT_LOGIN_BLOCKED');
	});

	it('detects consultant access tokens', () => {
		const token = createAccessToken({
			realm_access: {
				roles: ['user', 'consultant']
			}
		});

		expect(isConsultantAccessToken(token)).toBe(true);
	});

	it('ignores non-consultant access tokens', () => {
		const token = createAccessToken({
			realm_access: {
				roles: ['user', 'asker']
			}
		});

		expect(isConsultantAccessToken(token)).toBe(false);
	});

	it('ignores missing access tokens', () => {
		expect(isConsultantAccessToken()).toBe(false);
	});

	it('marks and consumes a blocked-login redirect flag', () => {
		expect(consumeConsultantLoginBlocked()).toBe(false);

		markConsultantLoginBlocked();
		expect(consumeConsultantLoginBlocked()).toBe(true);
		expect(consumeConsultantLoginBlocked()).toBe(false);
	});
});
