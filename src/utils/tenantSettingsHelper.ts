import { TenantDataSettingsInterface } from '../globalState/interfaces';

// Make tenant available globally to be used on other files that are just js context
const tenantSettings: Partial<TenantDataSettingsInterface> = {};

/** Merge a partial refresh into the mirror, leaving untouched keys alone. */
export const setTenantSettings = (settings: TenantDataSettingsInterface) => {
	return Object.assign(tenantSettings, settings);
};

/**
 * Replace the mirror wholesale — for when a *different* tenant resolves.
 *
 * Merging there would leave the previous Träger's optional flags behind for the
 * next one, which matters now that signing in and out switches tenants inside
 * a single provider. The object identity is kept because callers hold the
 * reference returned by `getTenantSettings`.
 */
export const replaceTenantSettings = (
	settings: Partial<TenantDataSettingsInterface> = {}
) => {
	Object.keys(tenantSettings).forEach((key) => {
		delete tenantSettings[key as keyof TenantDataSettingsInterface];
	});
	return Object.assign(tenantSettings, settings);
};

export const getTenantSettings = () => {
	return tenantSettings;
};
