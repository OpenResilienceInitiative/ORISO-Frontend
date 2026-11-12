/** Where an add-on notification or calendar entry leads (contract `oriso-addon/v1`). */
export interface AddonLink {
	addon?: string | null;
	appId?: string | null;
	slot?: string | null;
	sessionId?: string | number | null;
}

export const DEFAULT_SESSIONS_BASE_PATH = '/sessions/consultant/sessionView';

export const addonAppPath = (addon: string, appId: string) =>
	`/addons/${encodeURIComponent(addon)}/${encodeURIComponent(appId)}`;

/** The text in the user's language, then German, then any language. */
export const localizedText = (
	texts: Record<string, string> | null | undefined,
	locale: string | undefined
): string | undefined => {
	if (!texts) return undefined;
	const language = (locale || 'de').split(/[@-]/)[0];
	return (
		texts[locale || 'de'] ||
		texts[language] ||
		texts.de ||
		Object.values(texts).find(Boolean)
	);
};

export const addonLinkPath = (
	link: AddonLink,
	sessionsBasePath: string = DEFAULT_SESSIONS_BASE_PATH
): string | null => {
	const { addon, appId, slot, sessionId } = link;
	if (!addon || !appId) return null;
	if (slot === 'asker.navigation' || slot === 'consultant.navigation') {
		return addonAppPath(addon, appId);
	}
	if (sessionId == null || sessionId === '') return null;
	const caseView = `${sessionsBasePath}/session/${encodeURIComponent(String(sessionId))}`;
	if (slot === 'consultant.session') {
		return `${caseView}?${new URLSearchParams({ addon: `${addon}/${appId}` })}`;
	}
	if (slot === 'consultant.asker-profile') {
		return caseView;
	}
	return null;
};
