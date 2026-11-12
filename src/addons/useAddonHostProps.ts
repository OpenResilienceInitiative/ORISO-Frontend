import { useCallback, useContext, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
	InformalContext,
	LocaleContext,
	TenantContext,
	UserDataContext
} from '../globalState';
import { apiUrl } from '../resources/scripts/endpoints';
import { getValueFromCookie } from '../components/sessionCookie/accessSessionCookie';
import {
	ADDON_CONTRACT,
	AGENCY_HEADER,
	SESSION_HEADER,
	AddonApp,
	AddonHostProps,
	AddonSlot,
	AvailableAddon
} from './addonTypes';

export interface AddonPlacement {
	agencyId?: number;
	sessionId?: number;
	askerId?: string;
}

/** The tenant colours as applied by `applyTenantPalette` on the root element. */
export const readThemeTokens = (
	root: HTMLElement = document.documentElement
) => {
	const tokens: Record<string, string> = {};
	for (let i = 0; i < root.style.length; i++) {
		const name = root.style.item(i);
		if (name.startsWith('--m3-')) {
			tokens[name] = root.style.getPropertyValue(name).trim();
		}
	}
	return tokens;
};

export const addonApiCall = (
	addon: Pick<AvailableAddon, 'apiBase'>,
	{ agencyId, sessionId }: Pick<AddonPlacement, 'agencyId' | 'sessionId'>,
	baseUrl: string = apiUrl,
	token: () => string | undefined = () => getValueFromCookie('keycloak')
) => {
	return (path: string, init: RequestInit = {}) => {
		const headers = new Headers(init.headers);
		const accessToken = token();
		if (accessToken) {
			headers.set('Authorization', `Bearer ${accessToken}`);
		}
		if (agencyId != null) {
			headers.set(AGENCY_HEADER, String(agencyId));
		}
		if (sessionId != null) {
			headers.set(SESSION_HEADER, String(sessionId));
		}
		const relative = path.startsWith('/') ? path : `/${path}`;
		return fetch(`${baseUrl}${addon.apiBase}${relative}`, {
			...init,
			headers,
			credentials: 'omit'
		});
	};
};

export const useAddonHostProps = (
	addon: AvailableAddon,
	app: AddonApp,
	slot: AddonSlot,
	placement: AddonPlacement = {}
): Omit<AddonHostProps, 'domElement'> => {
	const { userData } = useContext(UserDataContext) ?? {};
	const { tenant } = useContext(TenantContext) ?? {};
	const { locale = 'de' } = useContext(LocaleContext) ?? {};
	const { informal } = useContext(InformalContext) ?? {};
	const navigate = useNavigate();
	const goTo = useCallback((to: string) => navigate(to), [navigate]);
	const { agencyId, sessionId, askerId } = placement;

	return useMemo(
		() => ({
			contract: ADDON_CONTRACT,
			addon: { name: addon.name, version: addon.version },
			app: { id: app.id },
			slot,
			user: {
				id: userData?.userId,
				username: userData?.userName,
				roles: userData?.userRoles ?? []
			},
			tenant: { id: tenant?.id, name: tenant?.name },
			locale,
			informal: Boolean(informal),
			theme: readThemeTokens(),
			agencyId,
			sessionId,
			askerId,
			api: addonApiCall(addon, { agencyId, sessionId }),
			navigate: goTo
		}),
		[
			addon,
			app.id,
			slot,
			userData,
			tenant,
			locale,
			informal,
			agencyId,
			sessionId,
			askerId,
			goTo
		]
	);
};
