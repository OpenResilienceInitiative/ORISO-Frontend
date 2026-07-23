import { describe, expect, it, vi } from 'vitest';
import { fetchData } from './fetchData';
import { apiSkipChatOccurrence } from './apiGetChatOccurrences';

vi.mock('../resources/scripts/endpoints', () => ({
	endpoints: { chatSeriesBase: '/service/users/chat-series/' }
}));

vi.mock('./fetchData', () => ({
	FETCH_METHODS: { POST: 'POST' },
	fetchData: vi.fn(() => Promise.resolve())
}));

describe('chat occurrence commands', () => {
	it('skips exactly the original occurrence instant', async () => {
		await apiSkipChatOccurrence(42, '2026-09-21T17:30:00Z');

		expect(fetchData).toHaveBeenCalledWith({
			url: '/service/users/chat-series/42/occurrences/skip?originalStartUtc=2026-09-21T17%3A30%3A00Z',
			method: 'POST'
		});
	});
});
