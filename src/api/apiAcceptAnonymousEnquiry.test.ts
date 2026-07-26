import { describe, expect, it, vi } from 'vitest';
import { fetchData } from './fetchData';
import { apiAcceptAnonymousEnquiry } from './apiAcceptAnonymousEnquiry';

vi.mock('../resources/scripts/endpoints', () => ({
	endpoints: {
		acceptAnonymousEnquiry: (sessionId: number | string) =>
			`/service/conversations/askers/anonymous/${sessionId}/accept`
	}
}));

vi.mock('./fetchData', () => ({
	FETCH_METHODS: { PUT: 'PUT' },
	FETCH_ERRORS: { CONFLICT: 'CONFLICT' },
	fetchData: vi.fn(() => Promise.resolve())
}));

describe('apiAcceptAnonymousEnquiry', () => {
	it('PUTs to the dedicated anonymous accept endpoint, not the registered one', async () => {
		await apiAcceptAnonymousEnquiry(103507);

		expect(fetchData).toHaveBeenCalledWith({
			url: '/service/conversations/askers/anonymous/103507/accept',
			method: 'PUT',
			sendChatUserHeaders: true,
			responseHandling: ['CONFLICT']
		});
	});
});
