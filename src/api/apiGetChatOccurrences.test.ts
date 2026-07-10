import { describe, expect, it, vi } from 'vitest';
import { apiGetChatOccurrences } from './apiGetChatOccurrences';
import { fetchData } from './fetchData';

vi.mock('../resources/scripts/endpoints', () => ({
	endpoints: { chatSeriesBase: '/service/users/chat-series/' }
}));

vi.mock('./fetchData', () => ({
	FETCH_METHODS: { GET: 'GET' },
	FETCH_SUCCESS: {},
	fetchData: vi.fn()
}));

describe('apiGetChatOccurrences', () => {
	it('encodes the bounded occurrence query on the Series URL', async () => {
		vi.mocked(fetchData).mockResolvedValue([]);

		await apiGetChatOccurrences(
			42,
			'2026-08-01T00:00:00+02:00',
			'2026-11-01T00:00:00+01:00',
			25
		);

		expect(fetchData).toHaveBeenCalledWith({
			url: '/service/users/chat-series/42/occurrences?from=2026-08-01T00%3A00%3A00%2B02%3A00&to=2026-11-01T00%3A00%3A00%2B01%3A00&limit=25',
			method: 'GET'
		});
	});
});
