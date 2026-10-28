import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

vi.mock('../resources/scripts/endpoints', () => ({
	endpoints: {
		agencyAdminContacts: (id: number) =>
			`/service/users/agencies/${id}/admin-contacts`
	}
}));

const fetchDataMock = vi.fn();
vi.mock('./fetchData', () => ({
	fetchData: (...args: unknown[]) => fetchDataMock(...args),
	FETCH_METHODS: { GET: 'GET' },
	FETCH_ERRORS: {
		CATCH_ALL: 'CATCH_ALL',
		CATCH_ALL_EXCEPT_UNAUTHORIZED: 'CATCH_ALL_EXCEPT_UNAUTHORIZED'
	}
}));

const importModule = async () => await import('./apiGetAgencyAdminContacts');

afterEach(() => fetchDataMock.mockReset());

describe('apiGetAgencyAdminContacts', () => {
	it('asks for the admins of the given centre', async () => {
		fetchDataMock.mockResolvedValue([
			{ consultantId: 'a1', displayName: 'Maria Muster' }
		]);
		const { apiGetAgencyAdminContacts } = await importModule();

		await expect(apiGetAgencyAdminContacts(7)).resolves.toEqual([
			{ consultantId: 'a1', displayName: 'Maria Muster' }
		]);
		expect(fetchDataMock).toHaveBeenCalledWith(
			expect.objectContaining({
				url: '/service/users/agencies/7/admin-contacts',
				method: 'GET'
			})
		);
	});

	it('keeps the logout on 401 (does not swallow a revoked session)', async () => {
		fetchDataMock.mockResolvedValue([]);
		const { apiGetAgencyAdminContacts } = await importModule();

		await apiGetAgencyAdminContacts(7);
		expect(fetchDataMock).toHaveBeenCalledWith(
			expect.objectContaining({
				responseHandling: ['CATCH_ALL_EXCEPT_UNAUTHORIZED']
			})
		);
	});

	it('reads an empty answer (204 resolves as {}) as nobody to contact', async () => {
		fetchDataMock.mockResolvedValue({});
		const { apiGetAgencyAdminContacts } = await importModule();
		await expect(apiGetAgencyAdminContacts(7)).resolves.toEqual([]);
	});

	it('drops entries without an id instead of inviting nobody', async () => {
		fetchDataMock.mockResolvedValue([
			{ displayName: 'No id' },
			null,
			{ consultantId: 'a2', displayName: 'Ali' }
		]);
		const { apiGetAgencyAdminContacts } = await importModule();
		await expect(apiGetAgencyAdminContacts(7)).resolves.toEqual([
			{ consultantId: 'a2', displayName: 'Ali' }
		]);
	});

	it('rejects when the request fails, so "none" and "error" differ', async () => {
		fetchDataMock.mockRejectedValue(new Error('CATCH_ALL'));
		const { apiGetAgencyAdminContacts } = await importModule();
		await expect(apiGetAgencyAdminContacts(7)).rejects.toThrow();
	});
});
