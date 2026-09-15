// @vitest-environment jsdom
import * as React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppConfigContext } from '../globalState/provider/AppConfigProvider';
import { AppConfigInterface } from '../globalState/interfaces';
import { TenantContext } from '../globalState/provider/TenantProvider';
import useTenantTheming from './useTenantTheming';

vi.mock('lottie-react', () => ({ default: () => null }));

const mocks = vi.hoisted(() => ({ apiGetTenantTheming: vi.fn() }));
vi.mock('../api/apiGetTenantTheming', () => ({
	apiGetTenantTheming: mocks.apiGetTenantTheming
}));

// A bare domain or localhost: no tenant subdomain.
vi.mock('./getLocationVariables', () => ({
	default: () => ({
		subdomain: '',
		host: 'localhost:9011',
		protocol: 'http:',
		origin: 'http://localhost:9011'
	})
}));

describe('useTenantTheming on a host without a tenant subdomain', () => {
	it('keeps the tenant feature flags the service answers with (#974, #1216)', async () => {
		mocks.apiGetTenantTheming.mockResolvedValue({
			id: 1,
			name: 'Beratung',
			settings: {
				featureGroupChatV2Enabled: true,
				featureAnonymousChatEnabled: false
			}
		});
		const setTenant = vi.fn();
		const wrapper = ({ children }: { children: React.ReactNode }) => (
			<AppConfigContext.Provider
				value={
					{
						useTenantService: true,
						featureAnonymousChatEnabled: true
					} as unknown as AppConfigInterface
				}
			>
				<TenantContext.Provider
					value={{ tenant: undefined, setTenant }}
				>
					{children as React.ReactElement}
				</TenantContext.Provider>
			</AppConfigContext.Provider>
		);

		renderHook(() => useTenantTheming(), { wrapper });

		await waitFor(() => expect(setTenant).toHaveBeenCalled());
		const { settings } = setTenant.mock.calls[0][0];
		// The flag only the tenant service knows arrives …
		expect(settings.featureGroupChatV2Enabled).toBe(true);
		// … and the app config still wins where both speak.
		expect(settings.featureAnonymousChatEnabled).toBe(true);
		expect(settings.useTenantService).toBe(true);
	});
});
