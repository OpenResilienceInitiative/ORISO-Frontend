import { describe, expect, it, vi } from 'vitest';
import { apiServerSettings } from './apiServerSettings';
import { fetchData } from './fetchData';

vi.mock('../resources/scripts/endpoints', () => ({
	endpoints: {
		serviceSettings: 'https://api.oriso-dev.site/service/settings'
	}
}));

vi.mock('./fetchData', () => ({
	FETCH_METHODS: { GET: 'GET' },
	fetchData: vi.fn()
}));

describe('apiServerSettings', () => {
	it('loads public server settings without requiring auth', async () => {
		vi.mocked(fetchData).mockResolvedValue({
			multitenancyEnabled: { value: false }
		});

		await expect(apiServerSettings()).resolves.toEqual({
			multitenancyEnabled: { value: false }
		});

		expect(fetchData).toHaveBeenCalledWith({
			url: 'https://api.oriso-dev.site/service/settings',
			method: 'GET',
			skipAuth: true,
			responseHandling: []
		});
	});
});
