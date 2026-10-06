import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { FALLBACK_LNG } from '../../i18n';
import { useConsultingType, useTopic } from '../../globalState';
import { resolveGroupChatAuthorContent } from './groupChatAuthorContent';

interface GroupChatAuthorSource {
	consultingType?: number;
	sourceLanguage?: string;
	hintMessage?: string;
	hintMessageTranslations?: Record<string, string>;
	groupChatRulesTranslations?: Record<string, string[]>;
}

/**
 * Greeting and rules of a group chat in the reader's language — the author's
 * translations first, the consulting type's legacy rules as the fallback.
 * Lifted out of `JoinGroupChatView` so the group entry room shows the same
 * words the waiting area inside the chat shows.
 */
export const useGroupChatAuthorContent = (item: GroupChatAuthorSource) => {
	const { t: translate, i18n } = useTranslation([
		'common',
		'consultingTypes'
	]);
	const consultingType = useConsultingType(item.consultingType);
	const topic = useTopic(item.consultingType);

	const legacyRules = useMemo(() => {
		const transKeys = [
			`consultingType.${topic?.id ?? 'noConsultingType'}.groupChatRules`,
			`consultingType.fallback.groupChatRules`
		];

		// Get groupChat rules from fallback_lng to get the count and make i18n
		// fallback chain working for non translated rules (de -> de@informal)
		const groupChatRuleKeys = Object.keys(
			translate(transKeys, {
				returnObjects: true,
				defaultValue: consultingType?.groupChat?.groupChatRules || [],
				lng: FALLBACK_LNG,
				ns: 'consultingTypes'
			})
		);

		// Then translate every rule by its own translation
		return groupChatRuleKeys.map((key) =>
			translate(
				transKeys.map((transKey) => `${transKey}.${key}`),
				{ ns: 'consultingTypes' }
			)
		);
	}, [consultingType?.groupChat?.groupChatRules, topic?.id, translate]);

	return useMemo(
		() =>
			resolveGroupChatAuthorContent({
				language: i18n.resolvedLanguage || i18n.language,
				sourceLanguage: item.sourceLanguage,
				hintMessageTranslations: item.hintMessageTranslations,
				groupChatRulesTranslations: item.groupChatRulesTranslations,
				legacyHintMessage: item.hintMessage,
				legacyRules
			}),
		[
			item.groupChatRulesTranslations,
			item.hintMessage,
			item.hintMessageTranslations,
			item.sourceLanguage,
			i18n.language,
			i18n.resolvedLanguage,
			legacyRules
		]
	);
};
