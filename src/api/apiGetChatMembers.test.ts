import { describe, expect, it, vi } from 'vitest';
import { apiGetChatMembers } from './apiGetChatMembers';
import { fetchData } from './fetchData';
vi.mock('../resources/scripts/endpoints', () => ({
	endpoints: { groupChatBase: 'https://api.example/service/users/chat/' }
}));
vi.mock('./fetchData', () => ({
	FETCH_METHODS: { GET: 'GET' },
	FETCH_SUCCESS: { CONTENT: 'CONTENT' },
	FETCH_ERRORS: { FORBIDDEN: 'FORBIDDEN', NO_MATCH: 'NO_MATCH' },
	fetchData: vi.fn(() => Promise.resolve({ members: [] }))
}));
describe('existing group members read contract', () => {
	it('uses the singular chat route and returns the secured response', async () => {
		expect(await apiGetChatMembers(42)).toEqual({ members: [] });
		expect(fetchData).toHaveBeenCalledWith({
			url: 'https://api.example/service/users/chat/42/members',
			method: 'GET',
			responseHandling: ['CONTENT', 'FORBIDDEN', 'NO_MATCH']
		});
	});
});
