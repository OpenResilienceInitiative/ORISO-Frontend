import { describe, expect, it, vi } from 'vite-plus/test';
import {
	apiKeepTemporaryAccount,
	keepTemporaryAccountErrorKey
} from './apiKeepTemporaryAccount';
import { fetchData } from './fetchData';

vi.mock('../resources/scripts/endpoints', () => ({
	endpoints: {
		keepTemporaryAccount:
			'https://api.oriso-dev.site/service/users/temporary-account/keep'
	}
}));

vi.mock('./fetchData', () => ({
	FETCH_ERRORS: {
		BAD_REQUEST: 'BAD_REQUEST',
		CONFLICT: 'CONFLICT',
		FORBIDDEN: 'FORBIDDEN',
		NO_MATCH: 'NO_MATCH'
	},
	FETCH_METHODS: { POST: 'POST' },
	fetchData: vi.fn()
}));

describe('keep a temporary account (UserService#1662)', () => {
	it('posts the new password and handles the documented refusals', async () => {
		vi.mocked(fetchData).mockResolvedValue({});

		await apiKeepTemporaryAccount('Sonnenblume-2026-lang');

		expect(fetchData).toHaveBeenCalledWith({
			url: 'https://api.oriso-dev.site/service/users/temporary-account/keep',
			method: 'POST',
			bodyData: JSON.stringify({ password: 'Sonnenblume-2026-lang' }),
			responseHandling: [
				'BAD_REQUEST',
				'FORBIDDEN',
				'NO_MATCH',
				'CONFLICT'
			]
		});
	});

	it('names a German message for each refusal', () => {
		expect(keepTemporaryAccountErrorKey(new Error('BAD_REQUEST'))).toBe(
			'guestAccountMode.keep.error.badRequest'
		);
		expect(keepTemporaryAccountErrorKey(new Error('FORBIDDEN'))).toBe(
			'guestAccountMode.keep.error.forbidden'
		);
		expect(keepTemporaryAccountErrorKey(new Error('NO_MATCH'))).toBe(
			'guestAccountMode.keep.error.notFound'
		);
		expect(keepTemporaryAccountErrorKey(new Error('CONFLICT'))).toBe(
			'guestAccountMode.keep.error.conflict'
		);
		expect(keepTemporaryAccountErrorKey(new Error('TIMEOUT'))).toBe(
			'guestAccountMode.keep.error.generic'
		);
		expect(keepTemporaryAccountErrorKey('nonsense')).toBe(
			'guestAccountMode.keep.error.generic'
		);
	});
});
