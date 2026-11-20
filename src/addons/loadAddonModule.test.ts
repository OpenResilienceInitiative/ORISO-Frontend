import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadAddonModule, resetAddonModulesForTests } from './loadAddonModule';

const module = { mount: vi.fn(), unmount: vi.fn() };

describe('loadAddonModule', () => {
	afterEach(() => resetAddonModulesForTests());

	it('loads each bundle once and accepts a default export', async () => {
		const load = vi.fn().mockResolvedValue({ default: module });
		await expect(loadAddonModule('/a.js', load)).resolves.toBe(module);
		await expect(loadAddonModule('/a.js', load)).resolves.toBe(module);
		expect(load).toHaveBeenCalledTimes(1);
	});

	it('accepts named lifecycle exports', async () => {
		const load = vi.fn().mockResolvedValue(module);
		await expect(loadAddonModule('/b.js', load)).resolves.toBe(module);
	});

	it('rejects bundles without mount and unmount and allows a retry', async () => {
		const load = vi
			.fn()
			.mockResolvedValueOnce({ mount: () => {} })
			.mockResolvedValueOnce(module);
		await expect(loadAddonModule('/c.js', load)).rejects.toThrow(
			'does not export mount and unmount'
		);
		await expect(loadAddonModule('/c.js', load)).resolves.toBe(module);
		expect(load).toHaveBeenCalledTimes(2);
	});
});
