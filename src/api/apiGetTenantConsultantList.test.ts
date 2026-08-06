import { describe, expect, it, vi } from 'vitest';
import { apiGetTenantConsultantList } from './apiGetAgencyConsultantList';
import { fetchData } from './fetchData';

vi.mock('../resources/scripts/endpoints', () => ({
	endpoints: {
		chatSeriesBase: 'https://api.example/service/users/chat-series/'
	}
}));

vi.mock('./fetchData', () => ({
	FETCH_ERRORS: { CATCH_ALL: 'CATCH_ALL' },
	FETCH_METHODS: { GET: 'GET' },
	fetchData: vi.fn(() => Promise.resolve([]))
}));

describe('apiGetTenantConsultantList', () => {
	it('loads the tenant-scoped Series invitation directory', async () => {
		await apiGetTenantConsultantList();

		expect(fetchData).toHaveBeenCalledWith({
			url: 'https://api.example/service/users/chat-series/consultants',
			method: 'GET',
			responseHandling: ['CATCH_ALL']
		});
	});
});
