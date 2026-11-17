// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiGetAddonRegistry } from './addonRegistryApi';

const addon = {
	name: 'tools',
	version: '0.1.0',
	react: '^19',
	entry: '/service/addons/tools/ui/entry.js',
	apiBase: '/service/addons/tools/api',
	apps: [
		{ id: 'goals', title: { de: 'Ziele' }, slots: ['consultant.session'] }
	]
};

const answer = (body: unknown, status = 200) =>
	vi.spyOn(globalThis, 'fetch').mockResolvedValue(
		new Response(JSON.stringify(body), {
			status,
			headers: { 'Content-Type': 'application/json' }
		})
	);

const sentHeaders = () =>
	(vi.mocked(globalThis.fetch).mock.calls[0][0] as Request).headers;

describe('apiGetAddonRegistry', () => {
	afterEach(() => vi.restoreAllMocks());

	it('reads the add-ons from the JSON answer when it sends a case context', async () => {
		answer({ contract: 'oriso-addon/v1', addons: [addon] });

		await expect(
			apiGetAddonRegistry({ agencyId: 3, sessionId: 42 })
		).resolves.toEqual([addon]);
		expect(sentHeaders().get('X-Oriso-Agency-Id')).toBe('3');
		expect(sentHeaders().get('X-Oriso-Session-Id')).toBe('42');
	});

	it('sends no context headers without a context', async () => {
		answer({ contract: 'oriso-addon/v1', addons: [addon] });

		await expect(apiGetAddonRegistry()).resolves.toEqual([addon]);
		expect(sentHeaders().has('X-Oriso-Agency-Id')).toBe(false);
		expect(sentHeaders().has('X-Oriso-Session-Id')).toBe(false);
	});

	it('reports no AddonService for another contract or a failed request', async () => {
		answer({ contract: 'oriso-addon/v2', addons: [addon] });
		await expect(apiGetAddonRegistry()).resolves.toBeNull();
		vi.restoreAllMocks();

		answer({}, 500);
		await expect(apiGetAddonRegistry()).resolves.toBeNull();
	});
});
