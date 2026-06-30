import { describe, expect, it, vi } from 'vitest';
import { apiGetDraftMessage, apiPostDraftMessage } from './apiDraftMessages';
import { fetchData } from './fetchData';

vi.mock('../resources/scripts/endpoints', () => ({
	endpoints: {
		draftMessages: 'https://api.oriso-dev.site/service/messages/draft'
	}
}));

vi.mock('./fetchData', () => ({
	FETCH_ERRORS: {
		CATCH_ALL: 'CATCH_ALL',
		EMPTY: 'EMPTY'
	},
	FETCH_METHODS: {
		GET: 'GET',
		POST: 'POST'
	},
	FETCH_SUCCESS: {
		CONTENT: 'CONTENT'
	},
	fetchData: vi.fn()
}));

describe('apiDraftMessages', () => {
	it('posts a draft message with the room/session id header', async () => {
		vi.mocked(fetchData).mockResolvedValue(undefined);

		await apiPostDraftMessage('room-123', 'Draft body', 'E2EE');

		expect(fetchData).toHaveBeenCalledWith({
			url: 'https://api.oriso-dev.site/service/messages/draft',
			method: 'POST',
			headersData: { rcGroupId: 'room-123' },
			bodyData: JSON.stringify({ message: 'Draft body', t: 'E2EE' }),
			responseHandling: ['CATCH_ALL']
		});
	});

	it('gets a draft message and forwards abort signals', async () => {
		const controller = new AbortController();
		vi.mocked(fetchData).mockResolvedValue({
			message: 'Saved draft',
			t: 'PLAIN'
		});

		await expect(
			apiGetDraftMessage(99, controller.signal)
		).resolves.toEqual({
			message: 'Saved draft',
			t: 'PLAIN'
		});

		expect(fetchData).toHaveBeenCalledWith({
			url: 'https://api.oriso-dev.site/service/messages/draft',
			method: 'GET',
			headersData: { rcGroupId: 99 },
			responseHandling: ['EMPTY', 'CONTENT'],
			signal: controller.signal
		});
	});
});
