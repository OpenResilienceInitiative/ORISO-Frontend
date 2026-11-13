import { useCallback, useContext, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
	InformalContext,
	LocaleContext,
	TenantContext,
	UserDataContext
} from '../globalState';
import {
	NotificationDefaultType,
	NotificationsContext,
	NOTIFICATION_TYPE_ERROR,
	NOTIFICATION_TYPE_INFO,
	NOTIFICATION_TYPE_SUCCESS,
	NOTIFICATION_TYPE_WARNING
} from '../globalState/provider/NotificationsProvider';
import { apiUrl } from '../resources/scripts/endpoints';
import { getValueFromCookie } from '../components/sessionCookie/accessSessionCookie';
import {
	ADDON_CONTRACT,
	AGENCY_HEADER,
	SESSION_HEADER,
	AddonApp,
	AddonHostProps,
	AddonNotice,
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

const NOTICE_TYPES = {
	success: NOTIFICATION_TYPE_SUCCESS,
	info: NOTIFICATION_TYPE_INFO,
	warning: NOTIFICATION_TYPE_WARNING,
	error: NOTIFICATION_TYPE_ERROR
} as const;

/** Longest text an add-on can show; longer text is cut, so a notice stays a notice. */
const NOTICE_MAX_LENGTH = 300;

const plainText = (value: unknown) =>
	typeof value === 'string' ? value.slice(0, NOTICE_MAX_LENGTH) : '';

/**
 * Turns an add-on's `notify` call into a host notification. Unknown types become `info`; title
 * and text are plain strings (React renders them as text, never as HTML). Errors and warnings
 * stay longer and are announced to screen readers at once.
 */
export const addonNotice = (
	notice: AddonNotice
): NotificationDefaultType | null => {
	const text = plainText(notice?.text);
	if (!text) {
		return null;
	}
	const type = NOTICE_TYPES[notice.type] ?? NOTIFICATION_TYPE_INFO;
	const urgent =
		type === NOTIFICATION_TYPE_ERROR || type === NOTIFICATION_TYPE_WARNING;
	return {
		notificationType: type,
		title: plainText(notice.title),
		text,
		closeable: true,
		timeout: urgent ? 8000 : 4000,
		announce: urgent ? 'alert' : 'status'
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
	const { addNotification } = useContext(NotificationsContext) ?? {};
	const notify = useCallback(
		(notice: AddonNotice) => {
			const notification = addonNotice(notice);
			if (notification && addNotification) {
				addNotification(notification);
			}
		},
		[addNotification]
	);
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
			navigate: goTo,
			notify
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
			goTo,
			notify
		]
	);
};
