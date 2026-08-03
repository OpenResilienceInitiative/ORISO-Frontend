import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiGetTenantAgenciesTopics } from './apiGetTenantAgenciesTopics';
import { fetchData } from './fetchData';

vi.mock('../resources/scripts/endpoints', () => ({
	endpoints: {
		agencyTopics: 'https://api.example/service/agencies/topics'
	}
}));

vi.mock('./fetchData', () => ({
	FETCH_ERRORS: { CATCH_ALL: 'CATCH_ALL' },
	FETCH_METHODS: { GET: 'GET' },
	fetchData: vi.fn()
}));

describe('apiGetTenantAgenciesTopics', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('keeps a topic array from the agency service', async () => {
		vi.mocked(fetchData).mockResolvedValue([
			{ id: 7, name: 'Children and young people' }
		]);

		await expect(apiGetTenantAgenciesTopics()).resolves.toEqual([
			{ id: 7, name: 'Children and young people' }
		]);
	});

	it('normalizes the empty 204 response object to an empty topic array', async () => {
		// fetchData resolves 204 No Content as `{}` unless EMPTY handling is
		// requested. The API boundary promises an array to its render callers.
		vi.mocked(fetchData).mockResolvedValue({});

		await expect(apiGetTenantAgenciesTopics()).resolves.toEqual([]);
	});
});
