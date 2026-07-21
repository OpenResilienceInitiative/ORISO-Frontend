// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	apiRegisterMatrixRoomForSync,
	__resetMatrixSyncRegistrationCache
} from './apiMatrixSyncRegister';

const { fetchDataMock } = vi.hoisted(() => ({ fetchDataMock: vi.fn() }));
vi.mock('./fetchData', () => ({
	fetchData: (args: unknown) => fetchDataMock(args),
	FETCH_METHODS: { POST: 'POST' },
	FETCH_ERRORS: { CATCH_ALL: 'CATCH_ALL' }
}));

describe('apiRegisterMatrixRoomForSync', () => {
	beforeEach(() => {
		fetchDataMock.mockReset();
		fetchDataMock.mockResolvedValue({});
		__resetMatrixSyncRegistrationCache();
	});

	it('POSTs the session id to the matrix sync register endpoint', async () => {
		await apiRegisterMatrixRoomForSync(103293);

		expect(fetchDataMock).toHaveBeenCalledTimes(1);
		const call = fetchDataMock.mock.calls[0][0];
		expect(call.url).toContain('/service/matrix/sync/register/103293');
		expect(call.method).toBe('POST');
		expect(call.responseHandling).toEqual(['CATCH_ALL']);
	});

	it('registers each session only once per app lifetime', async () => {
		await apiRegisterMatrixRoomForSync(1);
		await apiRegisterMatrixRoomForSync(1);
		await apiRegisterMatrixRoomForSync(2);

		expect(fetchDataMock).toHaveBeenCalledTimes(2);
	});

	it('ignores missing session ids', async () => {
		await apiRegisterMatrixRoomForSync(undefined);
		await apiRegisterMatrixRoomForSync(null);

		expect(fetchDataMock).not.toHaveBeenCalled();
	});

	it('allows a retry after a failed registration and never throws', async () => {
		fetchDataMock.mockRejectedValueOnce(new Error('offline'));

		await expect(apiRegisterMatrixRoomForSync(7)).resolves.toBeUndefined();
		await apiRegisterMatrixRoomForSync(7);

		expect(fetchDataMock).toHaveBeenCalledTimes(2);
	});
});
