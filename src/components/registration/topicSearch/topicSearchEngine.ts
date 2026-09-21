/**
 * Client-side topic search for the registration flow.
 *
 * Every word is turned into a vector of its character trigrams and compared
 * by cosine similarity, on top of exact / prefix / compound matches. That
 * makes it tolerant of typos ("alkohl"), of typing in progress ("schwang")
 * and of German compounds ("spielsucht" contains "sucht"), and it works the
 * same for every script the platform ships (Latin, Cyrillic, Ge'ez).
 *
 * It deliberately runs in the browser without a model or a server call: what
 * someone types here ("suizid", "abtreibung") must not leave the device
 * before they have even registered.
 */

export type TopicSearchTermKind = 'title' | 'related' | 'description';

export interface TopicSearchTerm {
	text: string;
	kind: TopicSearchTermKind;
}

export interface TopicSearchDocument {
	topicId: number;
	terms: TopicSearchTerm[];
}

export interface TopicSearchResult {
	topicId: number;
	score: number;
	/** The term that matched best, as written in the catalogue. */
	matchedTerm: string;
	matchedKind: TopicSearchTermKind;
}

interface IndexedWord {
	word: string;
	original: string;
	grams: Map<string, number>;
	norm: number;
}

interface IndexedTerm extends TopicSearchTerm {
	words: IndexedWord[];
}

export interface TopicSearchIndex {
	documents: { topicId: number; terms: IndexedTerm[] }[];
}

const KIND_WEIGHT: Record<TopicSearchTermKind, number> = {
	title: 1,
	related: 0.95,
	description: 0.75
};

/** Below this a suggestion is more likely noise than help. */
const MIN_SCORE = 0.5;
const MIN_WORD_SIMILARITY = 0.5;

export const normalizeSearchText = (text: string) =>
	text
		.toLowerCase()
		.replace(/ß/g, 'ss')
		.normalize('NFKD')
		.replace(/\p{M}/gu, '')
		.replace(/[^\p{L}\p{N}]+/gu, ' ')
		.trim();

const trigrams = (word: string) => {
	const padded = ` ${word} `;
	const grams = new Map<string, number>();
	const chars = Array.from(padded);
	for (let i = 0; i + 3 <= chars.length; i++) {
		const gram = chars.slice(i, i + 3).join('');
		grams.set(gram, (grams.get(gram) ?? 0) + 1);
	}
	return grams;
};

const vectorNorm = (grams: Map<string, number>) =>
	Math.sqrt(
		Array.from(grams.values()).reduce(
			(sum, count) => sum + count * count,
			0
		)
	);

const indexWords = (text: string): IndexedWord[] => {
	const originals = text.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
	return originals
		.map((original) => {
			const word = normalizeSearchText(original);
			const grams = trigrams(word);
			return { word, original, grams, norm: vectorNorm(grams) };
		})
		.filter(({ word }) => word.length > 0);
};

const cosine = (a: IndexedWord, b: IndexedWord) => {
	if (!a.norm || !b.norm) return 0;
	let dot = 0;
	a.grams.forEach((count, gram) => {
		dot += count * (b.grams.get(gram) ?? 0);
	});
	return dot / (a.norm * b.norm);
};

const wordScore = (query: IndexedWord, word: IndexedWord, kind: string) => {
	const q = query.word;
	const w = word.word;
	// Descriptions are long running text: two letters would prefix-match
	// half of it.
	const minPrefix = kind === 'description' ? 3 : 2;

	if (w === q) return 1;
	if (q.length >= minPrefix && w.startsWith(q)) {
		// Above a related-word hit (0.95 weight) so a title that starts with
		// the query wins over an everyday word that equals it.
		return 0.95 + 0.05 * (q.length / w.length);
	}
	if (q.length >= 4 && w.includes(q)) return 0.85;

	const similarity = cosine(query, word);
	return similarity >= MIN_WORD_SIMILARITY ? similarity * 0.9 : 0;
};

export const buildTopicSearchIndex = (
	documents: TopicSearchDocument[]
): TopicSearchIndex => ({
	documents: documents.map(({ topicId, terms }) => ({
		topicId,
		terms: terms
			.filter(({ text }) => text?.trim())
			.map((term) => ({ ...term, words: indexWords(term.text) }))
	}))
});

export const searchTopics = (
	index: TopicSearchIndex,
	query: string,
	limit = 6
): TopicSearchResult[] => {
	const queryWords = indexWords(query);
	if (queryWords.map(({ word }) => word).join('').length < 2) {
		return [];
	}

	const results: TopicSearchResult[] = [];

	index.documents.forEach(({ topicId, terms }) => {
		let best: TopicSearchResult | undefined;

		terms.forEach((term) => {
			let total = 0;
			let bestWord: IndexedWord | undefined;
			let bestWordScore = 0;

			queryWords.forEach((queryWord) => {
				let wordBest = 0;
				term.words.forEach((word) => {
					const score = wordScore(queryWord, word, term.kind);
					if (score > wordBest) wordBest = score;
					if (score > bestWordScore) {
						bestWordScore = score;
						bestWord = word;
					}
				});
				total += wordBest;
			});

			const score = (total / queryWords.length) * KIND_WEIGHT[term.kind];
			if (score >= MIN_SCORE && (!best || score > best.score)) {
				best = {
					topicId,
					score,
					// A description is a sentence; show the word that matched.
					matchedTerm:
						term.kind === 'description' && bestWord
							? bestWord.original
							: term.text,
					matchedKind: term.kind
				};
			}
		});

		if (best) results.push(best);
	});

	return results.sort((a, b) => b.score - a.score).slice(0, limit);
};
