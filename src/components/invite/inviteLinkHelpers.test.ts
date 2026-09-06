// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setTokens } from '../auth/auth';
import { setValueInCookie } from '../sessionCookie/accessSessionCookie';
import { generateCsrfToken } from '../../utils/generateCsrfToken';
import { apiPutSessionData } from '../../api/apiPutSessionData';
import {
	applyRedeemSessionCredentials,
	assignInviteSessionDisplayName,
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

vi.mock('../../api/apiPutSessionData', () => ({
	apiPutSessionData: vi.fn()
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

describe('animal display name for a server-created invite session', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	// The backend mints anon_N for a Live Chat redeem and sets no display
	// name, so without this the counsellor sees anon_N for every guest.
	it('stores an animal display name against the session', async () => {
		vi.mocked(apiPutSessionData).mockResolvedValue(undefined);

		const displayName = await assignInviteSessionDisplayName(
			sessionResponse,
			'de'
		);

		expect(apiPutSessionData).toHaveBeenCalledWith(42, { displayName });
		expect(displayName).toBeTruthy();
		// Three parts: adjective, animal, given name.
		expect(displayName?.trim().split(/\s+/).length).toBeGreaterThanOrEqual(
			2
		);
	});

	it('never leaves the User-ID as the name it stores', async () => {
		vi.mocked(apiPutSessionData).mockResolvedValue(undefined);

		const displayName = await assignInviteSessionDisplayName(
			sessionResponse,
			'de'
		);

		expect(displayName).not.toMatch(/^anon_/);
	});

	// The name is a courtesy; the chat is not. A failed write must not cost
	// the guest their session.
	it('resolves to null when the write fails', async () => {
		vi.mocked(apiPutSessionData).mockRejectedValue(new Error('offline'));

		await expect(
			assignInviteSessionDisplayName(sessionResponse, 'de')
		).resolves.toBeNull();
	});
});
