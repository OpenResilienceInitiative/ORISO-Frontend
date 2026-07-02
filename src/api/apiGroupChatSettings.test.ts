import { describe, expect, it, vi } from 'vitest';
import { apiCreateGroupChat, apiUpdateGroupChat } from './apiGroupChatSettings';
import { fetchData } from './fetchData';

vi.mock('../resources/scripts/endpoints', () => ({
	endpoints: {
		groupChatBase: 'https://api.oriso-dev.site/service/users/chat/'
	}
}));

vi.mock('./fetchData', () => ({
	FETCH_METHODS: { POST: 'POST', PUT: 'PUT' },
	FETCH_SUCCESS: { CONTENT: 'CONTENT' },
	fetchData: vi.fn()
}));

const groupChat = {
	topic: 'Stress support',
	startDate: '2026-07-01',
	startTime: '10:00',
	duration: 60,
	agencyId: 17,
	hintMessage: 'Welcome',
	repetitive: false
};

describe('group chat API helpers', () => {
	it('creates a v1 chat room and returns the backend link data', async () => {
		vi.mocked(fetchData).mockResolvedValue({ groupId: 'group-123' });

		await expect(apiCreateGroupChat(groupChat)).resolves.toEqual({
			groupId: 'group-123'
		});

		expect(fetchData).toHaveBeenCalledWith({
			url: 'https://api.oriso-dev.site/service/users/chat/new',
			method: 'POST',
			bodyData: JSON.stringify(groupChat),
			responseHandling: ['CONTENT']
		});
	});

	it('creates a v2 chat room when the feature flag is enabled', async () => {
		vi.mocked(fetchData).mockResolvedValue({ groupId: 'group-v2' });

		await apiCreateGroupChat({
			...groupChat,
			featureGroupChatV2Enabled: true
		});

		expect(fetchData).toHaveBeenCalledWith(
			expect.objectContaining({
				url: 'https://api.oriso-dev.site/service/users/chat/v2/new',
				method: 'POST'
			})
		);
	});

	it('updates an existing chat room', async () => {
		vi.mocked(fetchData).mockResolvedValue({ groupId: 'group-123' });

		await apiUpdateGroupChat(123, groupChat);

		expect(fetchData).toHaveBeenCalledWith({
			url: 'https://api.oriso-dev.site/service/users/chat/123/update',
			method: 'PUT',
			bodyData: JSON.stringify(groupChat),
			responseHandling: ['CONTENT']
		});
	});
});
