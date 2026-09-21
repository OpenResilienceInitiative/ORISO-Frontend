import { topicSearchCatalog } from './topicSearchCatalog.generated';
import { topicSearchRelatedTerms } from './topicSearchRelatedTerms';
import type { TopicSearchDocument, TopicSearchTerm } from './topicSearchEngine';

export interface TopicSearchSource {
	id: number;
	key?: string;
	extraTitles?: string[];
	extraDescription?: string;
}

/**
 * Group names are left out on purpose: mixed groups would make "schwanger"
 * surface unrelated topics such as U25.
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
