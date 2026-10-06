import { describe, expect, it } from 'vitest';
// @ts-expect-error — plain ESM build script without type declarations
import { buildTopicSearchCatalog } from '../../../../scripts/generate-topic-search-catalog.mjs';
import { topicSearchCatalog } from './topicSearchCatalog.generated';
import { topicSearchRelatedTerms } from './topicSearchRelatedTerms';

describe('topicSearchCatalog', () => {
	it('is in sync with the i18n catalogues (run scripts/generate-topic-search-catalog.mjs)', () => {
		expect(topicSearchCatalog).toEqual(buildTopicSearchCatalog());
	});

	it('only carries related terms for topics that exist', () => {
		Object.keys(topicSearchRelatedTerms).forEach((key) =>
			expect(Object.keys(topicSearchCatalog.topics)).toContain(key)
		);
	});
});
