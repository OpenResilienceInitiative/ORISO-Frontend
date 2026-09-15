import { useContext, useEffect, useState, useSyncExternalStore } from 'react';
import { apiGetTenantTheming } from '../api/apiGetTenantTheming';
import { TenantDataSettingsInterface } from '../globalState/interfaces';
import { TenantContext } from '../globalState/provider/TenantProvider';
import {
	getAuthenticatedTenantId,
	subscribeToAuthenticatedTenant
} from '../utils/authenticatedTenant';
import {
	getTenantSettings,
	setTenantSettings
} from '../utils/tenantSettingsHelper';

interface SessionTenantSettingsState {
	settings: Partial<TenantDataSettingsInterface>;
	isLoading: boolean;
	appliedSessionKey: string | number | null | undefined;
}

type SessionTenantSettingsResult = Omit<
	SessionTenantSettingsState,
	'appliedSessionKey'
>;

/**
 * Tenant feature permissions can change while a consultant keeps the app open.
 * Refresh them whenever another conversation becomes active so a new case never
 * inherits stale call controls from the previous tenant-settings snapshot.
 */
export const useSessionTenantSettings = (
	sessionKey: string | number | null | undefined
): SessionTenantSettingsResult => {
	// The updater alone, not the whole context value: the value object is
	// recreated on every provider render, and depending on it would refetch in
	// a loop. `updateTenantSettings` is stable for the provider's lifetime.
	const updateTenantSettings =
		useContext(TenantContext)?.updateTenantSettings;
	// Signing in or out swaps the Träger under this hook. The refresh is
	// fetched for whoever was signed in when it started, so it also has to be
	// re-run for the new one — and the in-flight answer for the old one
	// dropped.
	const authenticatedTenantId = useSyncExternalStore(
		subscribeToAuthenticatedTenant,
		getAuthenticatedTenantId
	);
	const [state, setState] = useState<SessionTenantSettingsState>(() => ({
		settings: { ...getTenantSettings() },
		isLoading: true,
		appliedSessionKey: undefined
	}));

	useEffect(() => {
		let active = true;
		const requestedTenantId = authenticatedTenantId;
		const isStale = () =>
			!active || getAuthenticatedTenantId() !== requestedTenantId;
		setState((current) => ({ ...current, isLoading: true }));

		apiGetTenantTheming()
			.then((tenant) => {
				if (isStale()) return;
				const settings = tenant?.settings ?? getTenantSettings();
				// Publish into the shared tenant state, so every `useTenant()`
				// consumer sees the refreshed permissions instead of the
				// snapshot taken when the tenant was first resolved.
				if (tenant?.settings) {
					// Older test/story providers build the context value by
					// hand and may not carry the updater.
					if (updateTenantSettings) {
						updateTenantSettings(tenant.settings);
					} else {
						setTenantSettings(tenant.settings);
					}
				}
				setState({
					settings: { ...settings },
					isLoading: false,
					appliedSessionKey: sessionKey
				});
			})
			.catch(() => {
				if (isStale()) return;
				setState((current) => ({
					...current,
					isLoading: false,
					appliedSessionKey: sessionKey
				}));
			});

		return () => {
			active = false;
		};
	}, [sessionKey, updateTenantSettings, authenticatedTenantId]);

	return {
		settings: state.settings,
		isLoading: state.isLoading || state.appliedSessionKey !== sessionKey
	};
};
