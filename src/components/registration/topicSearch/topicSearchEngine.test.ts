import { describe, expect, it } from 'vitest';
import {
	buildTopicSearchIndex,
	normalizeSearchText,
	searchTopics
} from './topicSearchEngine';
import { buildTopicSearchDocuments } from './topicSearchDocuments';

const keys = [
	'sucht',
	'u25-suicide-prevention',
	'debt',
	'pregnancy',
	'trauerberatung',
	'migration',
	'parents-and-family',
	'school-to-work-transition'
];
const index = buildTopicSearchIndex(
	buildTopicSearchDocuments(keys.map((key, id) => ({ id, key })))
);
const topKey = (query: string) => {
	const [first] = searchTopics(index, query);
	return first ? keys[first.topicId] : undefined;
};

describe('normalizeSearchText', () => {
	it('folds case, umlauts and ß so "Schwangerschaft" and "schwangerschaft" meet', () => {
		expect(normalizeSearchText('Straße ÜBER Ärger')).toBe(
			'strasse uber arger'
		);
	});

	it('keeps non-Latin scripts', () => {
		expect(normalizeSearchText('Зависимость')).toBe('зависимость');
	});
});

describe('searchTopics', () => {
	it.each([
		['Sucht', 'sucht'],
		['alkohol', 'sucht'],
		['spielsucht', 'sucht'],
		['suizid', 'u25-suicide-prevention'],
		['ritzen', 'u25-suicide-prevention'],
		['schulden', 'debt'],
		['mahnung', 'debt'],
		['schwanger', 'pregnancy'],
		['abtreibung', 'pregnancy'],
		['trauer', 'trauerberatung'],
		['asyl', 'migration'],
		['bewerbung', 'school-to-work-transition']
	])('German: %s → %s', (query, key) => {
		expect(topKey(query)).toBe(key);
	});

	it.each([
		['addiction', 'sucht'],
		['grief', 'trauerberatung'],
		['refugee', 'migration'],
		['pregnant', 'pregnancy']
	])('English: %s → %s', (query, key) => {
		expect(topKey(query)).toBe(key);
	});

	it('finds a topic by its Russian title', () => {
		expect(topKey('зависимость')).toBe('sucht');
	});

	it('finds a topic by its Turkish title', () => {
		expect(topKey('borç')).toBe('debt');
	});

	it('tolerates a typo', () => {
		expect(topKey('schwangerschft')).toBe('pregnancy');
		expect(topKey('alkohl')).toBe('sucht');
	});

	it('matches while typing (prefix)', () => {
		expect(topKey('schuld')).toBe('debt');
		expect(topKey('schwang')).toBe('pregnancy');
	});

	it('tells which word matched when it is not the title', () => {
		const [first] = searchTopics(index, 'alkohol');
		expect(first.matchedTerm.toLowerCase()).toBe('alkohol');
		expect(first.matchedKind).toBe('related');
	});

	it('returns nothing for one letter or noise', () => {
		expect(searchTopics(index, 'a')).toEqual([]);
		expect(searchTopics(index, 'qqqxxz')).toEqual([]);
	});

	it('lists each topic once, best first, capped', () => {
		const results = searchTopics(index, 'familie', 3);
		expect(results.length).toBeLessThanOrEqual(3);
		expect(new Set(results.map((r) => r.topicId)).size).toBe(
			results.length
		);
		expect(keys[results[0].topicId]).toBe('parents-and-family');
	});

	it('does not suggest a topic just because its group name matches', () => {
		// The pregnancy group also holds U25; "schwanger" must not surface it.
		const [first, ...rest] = searchTopics(index, 'schwanger');
		expect(keys[first.topicId]).toBe('pregnancy');
		expect(rest.map(({ topicId }) => keys[topicId])).not.toContain(
			'u25-suicide-prevention'
		);
	});

	it.each([
		['ich habe schulden', 'debt'],
		['ungewollt schwanger was tun', 'pregnancy'],
		['probleme mit alkohol', 'sucht']
	])('finds a topic inside a sentence: %s → %s', (query, key) => {
		expect(topKey(query)).toBe(key);
	});
});
