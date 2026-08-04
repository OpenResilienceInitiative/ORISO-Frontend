import { useEffect, useState } from 'react';
import { apiGetTenantTheming } from '../api/apiGetTenantTheming';
import { TenantDataSettingsInterface } from '../globalState/interfaces';
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
	const [state, setState] = useState<SessionTenantSettingsState>(() => ({
		settings: { ...getTenantSettings() },
		isLoading: true,
		appliedSessionKey: undefined
	}));

	useEffect(() => {
		let active = true;
		setState((current) => ({ ...current, isLoading: true }));

		apiGetTenantTheming()
			.then((tenant) => {
				if (!active) return;
				const settings = tenant?.settings ?? getTenantSettings();
				if (tenant?.settings) setTenantSettings(tenant.settings);
				setState({
					settings: { ...settings },
					isLoading: false,
					appliedSessionKey: sessionKey
				});
			})
			.catch(() => {
				if (!active) return;
				setState((current) => ({
					...current,
					isLoading: false,
					appliedSessionKey: sessionKey
				}));
			});

		return () => {
			active = false;
		};
	}, [sessionKey]);

	return {
		settings: state.settings,
		isLoading:
			state.isLoading || state.appliedSessionKey !== sessionKey
	};
};
