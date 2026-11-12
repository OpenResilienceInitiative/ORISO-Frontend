// @vitest-environment jsdom
import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LocaleContext, UserDataContext } from '../globalState';
import { AddonMount } from './AddonMount';
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

const renderMount = (loader: (url: string) => Promise<AddonModule>) =>
	render(
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
						addon={addon}
						app={addon.apps[0]}
						slot="asker.navigation"
						loader={loader}
					/>
				</LocaleContext.Provider>
			</UserDataContext.Provider>
		</MemoryRouter>
	);

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
});
