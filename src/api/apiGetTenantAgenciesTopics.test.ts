import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiGetTenantAgenciesTopics } from './apiGetTenantAgenciesTopics';
import { fetchData } from './fetchData';

vi.mock('../resources/scripts/endpoints', () => ({
	endpoints: {
		agencyTopics: 'https://api.example/service/agencies/topics'
	}
}));

vi.mock('./fetchData', () => ({
	FETCH_ERRORS: { CATCH_ALL: 'CATCH_ALL', EMPTY: 'EMPTY' },
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

	it('maps an explicit 204/EMPTY response to an empty topic array', async () => {
		vi.mocked(fetchData).mockRejectedValue(new Error('EMPTY'));

		await expect(apiGetTenantAgenciesTopics()).resolves.toEqual([]);
		expect(fetchData).toHaveBeenCalledWith(
			expect.objectContaining({
				responseHandling: expect.arrayContaining(['EMPTY'])
			})
		);
	});

	it('does not disguise an unexpected successful response envelope as no topics', async () => {
		const unexpectedResponse = { unexpected: true };
		vi.mocked(fetchData).mockResolvedValue(unexpectedResponse);

		await expect(apiGetTenantAgenciesTopics()).resolves.toBe(
			unexpectedResponse
		);
	});
});
