import { useCallback, useContext, useMemo, useRef } from 'react';
import { useThemeVersion } from '../utils/theme/useThemeVersion';
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
	TENANT_HEADER,
	AddonApp,
	AddonHostProps,
	AddonNotice,
	AddonRegistrationProps,
	AddonRegistrationResult,
	AddonSlot,
	AvailableAddon
} from './addonTypes';

export interface AddonPlacement {
	agencyId?: number;
	sessionId?: number;
	askerId?: string;
}

const THEME_TOKEN_PREFIX = '--m3-';

const declaredThemeTokens = (root: HTMLElement): Set<string> => {
	const names = new Set<string>();
	const collect = (style: CSSStyleDeclaration) => {
		for (let i = 0; i < style.length; i++) {
			const name = style[i];
			if (name.startsWith(THEME_TOKEN_PREFIX)) {
				names.add(name);
			}
		}
	};
	collect(root.style);
	for (const sheet of Array.from(root.ownerDocument?.styleSheets ?? [])) {
		let rules: CSSRuleList;
		try {
			rules = sheet.cssRules;
		} catch {
			continue;
		}
		for (const rule of Array.from(rules)) {
			if (
				rule instanceof CSSStyleRule &&
				/:root\b/.test(rule.selectorText)
			) {
				collect(rule.style);
			}
		}
	}
	return names;
};

/** The active colour tokens: the default palette from the stylesheets and the tenant's own on the root element. */
export const readThemeTokens = (
	root: HTMLElement = document.documentElement,
	computed: Pick<CSSStyleDeclaration, 'getPropertyValue'> = getComputedStyle(
		root
	)
) => {
	const tokens: Record<string, string> = {};
	declaredThemeTokens(root).forEach((name) => {
		const value =
			computed.getPropertyValue(name).trim() ||
			root.style.getPropertyValue(name).trim();
		if (value) {
			tokens[name] = value;
		}
	});
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

/** The public API of a registration add-on: no login, the Träger in a header. */
export const addonPublicApiCall = (
	addon: Pick<AvailableAddon, 'apiBase'>,
	tenantId: number | undefined,
	baseUrl: string = apiUrl
) => {
	return (path: string, init: RequestInit = {}) => {
		const headers = new Headers(init.headers);
		headers.delete('Authorization');
		if (tenantId != null) {
			headers.set(TENANT_HEADER, String(tenantId));
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

const escapeHtml = (text: string) =>
	text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');

const plainText = (value: unknown) =>
	typeof value === 'string' ? value.slice(0, NOTICE_MAX_LENGTH) : '';

/**
 * Turns an add-on's `notify` call into a host notification. Unknown types become `info`; title
 * and text are plain text, escaped because the host renders string notifications as HTML.
 * Errors and warnings stay longer and are announced to screen readers at once.
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
		title: escapeHtml(plainText(notice.title)),
		text: escapeHtml(text),
		closeable: true,
		timeout: urgent ? 8000 : 4000,
		announce: urgent ? 'alert' : 'status'
	};
};

export const useAddonHostProps = (
	addon: AvailableAddon,
	app: AddonApp,
	slot: AddonSlot,
	placement: AddonPlacement = {},
	registration?: AddonRegistrationProps
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
	const themeVersion = useThemeVersion();
	const { name, version, apiBase } = addon;
	// The app keeps the functions it got at mount; they call the registration's current callbacks.
	const registrationRef = useRef(registration);
	registrationRef.current = registration;
	const isRegistration = Boolean(registration);
	const complete = useCallback(
		(result: AddonRegistrationResult) =>
			registrationRef.current?.complete(result),
		[]
	);
	const back = useCallback(() => registrationRef.current?.back(), []);
	const topicId = registration?.topicId;
	const postcode = registration?.postcode;

	return useMemo(
		() => ({
			contract: ADDON_CONTRACT,
			addon: { name, version },
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
			api: isRegistration
				? addonPublicApiCall({ apiBase }, tenant?.id)
				: addonApiCall({ apiBase }, { agencyId, sessionId }),
			navigate: goTo,
			notify,
			...(isRegistration ? { topicId, postcode, complete, back } : {})
		}),
		// themeVersion: the tokens are read again once a tenant palette landed.
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[
			name,
			version,
			apiBase,
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
			notify,
			themeVersion,
			isRegistration,
			topicId,
			postcode,
			complete,
			back
		]
	);
};
