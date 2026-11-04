// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchData } from '../../../api/fetchData';
import { endpoints } from '../../../resources/scripts/endpoints';
import { loadInternalChatColleagues } from './loadInternalChatColleagues';

vi.mock('../../../api/fetchData', () => ({
	fetchData: vi.fn(),
	FETCH_ERRORS: { CATCH_ALL: 'Request failed' },
	FETCH_METHODS: { GET: 'GET' }
}));

beforeEach(() => vi.resetAllMocks());

describe('loadInternalChatColleagues', () => {
	it('uses the same directory for all scopes and preserves the metadata', async () => {
		const recipients = [
			{
				consultantId: 'peer',
				displayName: 'Maria Muster',
				tenantName: 'Another organisation',
				agencies: [{ id: 2, name: 'Centre two' }]
			}
		];
		vi.mocked(fetchData).mockResolvedValue(recipients);
		await expect(loadInternalChatColleagues(7)).resolves.toEqual(
			recipients
		);
		expect(fetchData).toHaveBeenCalledWith(
			expect.objectContaining({
				method: 'GET',
				url: `${endpoints.internalSubsetChat}/recipients?agencyId=7`
			})
		);
	});

	it('returns an empty list when the server answers 204', async () => {
		vi.mocked(fetchData).mockResolvedValue({});
		await expect(loadInternalChatColleagues(7)).resolves.toEqual([]);
	});

	it('propagates a failed request so the picker offers a retry', async () => {
		vi.mocked(fetchData).mockRejectedValue(new Error('Request failed'));
		await expect(loadInternalChatColleagues(7)).rejects.toThrow(
			'Request failed'
		);
	});
});
