import { topicSearchCatalog } from './topicSearchCatalog.generated';
import { topicSearchRelatedTerms } from './topicSearchRelatedTerms';
import type { TopicSearchDocument, TopicSearchTerm } from './topicSearchEngine';

export interface TopicSearchSource {
	/** The id the selection uses (the API topic id). */
	id: number;
	/** Registration topic key (slug), e.g. `sucht`. */
	key?: string;
	/** Tenant wording from the API (name, titles, description). */
	extraTitles?: string[];
	extraDescription?: string;
}

/**
 * One search document per offered topic: its title and description in every
 * shipped language, the everyday words that point to it, and whatever wording
 * the tenant gave it. Group names are left out on purpose: a group like
 * "Kinder, Jugend, Erwachsene, Schwangerschaft und Familie" also holds U25
 * and general social counselling, so "schwanger" would surface them.
 */
export const buildTopicSearchDocuments = (
	sources: TopicSearchSource[]
): TopicSearchDocument[] =>
	sources.map(({ id, key, extraTitles = [], extraDescription }) => {
		const terms: TopicSearchTerm[] = [];
		const add = (
			text: string | undefined,
			kind: TopicSearchTerm['kind']
		) => {
			if (
				text &&
				!terms.some((t) => t.text === text && t.kind === kind)
			) {
				terms.push({ text, kind });
			}
		};

		Object.values(topicSearchCatalog.topics[key ?? ''] ?? {}).forEach(
			(copy) => {
				add(copy.title, 'title');
				add(copy.description, 'description');
			}
		);
		extraTitles.forEach((title) => add(title, 'title'));
		add(extraDescription, 'description');
		(topicSearchRelatedTerms[key ?? ''] ?? []).forEach((term) =>
			add(term, 'related')
		);

		return { topicId: id, terms };
	});
