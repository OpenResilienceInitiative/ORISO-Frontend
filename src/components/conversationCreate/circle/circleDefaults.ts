import { GroupChatSeriesFieldsValue } from '../../groupChat/GroupChatSeriesFields';
import { GroupChatAuthorContentDraft } from '../../groupChat/groupChatAuthorContent';

/**
 * Persistence for the Gesprächskreis settings (Figma flow 8482-30552):
 * "Save last entries of agency here until they are overwritten by newer
 * entries, also provide simple two general rules across all languages."
 *
 * The last submitted configuration is stored per agency and offered as the
 * default for the next circle. New drafts start with two general rules in
 * every active language.
 */

const STORAGE_PREFIX = 'oriso.circleDefaults.v1.';

export interface CircleDefaults {
	series: Omit<GroupChatSeriesFieldsValue, 'startDate' | 'startTime'>;
	authorContent: GroupChatAuthorContentDraft;
}

const GENERAL_RULES: Record<string, [string, string]> = {
	de: [
		'Wir gehen respektvoll und wertschätzend miteinander um.',
		'Alles, was hier besprochen wird, bleibt in der Gruppe.'
	],
	en: [
		'We treat each other with respect and appreciation.',
		'Everything shared here stays within the group.'
	],
	fr: [
		'Nous nous traitons avec respect et bienveillance.',
		'Tout ce qui est partagé ici reste dans le groupe.'
	],
	tr: [
		'Birbirimize saygılı ve değer vererek davranırız.',
		'Burada paylaşılan her şey grupta kalır.'
	]
};

export const getGeneralRules = (language: string): string[] => {
	const rules = GENERAL_RULES[language] || GENERAL_RULES.en;
	return [...rules];
};

export const buildInitialAuthorContent = (
	activeLanguages: string[]
): GroupChatAuthorContentDraft => {
	const languages = activeLanguages.length ? activeLanguages : ['de'];
	return {
		sourceLanguage: languages[0],
		hintMessageTranslations: Object.fromEntries(
			languages.map((language) => [language, ''])
		),
		groupChatRulesTranslations: Object.fromEntries(
			languages.map((language) => [language, getGeneralRules(language)])
		)
	};
};

const storageKey = (agencyId: number) => `${STORAGE_PREFIX}${agencyId}`;

const getStorage = (): Storage | null => {
	try {
		return window.localStorage;
	} catch {
		return null;
	}
};

export const loadCircleDefaults = (
	agencyId: number | null
): CircleDefaults | null => {
	if (agencyId === null) {
		return null;
	}
	const storage = getStorage();
	if (!storage) {
		return null;
	}
	try {
		const raw = storage.getItem(storageKey(agencyId));
		if (!raw) {
			return null;
		}
		const parsed = JSON.parse(raw) as CircleDefaults;
		if (!parsed?.series || !parsed?.authorContent?.sourceLanguage) {
			return null;
		}
		return parsed;
	} catch {
		return null;
	}
};

export const saveCircleDefaults = (
	agencyId: number | null,
	defaults: CircleDefaults
): void => {
	if (agencyId === null) {
		return;
	}
	const storage = getStorage();
	if (!storage) {
		return;
	}
	try {
		storage.setItem(storageKey(agencyId), JSON.stringify(defaults));
	} catch {
		// Quota or privacy mode: defaults are a convenience, never a blocker.
	}
};
