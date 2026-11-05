import { fetchData } from '../../api/fetchData';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	getConversionStatus,
	convertLiveChatAccount
} from './liveChatConversionApi';
vi.mock('../../api/fetchData', () => ({
	fetchData: vi.fn(),
	FETCH_METHODS: { GET: 'GET', POST: 'POST' },
	FETCH_ERRORS: { CATCH_ALL_WITH_RESPONSE: 'catch' },
	FETCH_SUCCESS: { CONTENT: 'content' }
}));
vi.mock('../../resources/scripts/endpoints', () => ({
	endpoints: {
		liveChatConversion: '/service/users/live-chat-account/conversion'
	}
}));
describe('Live Chat conversion API', () => {
	beforeEach(() => vi.resetAllMocks());
	it('rejects malformed state instead of treating it as a normal account', async () => {
		vi.mocked(fetchData).mockResolvedValue({});
		await expect(getConversionStatus()).rejects.toThrow();
	});
	it('rejects a conversion response without a usable login name', async () => {
		vi.mocked(fetchData).mockResolvedValue({ username: ' ' });
		await expect(
			convertLiveChatAccount('guest-a', 'intent', 'chosen-password-123')
		).rejects.toThrow('Missing login name');
	});
	it('posts a stable intent and accepts only a valid login name', async () => {
		vi.mocked(fetchData).mockResolvedValue({ username: 'guest-name' });
		await expect(
			convertLiveChatAccount('guest-a', 'intent', 'chosen-password-123')
		).resolves.toBe('guest-name');
		expect(fetchData).toHaveBeenCalledWith(
			expect.objectContaining({
				method: 'POST',
				bodyData: JSON.stringify({
					expectedUserId: 'guest-a',
					intentId: 'intent',
					password: 'chosen-password-123',
					recoveryKeySaved: true
				})
			})
		);
	});
});
