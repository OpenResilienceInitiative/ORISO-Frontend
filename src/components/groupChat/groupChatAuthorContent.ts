export interface GroupChatAuthorContent {
	sourceLanguage?: string;
	hintMessageTranslations?: Record<string, string>;
	groupChatRulesTranslations?: Record<string, string[]>;
}

export interface GroupChatAuthorContentDraft {
	sourceLanguage: string;
	hintMessageTranslations: Record<string, string>;
	groupChatRulesTranslations: Record<string, string[]>;
}

const normalizeLanguage = (language?: string) =>
	language?.trim().toLowerCase().split('-')[0];

const fallbackLanguages = (language?: string, sourceLanguage?: string) =>
	Array.from(
		new Set(
			[
				normalizeLanguage(language),
				'en',
				normalizeLanguage(sourceLanguage)
			].filter((value): value is string => !!value)
		)
	);

export const resolveGroupChatAuthorContent = ({
	language,
	sourceLanguage,
	hintMessageTranslations = {},
	groupChatRulesTranslations = {},
	legacyHintMessage,
	legacyRules
}: GroupChatAuthorContent & {
	language?: string;
	legacyHintMessage?: string;
	legacyRules: string[];
}) => {
	const languages = fallbackLanguages(language, sourceLanguage);
	const hintMessage =
		languages
			.map((candidate) => hintMessageTranslations[candidate])
			.find((candidate) => !!candidate?.trim()) ||
		legacyHintMessage ||
		'';
	const rules =
		languages
			.map((candidate) => groupChatRulesTranslations[candidate])
			.find((candidate) => candidate?.some((rule) => !!rule.trim()))
			?.filter((rule) => !!rule.trim()) || legacyRules;

	return { hintMessage, rules };
};

export const buildGroupChatAuthorTranslationRequest = ({
	sourceLanguage,
	activeLanguages,
	hintMessageTranslations,
	groupChatRulesTranslations
}: GroupChatAuthorContentDraft & { activeLanguages: string[] }) => ({
	sourceLang: sourceLanguage,
	targetLangs: activeLanguages.filter(
		(language) =>
			normalizeLanguage(language) !== normalizeLanguage(sourceLanguage)
	),
	texts: {
		welcome: hintMessageTranslations[sourceLanguage] || '',
		...Object.fromEntries(
			(groupChatRulesTranslations[sourceLanguage] || []).map(
				(rule, index) => [`rule-${index}`, rule]
			)
		)
	}
});

export const applyGroupChatAuthorTranslations = (
	draft: GroupChatAuthorContentDraft,
	translations: Record<string, Record<string, string>>
): GroupChatAuthorContentDraft => {
	const nextHints = { ...draft.hintMessageTranslations };
	const nextRules = { ...draft.groupChatRulesTranslations };

	Object.entries(translations).forEach(([language, fields]) => {
		nextHints[language] = fields.welcome || '';
		nextRules[language] = Object.entries(fields)
			.filter(([key]) => key.startsWith('rule-'))
			.sort(
				([left], [right]) =>
					Number(left.slice('rule-'.length)) -
					Number(right.slice('rule-'.length))
			)
			.map(([, value]) => value);
	});

	return {
		...draft,
		hintMessageTranslations: nextHints,
		groupChatRulesTranslations: nextRules
	};
};
