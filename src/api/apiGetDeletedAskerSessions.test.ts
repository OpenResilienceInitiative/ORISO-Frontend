import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

vi.mock('../resources/scripts/endpoints', () => ({
	endpoints: {
		consultantDeletedAskerSessions:
			'/service/users/sessions/consultants/deleted-askers'
	}
}));

const fetchDataMock = vi.fn();
vi.mock('./fetchData', () => ({
	fetchData: (...args: unknown[]) => fetchDataMock(...args),
	FETCH_METHODS: { GET: 'GET' },
	FETCH_ERRORS: { CATCH_ALL: 'CATCH_ALL', EMPTY: 'EMPTY' }
}));

const importModule = async () => await import('./apiGetDeletedAskerSessions');

afterEach(() => {
	fetchDataMock.mockReset();
});

describe('apiGetDeletedAskerSessions', () => {
	it('asks the deleted-askers endpoint and keeps well-formed rows', async () => {
		fetchDataMock.mockResolvedValue([
			{
				formerSessionId: 7,
				agencyId: 2,
				deletedAt: '2026-10-29T09:30:00Z'
			},
			{ formerSessionId: 'x', deletedAt: '2026-10-29T09:30:00Z' },
			{ formerSessionId: 8, deletedAt: 'not a date' }
		]);
		const { apiGetDeletedAskerSessions } = await importModule();

		await expect(apiGetDeletedAskerSessions()).resolves.toEqual([
			{
				formerSessionId: 7,
				agencyId: 2,
				deletedAt: '2026-10-29T09:30:00Z'
			}
		]);
		expect(fetchDataMock).toHaveBeenCalledWith(
			expect.objectContaining({
				url: '/service/users/sessions/consultants/deleted-askers',
				method: 'GET'
			})
		);
	});

	it('reads any failure as "no placeholders" so the list keeps working', async () => {
		fetchDataMock.mockRejectedValue(new Error('403'));
		const { apiGetDeletedAskerSessions } = await importModule();

		await expect(apiGetDeletedAskerSessions()).resolves.toEqual([]);
	});

	it('reads an empty answer as "no placeholders"', async () => {
		fetchDataMock.mockResolvedValue(null);
		const { apiGetDeletedAskerSessions } = await importModule();

		await expect(apiGetDeletedAskerSessions()).resolves.toEqual([]);
	});
});
