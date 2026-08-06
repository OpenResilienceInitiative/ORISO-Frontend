import { describe, expect, it, vi } from 'vitest';
import { acceptAccountInvite, getAccountInvite } from './apiAccountInvite';
import { fetchData } from './fetchData';

vi.mock('../resources/scripts/endpoints', () => ({
	endpoints: {
		accountInvite: (token: string) =>
			`https://api.oriso-dev.site/service/users/account-invites/${encodeURIComponent(token)}`
	}
}));

vi.mock('./fetchData', () => ({
	FETCH_ERRORS: {
		BAD_REQUEST: 'BAD_REQUEST',
		CONFLICT: 'CONFLICT',
		NO_MATCH: 'NO_MATCH'
	},
	FETCH_METHODS: { GET: 'GET', POST: 'POST' },
	FETCH_SUCCESS: { CONTENT: 'CONTENT' },
	fetchData: vi.fn()
}));

describe('account invite API', () => {
	it('loads invite details anonymously with an encoded token', async () => {
		vi.mocked(fetchData).mockResolvedValue({
			recipientEmail: 'lisa@oriso.org'
		});

		await getAccountInvite('token/with spaces');

		expect(fetchData).toHaveBeenCalledWith({
			url: 'https://api.oriso-dev.site/service/users/account-invites/token%2Fwith%20spaces',
			method: 'GET',
			skipAuth: true,
			responseHandling: ['BAD_REQUEST', 'NO_MATCH']
		});
	});

	it('accepts the fixed-email invite with username and password only', async () => {
		vi.mocked(fetchData).mockResolvedValue({
			inviteStatus: 'ACCEPTED',
			provisioningStatus: 'COMPLETED'
		});

		await acceptAccountInvite('raw-token', {
			username: 'lisa_counsellor',
			password: 'Valid-Password-2026!',
			formalLanguage: true
		});

		expect(fetchData).toHaveBeenCalledWith({
			url: 'https://api.oriso-dev.site/service/users/account-invites/raw-token/accept',
			method: 'POST',
			bodyData: JSON.stringify({
				username: 'lisa_counsellor',
				password: 'Valid-Password-2026!',
				formalLanguage: true
			}),
			skipAuth: true,
			responseHandling: ['BAD_REQUEST', 'CONFLICT', 'NO_MATCH', 'CONTENT']
		});
	});
});
