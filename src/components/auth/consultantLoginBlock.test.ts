import { describe, expect, it } from 'vitest';

import {
	CONSULTANT_LOGIN_BLOCKED_ERROR,
	isConsultantAccessToken
} from './consultantLoginBlock';

const createAccessToken = (payload: unknown) => {
	const encodedPayload = btoa(JSON.stringify(payload));
	return `header.${encodedPayload}.signature`;
};

describe('consultantLoginBlock', () => {
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
});
