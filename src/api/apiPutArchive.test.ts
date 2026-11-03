import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

vi.mock('../resources/scripts/endpoints', () => ({
	endpoints: { sessionBase: '/service/users/sessions' }
}));

const fetchDataMock = vi.fn();
vi.mock('./fetchData', () => ({
	fetchData: (...args: unknown[]) => fetchDataMock(...args),
	FETCH_METHODS: { PUT: 'PUT' },
	FETCH_ERRORS: {
		CATCH_ALL: 'CATCH_ALL',
		CATCH_ALL_EXCEPT_UNAUTHORIZED: 'CATCH_ALL_EXCEPT_UNAUTHORIZED'
	}
}));

afterEach(() => fetchDataMock.mockReset());

// Without responseHandling, fetchData redirects to the error page on a 500
// before rejecting, so the local error overlay would never be shown.
describe('apiPutArchive', () => {
	it('rejects non-2xx locally but keeps the 401 logout path', async () => {
		fetchDataMock.mockResolvedValue({});
		const { apiPutArchive } = await import('./apiPutArchive');

		await apiPutArchive(7);

		expect(fetchDataMock).toHaveBeenCalledWith({
			url: '/service/users/sessions/7/archive',
			method: 'PUT',
			responseHandling: ['CATCH_ALL_EXCEPT_UNAUTHORIZED']
		});
	});
});

describe('apiPutDearchive', () => {
	it('keeps fetchData defaults unless the caller opts in', async () => {
		fetchDataMock.mockResolvedValue({});
		const { apiPutDearchive } = await import('./apiPutDearchive');

		await apiPutDearchive(7);

		expect(fetchDataMock).toHaveBeenCalledWith({
			url: '/service/users/sessions/7/dearchive',
			method: 'PUT',
			responseHandling: undefined
		});
	});

	it('rejects non-2xx locally when asked, keeping the 401 logout path', async () => {
		fetchDataMock.mockResolvedValue({});
		const { apiPutDearchive } = await import('./apiPutDearchive');

		await apiPutDearchive(7, ['CATCH_ALL_EXCEPT_UNAUTHORIZED']);

		expect(fetchDataMock).toHaveBeenCalledWith(
			expect.objectContaining({
				responseHandling: ['CATCH_ALL_EXCEPT_UNAUTHORIZED']
			})
		);
	});
});
