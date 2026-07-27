// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiGetIsUsernameAvailable } from './apiGetIsUsernameAvailable';
import { fetchData, FETCH_ERRORS } from './fetchData';

vi.mock('./fetchData', async () => {
	const actual =
		await vi.importActual<typeof import('./fetchData')>('./fetchData');
	return {
		...actual,
		fetchData: vi.fn()
	};
});

describe('apiGetIsUsernameAvailable', () => {
	afterEach(() => {
		vi.clearAllMocks();
	});

	it('returns true when the username is available (200)', async () => {
		vi.mocked(fetchData).mockResolvedValue({});

		await expect(
			apiGetIsUsernameAvailable('brave_otter_123')
		).resolves.toBe(true);
	});

	it('returns false when the username is taken (409 CONFLICT)', async () => {
		vi.mocked(fetchData).mockRejectedValue(
			new Error(FETCH_ERRORS.CONFLICT)
		);

		await expect(
			apiGetIsUsernameAvailable('brave_otter_123')
		).resolves.toBe(false);
	});

	it('rethrows on server errors (5xx -> CATCH_ALL) so callers can show a retry message instead of a validation error', async () => {
		vi.mocked(fetchData).mockRejectedValue(
			new Error(FETCH_ERRORS.CATCH_ALL)
		);

		await expect(
			apiGetIsUsernameAvailable('brave_otter_123')
		).rejects.toThrow(FETCH_ERRORS.CATCH_ALL);
	});

	it('rethrows on network errors so callers can show a retry message', async () => {
		vi.mocked(fetchData).mockRejectedValue(new TypeError('load failed'));

		await expect(
			apiGetIsUsernameAvailable('brave_otter_123')
		).rejects.toThrow('load failed');
	});
});
