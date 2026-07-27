// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setTokens } from '../auth/auth';
import { setValueInCookie } from '../sessionCookie/accessSessionCookie';
import { generateCsrfToken } from '../../utils/generateCsrfToken';
import {
	applyRedeemSessionCredentials,
	buildInviteSessionAppUrl
} from './inviteLinkHelpers';

vi.mock('../auth/auth', () => ({
	setTokens: vi.fn()
}));

vi.mock('../sessionCookie/accessSessionCookie', () => ({
	setValueInCookie: vi.fn()
}));

vi.mock('../../utils/generateCsrfToken', () => ({
	generateCsrfToken: vi.fn()
}));

const sessionResponse = {
	sessionId: 42,
	userName: 'anonymous-user',
	accessToken: 'access-token',
	refreshToken: 'refresh-token',
	expiresIn: 300,
	refreshExpiresIn: 600
};

describe('invite-link Matrix session handoff', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('stores only identity tokens and routes by session id', () => {
		applyRedeemSessionCredentials(sessionResponse);

		expect(setTokens).toHaveBeenCalledWith(
			'access-token',
			300,
			'refresh-token',
			600
		);
		expect(setValueInCookie).not.toHaveBeenCalled();
		expect(generateCsrfToken).toHaveBeenCalledWith(true);
		expect(buildInviteSessionAppUrl(42)).toBe(
			`${window.location.origin}/sessions/user/view/session/42`
		);
	});

	it('keeps the invite contract free of Rocket.Chat response fields', () => {
		const apiSource = readFileSync(
			join(process.cwd(), 'src/api/apiRedeemInviteLink.ts'),
			'utf8'
		);
		const helperSource = readFileSync(
			join(process.cwd(), 'src/components/invite/inviteLinkHelpers.ts'),
			'utf8'
		);

		expect(`${apiSource}\n${helperSource}`).not.toMatch(
			/rcUserId|rcToken|rcGroupId|rc_uid|rc_token/
		);
	});
});
