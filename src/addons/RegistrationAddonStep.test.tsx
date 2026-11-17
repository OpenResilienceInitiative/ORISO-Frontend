// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TenantContext } from '../globalState';
import { AddonModuleLoaderContext } from './AddonMount';
import { RegistrationAddonStep } from './RegistrationAddonStep';
import { AddonHostProps, AddonModule } from './addonTypes';
import {
	REGISTRATION_ADDON_MOUNT_TIMEOUT_MS,
	toRegistrationAddon
} from './registrationAddon';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

const { addon, app } = toRegistrationAddon({
	contract: 'oriso-addon/v1',
	name: 'finder',
	version: '1.0.0',
	appId: 'finder',
	title: { de: 'Beratungsstelle finden' },
	entry: '/service/addons/finder/ui/entry.js',
	apiBase: '/service/addons/finder/public/api'
})!;

const mountWith = (
	module: AddonModule,
	onSubmit = vi.fn(),
	{
		loader = () => Promise.resolve(module),
		tenantId
	}: {
		loader?: () => Promise<AddonModule>;
		tenantId?: number;
	} = {}
) => {
	const onComplete = vi.fn();
	const onBack = vi.fn();
	const onUnavailable = vi.fn();
	render(
		<MemoryRouter>
			<TenantContext.Provider value={{ tenant: { id: 7 } } as never}>
				<AddonModuleLoaderContext.Provider value={loader}>
					<form onSubmit={onSubmit}>
						<RegistrationAddonStep
							addon={addon}
							app={app}
							topicId={3}
							postcode="10115"
							tenantId={tenantId}
							onComplete={onComplete}
							onBack={onBack}
							onUnavailable={onUnavailable}
						/>
					</form>
				</AddonModuleLoaderContext.Provider>
			</TenantContext.Provider>
		</MemoryRouter>
	);
	return { onComplete, onBack, onUnavailable };
};

const mounted = async (module: AddonModule) => {
	await waitFor(() => expect(module.mount).toHaveBeenCalled());
	return vi.mocked(module.mount).mock.calls[0][0] as AddonHostProps;
};

describe('RegistrationAddonStep', () => {
	afterEach(() => {
		cleanup();
		vi.unstubAllGlobals();
		vi.useRealTimers();
	});

	it('gives the step back when the bundle fails', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const module: AddonModule = { mount: vi.fn(), unmount: vi.fn() };
		const { onUnavailable } = mountWith(module, vi.fn(), {
			loader: () => Promise.reject(new Error('offline'))
		});

		await waitFor(() => expect(onUnavailable).toHaveBeenCalledTimes(1));
	});

	it('gives the step back when the app does not mount in time', async () => {
		vi.useFakeTimers();
		const module: AddonModule = { mount: vi.fn(), unmount: vi.fn() };
		const { onUnavailable } = mountWith(module, vi.fn(), {
			loader: () => new Promise(() => {})
		});

		await vi.advanceTimersByTimeAsync(REGISTRATION_ADDON_MOUNT_TIMEOUT_MS);

		expect(onUnavailable).toHaveBeenCalledTimes(1);
	});

	it('keeps the step once the app is mounted', async () => {
		vi.useFakeTimers();
		const module: AddonModule = { mount: vi.fn(), unmount: vi.fn() };
		const { onUnavailable } = mountWith(module);

		await vi.advanceTimersByTimeAsync(REGISTRATION_ADDON_MOUNT_TIMEOUT_MS);

		expect(module.mount).toHaveBeenCalled();
		expect(onUnavailable).not.toHaveBeenCalled();
	});

	it('uses the Träger the registration looked up when the tenant context has no id', async () => {
		const fetchMock = vi.fn().mockResolvedValue(new Response('{}'));
		vi.stubGlobal('fetch', fetchMock);
		const module: AddonModule = { mount: vi.fn(), unmount: vi.fn() };
		mountWith(module, vi.fn(), { tenantId: 4 });

		const props = await mounted(module);
		expect(props.tenant.id).toBe(4);
		await props.api('/agencies');
		expect(
			(fetchMock.mock.calls[0][1].headers as Headers).get(
				'X-Oriso-Tenant-Id'
			)
		).toBe('4');
	});

	it('mounts the app with what the registration knows and its public API', async () => {
		const fetchMock = vi.fn().mockResolvedValue(new Response('{}'));
		vi.stubGlobal('fetch', fetchMock);
		const module: AddonModule = { mount: vi.fn(), unmount: vi.fn() };
		mountWith(module);

		const props = await mounted(module);
		expect(props.slot).toBe('registration.agency-finder');
		expect(props.tenant.id).toBe(7);
		expect(props.topicId).toBe(3);
		expect(props.postcode).toBe('10115');
		expect(props.agencyId).toBeUndefined();

		await props.api('/agencies');
		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toMatch(
			/\/service\/addons\/finder\/public\/api\/agencies$/
		);
		expect((init.headers as Headers).get('X-Oriso-Tenant-Id')).toBe('7');
		expect((init.headers as Headers).has('Authorization')).toBe(false);
	});

	it('hands a checked result to the registration and ignores one without an agency', async () => {
		const module: AddonModule = { mount: vi.fn(), unmount: vi.fn() };
		const { onComplete, onBack } = mountWith(module);
		const props = await mounted(module);

		props.complete?.({ agencyId: 0 });
		expect(onComplete).not.toHaveBeenCalled();

		props.complete?.({
			agencyId: 12,
			topicId: 3,
			registrationRef: 'r-1'
		});
		expect(onComplete).toHaveBeenCalledWith({
			agencyId: 12,
			topicId: 3,
			registrationRef: 'r-1'
		});

		props.back?.();
		expect(onBack).toHaveBeenCalledTimes(1);
	});

	it('keeps a form of the app from submitting the registration', async () => {
		const module: AddonModule = {
			mount: vi.fn(({ domElement }: AddonHostProps) => {
				const form = document.createElement('form');
				form.addEventListener('submit', (event) =>
					event.preventDefault()
				);
				domElement.append(form);
			}),
			unmount: vi.fn()
		};
		const onSubmit = vi.fn((event: React.FormEvent) =>
			event.preventDefault()
		);
		mountWith(module, onSubmit);
		const props = await mounted(module);

		fireEvent.submit(props.domElement.querySelector('form')!);

		expect(onSubmit).not.toHaveBeenCalled();
	});
});
