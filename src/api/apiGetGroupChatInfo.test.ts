import { expect, it, vi } from 'vite-plus/test';
import { apiGetGroupChatInfo } from './apiGetGroupChatInfo';
import { fetchData } from './fetchData';

vi.mock('../resources/scripts/endpoints', () => ({
	endpoints: { groupChatBase: '/service/users/chat/' }
}));

vi.mock('./fetchData', () => ({
	FETCH_METHODS: { GET: 'GET' },
	FETCH_SUCCESS: {},
	FETCH_ERRORS: {},
	fetchData: vi.fn()
}));

it('requests the caller ban state only on an explicitly opted-in group read', async () => {
	const signal = new AbortController().signal;
	await apiGetGroupChatInfo(15);
	await apiGetGroupChatInfo(15, { includeCallerBan: true, signal });

	expect(fetchData).toHaveBeenNthCalledWith(
		1,
		expect.objectContaining({
			method: 'GET',
			url: '/service/users/chat/15'
		})
	);
	expect(fetchData).toHaveBeenNthCalledWith(
		2,
		expect.objectContaining({
			method: 'GET',
			url: '/service/users/chat/15?includeCallerBan=true',
			signal
		})
	);
});
