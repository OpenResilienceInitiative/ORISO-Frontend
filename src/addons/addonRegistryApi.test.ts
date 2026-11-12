// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchData } from '../api/fetchData';
import { apiGetAddonRegistry } from './addonRegistryApi';

vi.mock('../api/fetchData', async (importOriginal) => ({
	...(await importOriginal<typeof import('../api/fetchData')>()),
	fetchData: vi.fn()
}));

describe('apiGetAddonRegistry', () => {
	afterEach(() => vi.mocked(fetchData).mockReset());

	it('sends the case context as headers', async () => {
		vi.mocked(fetchData).mockResolvedValue({
			contract: 'oriso-addon/v1',
			addons: []
		});
		await apiGetAddonRegistry({ agencyId: 3, sessionId: 42 });
		expect(vi.mocked(fetchData).mock.calls[0][0].headersData).toEqual({
			'X-Oriso-Agency-Id': '3',
			'X-Oriso-Session-Id': '42'
		});
	});

	it('sends no context without one', async () => {
		vi.mocked(fetchData).mockResolvedValue({
			contract: 'oriso-addon/v1',
			addons: []
		});
		await apiGetAddonRegistry();
		expect(vi.mocked(fetchData).mock.calls[0][0].headersData).toEqual({
			'X-Oriso-Agency-Id': undefined,
			'X-Oriso-Session-Id': undefined
		});
	});
});
