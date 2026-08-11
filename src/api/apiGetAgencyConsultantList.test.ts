/**
 * #993 — the consultant list was swallowed twice: once here, once in the
 * composer. A 403 therefore looked exactly like "this agency has no other
 * consultants". The throwing variant exists so a caller can tell them apart.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../resources/scripts/endpoints', () => ({
	endpoints: { agencyConsultants: '/service/users/consultants' }
}));

const fetchDataMock = vi.fn();
vi.mock('./fetchData', () => ({
	fetchData: (...args: unknown[]) => fetchDataMock(...args),
	FETCH_METHODS: { GET: 'GET' },
	FETCH_ERRORS: { CATCH_ALL: 'CATCH_ALL' }
}));

const importModule = async () => await import('./apiGetAgencyConsultantList');

afterEach(() => {
	fetchDataMock.mockReset();
});

describe('agency consultant list', () => {
	it('asks for the consultants of the given agency', async () => {
		fetchDataMock.mockResolvedValue([]);
		const { fetchAgencyConsultantList } = await importModule();

		await fetchAgencyConsultantList('42');

		expect(fetchDataMock).toHaveBeenCalledWith(
			expect.objectContaining({
				url: '/service/users/consultants?agencyId=42'
			})
		);
	});

	it('lets the caller see a rejected request', async () => {
		fetchDataMock.mockRejectedValue(new Error('403'));
		const { fetchAgencyConsultantList } = await importModule();

		await expect(fetchAgencyConsultantList('42')).rejects.toThrow('403');
	});

	it('keeps the swallowing variant for callers that only want a list', async () => {
		fetchDataMock.mockRejectedValue(new Error('403'));
		const { apiGetAgencyConsultantList } = await importModule();

		await expect(apiGetAgencyConsultantList('42')).resolves.toEqual([]);
	});
});
