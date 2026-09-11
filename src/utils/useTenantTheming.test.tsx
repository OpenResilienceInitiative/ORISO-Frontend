// @vitest-environment jsdom
import * as React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppConfigContext } from '../globalState/provider/AppConfigProvider';
import { AppConfigInterface } from '../globalState/interfaces';
import useTenantTheming from './useTenantTheming';

// `../globalState` is a barrel: importing it drags in the animated-illustration
// component, whose lottie player touches a canvas 2d context at module load and
// throws under jsdom. Nothing here renders it.
vi.mock('lottie-react', () => ({ default: () => null }));

const mocks = vi.hoisted(() => ({ apiGetTenantTheming: vi.fn() }));

vi.mock('../api/apiGetTenantTheming', () => ({
	apiGetTenantTheming: mocks.apiGetTenantTheming
}));

// The public tenant endpoint is reached by host subdomain; jsdom serves
// `localhost`, which `getLocationVariables` reports as "no subdomain".
vi.mock('./getLocationVariables', () => ({
	default: () => ({
		subdomain: 'beratung',
		host: 'beratung.oriso.test',
		protocol: 'https:',
		origin: 'https://beratung.oriso.test'
	})
}));

/**
 * A real `.ico` upload as TenantService stores it: Chrome reports
 * `image/vnd.microsoft.icon` for the picked file, and the service HTML-encodes
 * the base64 payload's `+`/`=` on the way out (see `decodeTenantAsset`).
 */
const STORED_ICO =
	'data:image/vnd.microsoft.icon;base64,AAABAAEAICAAAA&#43;&#43;AA&#61;&#61;';
const DECODED_ICO = 'data:image/vnd.microsoft.icon;base64,AAABAAEAICAAAA++AA==';

const tenantResponse = (favicon: string) => ({
	id: 7,
	name: 'Beratung',
	theming: {
		favicon,
		logo: '',
		associationLogo: '',
		primaryColor: '#123456'
	},
	content: { claim: 'Hilfe' },
	settings: {}
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
	<AppConfigContext.Provider
		value={{ useTenantService: true } as AppConfigInterface}
	>
		{children as React.ReactElement}
	</AppConfigContext.Provider>
);

const iconHrefs = () =>
	Array.from(
		document.querySelectorAll<HTMLLinkElement>("link[rel~='icon']")
	).map((link) => link.getAttribute('href'));

describe('useTenantTheming – branding favicon', () => {
	beforeEach(() => {
		mocks.apiGetTenantTheming.mockReset();
		document.head.innerHTML = `
			<link rel="icon" href="/favicon.ico" />
			<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
			<link rel="apple-touch-icon" href="/logo192.png" />
		`;
	});

	it('brands the tab for a visitor with no session, from an uploaded .ico', async () => {
		mocks.apiGetTenantTheming.mockResolvedValue(tenantResponse(STORED_ICO));

		renderHook(() => useTenantTheming(), { wrapper });

		await waitFor(() =>
			expect(iconHrefs()).toEqual([DECODED_ICO, DECODED_ICO])
		);
	});

	it('drops the stale size/type hints that made the browser keep the placeholder', async () => {
		mocks.apiGetTenantTheming.mockResolvedValue(tenantResponse(STORED_ICO));

		renderHook(() => useTenantTheming(), { wrapper });

		await waitFor(() => expect(iconHrefs()[1]).toBe(DECODED_ICO));
		const sized = document.querySelectorAll("link[rel~='icon']")[1];
		expect(sized.getAttribute('sizes')).toBeNull();
		expect(sized.getAttribute('type')).toBeNull();
	});

	it('leaves the apple-touch-icon alone', async () => {
		mocks.apiGetTenantTheming.mockResolvedValue(tenantResponse(STORED_ICO));

		renderHook(() => useTenantTheming(), { wrapper });

		await waitFor(() => expect(iconHrefs()[0]).toBe(DECODED_ICO));
		expect(
			document
				.querySelector("link[rel='apple-touch-icon']")
				.getAttribute('href')
		).toBe('/logo192.png');
	});

	it('refuses a theming value that is not an image URL', async () => {
		mocks.apiGetTenantTheming.mockResolvedValue(
			tenantResponse(['java', 'script:alert(1)'].join(''))
		);

		renderHook(() => useTenantTheming(), { wrapper });

		await waitFor(() =>
			expect(mocks.apiGetTenantTheming).toHaveBeenCalled()
		);
		await waitFor(() =>
			expect(iconHrefs()).toEqual(['/favicon.ico', '/favicon-32x32.png'])
		);
	});

	it('survives a tenant response without theming or content', async () => {
		mocks.apiGetTenantTheming.mockResolvedValue({
			id: 7,
			name: 'Beratung'
		});

		renderHook(() => useTenantTheming(), { wrapper });

		await waitFor(() =>
			expect(mocks.apiGetTenantTheming).toHaveBeenCalled()
		);
		expect(iconHrefs()).toEqual(['/favicon.ico', '/favicon-32x32.png']);
		expect(document.title).toBe('Beratung');
	});
});
