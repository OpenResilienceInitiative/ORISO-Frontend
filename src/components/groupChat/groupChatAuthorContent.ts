export interface GroupChatAuthorContent {
	sourceLanguage?: string;
	hintMessageTranslations?: Record<string, string> | null;
	groupChatRulesTranslations?: Record<string, string[]> | null;
}

export interface GroupChatAuthorContentDraft {
	sourceLanguage: string;
	hintMessageTranslations: Record<string, string>;
	groupChatRulesTranslations: Record<string, string[]>;
}

const normalizeLanguage = (language?: string) =>
	language?.trim().toLowerCase().split('-')[0];

export const normalizeGroupChatLanguages = (languages: string[]) =>
	Array.from(
		new Set(
			languages
				.map(normalizeLanguage)
				.filter((language): language is string => !!language)
		)
	);

export const syncGroupChatAuthorContentLanguages = (
	draft: GroupChatAuthorContentDraft,
	activeLanguages: string[]
): GroupChatAuthorContentDraft => {
	const languages = normalizeGroupChatLanguages(activeLanguages);
	const currentSource = normalizeLanguage(draft.sourceLanguage);
	const sourceLanguage =
		(currentSource && languages.includes(currentSource)
			? currentSource
			: languages[0]) ||
		currentSource ||
		'de';

	if (
		draft.sourceLanguage === sourceLanguage &&
		draft.hintMessageTranslations[sourceLanguage] !== undefined &&
		draft.groupChatRulesTranslations[sourceLanguage] !== undefined
	) {
		return draft;
	}

	return {
		...draft,
		sourceLanguage,
		hintMessageTranslations: {
			...draft.hintMessageTranslations,
			[sourceLanguage]:
				draft.hintMessageTranslations[sourceLanguage] || ''
		},
		groupChatRulesTranslations: {
			...draft.groupChatRulesTranslations,
			[sourceLanguage]: draft.groupChatRulesTranslations[
				sourceLanguage
			] || ['']
		}
	};
};

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
	const safeHintMessageTranslations = hintMessageTranslations || {};
	const safeGroupChatRulesTranslations = groupChatRulesTranslations || {};
	const hintMessage =
		languages
			.map((candidate) => safeHintMessageTranslations[candidate])
			.find((candidate) => !!candidate?.trim()) ||
		legacyHintMessage ||
		'';
	const rules =
		languages
			.map((candidate) => safeGroupChatRulesTranslations[candidate])
			.find((candidate) => candidate?.some((rule) => !!rule.trim()))
			?.filter((rule) => !!rule.trim()) || legacyRules;

	return { hintMessage, rules };
};

export const buildGroupChatAuthorTranslationRequest = ({
	sourceLanguage,
	activeLanguages,
	hintMessageTranslations,
	groupChatRulesTranslations
}: GroupChatAuthorContentDraft & { activeLanguages: string[] }) => {
	const welcome = hintMessageTranslations[sourceLanguage]?.trim();
	const rules = groupChatRulesTranslations[sourceLanguage] || [];
	return {
		sourceLang: normalizeLanguage(sourceLanguage) || sourceLanguage,
		targetLangs: normalizeGroupChatLanguages(activeLanguages).filter(
			(language) => language !== normalizeLanguage(sourceLanguage)
		),
		texts: Object.fromEntries(
			[
				...(welcome ? [['welcome', welcome] as const] : []),
				...rules.map(
					(rule, index) => [`rule-${index}`, rule.trim()] as const
				)
			].filter(([, text]) => text.length > 0)
		)
	};
};

export const applyGroupChatAuthorTranslations = (
	draft: GroupChatAuthorContentDraft,
	translations: Record<string, Record<string, string>>
): GroupChatAuthorContentDraft => {
	const nextHints = { ...draft.hintMessageTranslations };
	const nextRules = { ...draft.groupChatRulesTranslations };

	Object.entries(translations).forEach(([language, fields]) => {
		if (fields.welcome !== undefined) {
			nextHints[language] = fields.welcome;
		}
		const translatedRules = Object.entries(fields)
			.filter(([key]) => key.startsWith('rule-'))
			.sort(
				([left], [right]) =>
					Number(left.slice('rule-'.length)) -
					Number(right.slice('rule-'.length))
			)
			.map(([, value]) => value);
		if (translatedRules.length > 0) {
			nextRules[language] = translatedRules;
		}
	});

	return {
		...draft,
		hintMessageTranslations: nextHints,
		groupChatRulesTranslations: nextRules
	};
};
