import * as React from 'react';
import { createContext, useState, useContext, useCallback } from 'react';
import { setTenantSettings } from '../../utils/tenantSettingsHelper';
import {
	TenantDataInterface,
	TenantDataSettingsInterface
} from '../interfaces';

export const TenantContext = createContext<{
	tenant: TenantDataInterface | undefined;
	setTenant(tenant: TenantDataInterface): void;
	updateTenantSettings(settings: Partial<TenantDataSettingsInterface>): void;
}>(null);

export function TenantProvider(props) {
	const [tenant, setTenant] = useState<TenantDataInterface>();

	const setSettings = useCallback((tenant) => {
		setTenantSettings(tenant.settings);
		setTenant(tenant);
	}, []);

	/**
	 * A permission refresh for the tenant already resolved — the Träger admin
	 * can flip a feature while a counsellor keeps the app open. Only the
	 * settings slice is replaced, so the decoded branding (name, claim, logo,
	 * favicon) resolved at sign-in survives.
	 *
	 * This is the single writer of the plain-JS settings mirror, so a refresh
	 * can no longer land in the mirror while context consumers keep reading
	 * stale flags.
	 */
	const updateTenantSettings = useCallback(
		(settings: Partial<TenantDataSettingsInterface>) => {
			setTenantSettings(settings as TenantDataSettingsInterface);
			setTenant((current) =>
				current
					? {
							...current,
							settings: { ...current.settings, ...settings }
						}
					: current
			);
		},
		[]
	);

	return (
		<TenantContext.Provider
			value={{ tenant, setTenant: setSettings, updateTenantSettings }}
		>
			{props.children}
		</TenantContext.Provider>
	);
}

export function useTenant() {
	return useContext(TenantContext)?.tenant || null;
}

export function useTenantState() {
	const context = useContext(TenantContext);
	return {
		tenant: context?.tenant || null,
		isLoading: context !== null && context.tenant === undefined
	};
}
