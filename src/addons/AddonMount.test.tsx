// @vitest-environment jsdom
import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LocaleContext, UserDataContext } from '../globalState';
import { AddonMount, bootstrapOnce } from './AddonMount';
import { AddonHostProps, AddonModule, AvailableAddon } from './addonTypes';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

const addon: AvailableAddon = {
	name: 'demo',
	version: '0.1.0',
	entry: '/service/addons/demo/ui/entry.js',
	apiBase: '/service/addons/demo/api',
	apps: [{ id: 'page', title: { de: 'Demo' }, slots: ['asker.navigation'] }]
};

const mountTree = (
	loader: (url: string) => Promise<AddonModule>,
	mountedAddon: AvailableAddon = addon
) => (
	<MemoryRouter>
		<UserDataContext.Provider
			value={
				{
					userData: {
						userId: 'u1',
						userName: 'jane',
						userRoles: ['user']
					}
				} as never
			}
		>
			<LocaleContext.Provider value={{ locale: 'de' } as never}>
				<AddonMount
					addon={mountedAddon}
					app={mountedAddon.apps[0]}
					slot="asker.navigation"
					loader={loader}
				/>
			</LocaleContext.Provider>
		</UserDataContext.Provider>
	</MemoryRouter>
);

const renderMount = (loader: (url: string) => Promise<AddonModule>) =>
	render(mountTree(loader));

const deferred = () => {
	let resolve: () => void = () => {};
	const promise = new Promise<void>((done) => {
		resolve = done;
	});
	return { promise, resolve };
};

describe('AddonMount', () => {
	it('bootstraps once, mounts with the host props and unmounts on removal', async () => {
		const module: AddonModule = {
			bootstrap: vi.fn(),
			mount: vi.fn(({ domElement }: AddonHostProps) => {
				domElement.textContent = 'hello from the add-on';
			}),
			unmount: vi.fn()
		};
		const view = renderMount(() => Promise.resolve(module));

		expect(await screen.findByText('hello from the add-on')).toBeTruthy();
		expect(module.bootstrap).toHaveBeenCalledTimes(1);
		const props = (module.mount as ReturnType<typeof vi.fn>).mock
			.calls[0][0] as AddonHostProps;
		expect(props.contract).toBe('oriso-addon/v1');
		expect(props.slot).toBe('asker.navigation');
		expect(props.user).toEqual({
			id: 'u1',
			username: 'jane',
			roles: ['user']
		});
		expect(props.locale).toBe('de');
		expect(typeof props.api).toBe('function');

		view.unmount();
		await waitFor(() => expect(module.unmount).toHaveBeenCalledTimes(1));
	});

	it('shows an error instead of breaking the page when the bundle fails', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		renderMount(() => Promise.reject(new Error('offline')));
		expect((await screen.findByRole('alert')).textContent).toBe(
			'addons.loadError'
		);
	});

	it('keeps the app mounted when a registry refresh delivers the same add-on again', async () => {
		const module: AddonModule = {
			mount: vi.fn(),
			unmount: vi.fn(),
			update: vi.fn()
		};
		const loader = () => Promise.resolve(module);
		const view = render(mountTree(loader));
		await waitFor(() => expect(module.mount).toHaveBeenCalledTimes(1));

		view.rerender(mountTree(loader, { ...addon, apps: [...addon.apps] }));
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(module.mount).toHaveBeenCalledTimes(1);
		expect(module.unmount).not.toHaveBeenCalled();
	});

	it('does not mount a replacement before the previous app has unmounted', async () => {
		const unmounting = deferred();
		const calls: string[] = [];
		const module: AddonModule = {
			mount: vi.fn(({ app }: AddonHostProps) => {
				calls.push(`mount ${app.id}`);
			}),
			unmount: vi.fn(async ({ app }: AddonHostProps) => {
				calls.push(`unmount ${app.id}`);
				await unmounting.promise;
				calls.push(`unmounted ${app.id}`);
			})
		};
		const loader = () => Promise.resolve(module);
		const other: AvailableAddon = {
			...addon,
			apps: [{ ...addon.apps[0], id: 'other' }]
		};
		const view = render(mountTree(loader));
		await waitFor(() => expect(calls).toEqual(['mount page']));

		view.rerender(mountTree(loader, other));
		await waitFor(() => expect(calls).toContain('unmount page'));
		expect(calls).not.toContain('mount other');

		unmounting.resolve();
		await waitFor(() =>
			expect(calls).toEqual([
				'mount page',
				'unmount page',
				'unmounted page',
				'mount other'
			])
		);
	});
});

describe('bootstrapOnce', () => {
	it('bootstraps a bundle once while several of its apps mount at the same time', async () => {
		const started = deferred();
		const module: AddonModule = {
			bootstrap: vi.fn(() => started.promise),
			mount: vi.fn(),
			unmount: vi.fn()
		};
		const props = {} as AddonHostProps;
		const first = bootstrapOnce(module, props);
		const second = bootstrapOnce(module, props);
		started.resolve();
		await Promise.all([first, second]);
		expect(module.bootstrap).toHaveBeenCalledTimes(1);
	});

	it('tries again after a failed bootstrap', async () => {
		const module: AddonModule = {
			bootstrap: vi
				.fn()
				.mockRejectedValueOnce(new Error('offline'))
				.mockResolvedValueOnce(undefined),
			mount: vi.fn(),
			unmount: vi.fn()
		};
		const props = {} as AddonHostProps;
		await expect(bootstrapOnce(module, props)).rejects.toThrow('offline');
		await expect(bootstrapOnce(module, props)).resolves.toBeUndefined();
		expect(module.bootstrap).toHaveBeenCalledTimes(2);
	});
});
