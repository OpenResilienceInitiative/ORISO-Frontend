// @vitest-environment jsdom
import * as React from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppConfigContext } from '../globalState/provider/AppConfigProvider';
import {
	TenantProvider,
	useTenant
} from '../globalState/provider/TenantProvider';
import { AppConfigInterface } from '../globalState/interfaces';
import {
	removeAllCookies,
	setValueInCookie
} from '../components/sessionCookie/accessSessionCookie';
import useTenantTheming from './useTenantTheming';

// `../globalState` is a barrel: importing it drags in the animated-illustration
// component, whose lottie player touches a canvas 2d context at module load and
// throws under jsdom. Nothing here renders it.
vi.mock('lottie-react', () => ({ default: () => null }));

const mocks = vi.hoisted(() => ({ apiGetTenantTheming: vi.fn() }));

vi.mock('../api/apiGetTenantTheming', () => ({
	apiGetTenantTheming: mocks.apiGetTenantTheming
}));

vi.mock('./getLocationVariables', () => ({
	default: () => ({
		subdomain: 'beratung',
		host: 'beratung.oriso.test',
		protocol: 'https:',
		origin: 'https://beratung.oriso.test'
	})
}));

/** A Keycloak access token as the app stores it: only the payload is read. */
const tokenForTenant = (tenantId: number | string) =>
	`header.${btoa(JSON.stringify({ tenantId }))}.signature`;

/** The subdomain tenant every anonymous visitor lands on. */
const SUBDOMAIN_TENANT = {
	id: 1,
	name: 'caritas-berlin',
	theming: { primaryColor: '#a50202' },
	content: {},
	settings: { featureGroupChatV2Enabled: true }
};

/** The tenant the signed-in counsellor actually belongs to. */
const USER_TENANT = {
	id: 14,
	name: 'Blinky Fish Tenant Sep 14',
	theming: { primaryColor: '#004488' },
	content: {},
	settings: { featureGroupChatV2Enabled: false }
};

const Probe = () => {
	useTenantTheming();
	const tenant = useTenant();
	return (
		<span data-testid="tenant">
			{tenant
				? `${tenant.name}|${String(
						tenant.settings?.featureGroupChatV2Enabled
					)}`
				: 'unresolved'}
		</span>
	);
};

const renderApp = () =>
	render(
		<AppConfigContext.Provider
			value={{ useTenantService: true } as AppConfigInterface}
		>
			<TenantProvider>
				<Probe />
			</TenantProvider>
		</AppConfigContext.Provider>
	);

describe('useTenantTheming – tenant of the signed-in user', () => {
	beforeEach(() => {
		cleanup();
		mocks.apiGetTenantTheming.mockReset();
		document.cookie = 'keycloak=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
		window.localStorage.clear();
	});

	it('replaces the anonymous subdomain tenant once a user signs in', async () => {
		mocks.apiGetTenantTheming
			.mockResolvedValueOnce(SUBDOMAIN_TENANT)
			.mockResolvedValueOnce(USER_TENANT);

		renderApp();

		// Anonymous visit: no token yet, so the subdomain tenant is all there is.
		await waitFor(() =>
			expect(screen.getByTestId('tenant').textContent).toBe(
				'caritas-berlin|true'
			)
		);

		act(() => {
			setValueInCookie('keycloak', tokenForTenant(14));
		});

		await waitFor(() =>
			expect(screen.getByTestId('tenant').textContent).toBe(
				'Blinky Fish Tenant Sep 14|false'
			)
		);
	});

	// Two resolutions can be in flight at once: the anonymous one started on the
	// login screen and the signed-in one started by the token appearing. If the
	// slower anonymous response is still allowed to land, it overwrites the
	// counsellor's tenant — exactly the leakage this change exists to stop.
	it('ignores an anonymous response that resolves after the signed-in one', async () => {
		const deferred = <T,>() => {
			let resolve!: (value: T) => void;
			const promise = new Promise<T>((res) => {
				resolve = res;
			});
			return { promise, resolve };
		};
		const anonymous = deferred<typeof SUBDOMAIN_TENANT>();
		const signedIn = deferred<typeof USER_TENANT>();
		mocks.apiGetTenantTheming
			.mockReturnValueOnce(anonymous.promise)
			.mockReturnValueOnce(signedIn.promise);

		renderApp();

		act(() => {
			setValueInCookie('keycloak', tokenForTenant(14));
		});
		await waitFor(() =>
			expect(mocks.apiGetTenantTheming).toHaveBeenCalledTimes(2)
		);

		// The signed-in answer arrives first, the stale anonymous one after.
		await act(async () => {
			signedIn.resolve(USER_TENANT);
			await signedIn.promise;
		});
		await act(async () => {
			anonymous.resolve(SUBDOMAIN_TENANT);
			await anonymous.promise;
		});

		expect(screen.getByTestId('tenant').textContent).toBe(
			'Blinky Fish Tenant Sep 14|false'
		);
	});

	// Failing closed matters more than failing pretty: if the counsellor's own
	// tenant cannot be resolved, serving the previous one keeps exactly the
	// data this hook exists to keep apart.
	it('serves no tenant at all when the signed-in resolution fails', async () => {
		mocks.apiGetTenantTheming
			.mockResolvedValueOnce(SUBDOMAIN_TENANT)
			.mockRejectedValueOnce(new Error('tenant service unavailable'));

		renderApp();

		await waitFor(() =>
			expect(screen.getByTestId('tenant').textContent).toBe(
				'caritas-berlin|true'
			)
		);

		act(() => {
			setValueInCookie('keycloak', tokenForTenant(14));
		});

		await waitFor(() =>
			expect(screen.getByTestId('tenant').textContent).toBe('unresolved')
		);
	});

	it('falls back to the subdomain tenant when the user signs out', async () => {
		// Counselling agencies run shared machines: the next person at the
		// keyboard must not inherit the previous counsellor's Träger.
		mocks.apiGetTenantTheming
			.mockResolvedValueOnce(USER_TENANT)
			.mockResolvedValueOnce(SUBDOMAIN_TENANT);
		setValueInCookie('keycloak', tokenForTenant(14));

		renderApp();

		await waitFor(() =>
			expect(screen.getByTestId('tenant').textContent).toBe(
				'Blinky Fish Tenant Sep 14|false'
			)
		);

		act(() => {
			removeAllCookies();
		});

		await waitFor(() =>
			expect(screen.getByTestId('tenant').textContent).toBe(
				'caritas-berlin|true'
			)
		);
	});
});
