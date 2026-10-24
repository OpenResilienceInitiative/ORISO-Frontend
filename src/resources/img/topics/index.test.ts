import { describe, it, expect } from 'vite-plus/test';
import {
	ARTWORK_CATALOGUE,
	getTopicCardImage,
	hasTopicCardImage,
	topicSlug
} from './index';

describe('topicSlug', () => {
	it('lowercases and replaces German umlauts with their ASCII equivalents', () => {
		expect(topicSlug('Schulden')).toBe('schulden');
		expect(topicSlug('Trägerberatung')).toBe('tragerberatung');
		expect(topicSlug('Behinderung und psychische Beeinträchtigung')).toBe(
			'behinderung-und-psychische-beeintrachtigung'
		);
		expect(topicSlug('Straßensozialarbeit')).toBe('strassensozialarbeit');
	});

	it('collapses runs of non-alphanumeric characters into single hyphens', () => {
		expect(topicSlug('HIV & AIDS')).toBe('hiv-aids');
		expect(topicSlug('Aus-, Rück- und Weiterwanderung')).toBe(
			'aus-ruck-und-weiterwanderung'
		);
	});

	it('trims leading and trailing hyphens', () => {
		expect(topicSlug('  schulden  ')).toBe('schulden');
		expect(topicSlug('!!!schulden!!!')).toBe('schulden');
	});
});

const subjects = [
	['Eltern und Familie', 'parents-and-family', '01-eltern-und-familie'],
	[
		'Kinder und Jugendliche',
		'children-youth-counselling',
		'01-kinder-und-jugendliche'
	],
	[
		'Kinder- und Jugend-Reha',
		'child-youth-rehabilitation',
		'01-kinder-und-jugend-reha'
	],
	[
		'Kuren für Mütter und Väter',
		'cures-mothers-fathers',
		'01-kuren-fuer-muetter-und-vaeter'
	],
	['Schwangerschaft', 'pregnancy', '01-schwangerschaft'],
	[
		'U25 Suizidprävention',
		'u25-suicide-prevention',
		'01-u25-suizidpraevention'
	],
	[
		'Jungen- und Männerberatung',
		'counselling-men-boys',
		'01-jungen-und-maennerberatung'
	],
	[
		'Übergang von Schule zu Beruf',
		'school-to-work-transition',
		'01-uebergang-schule-beruf'
	],
	[
		'Hospiz- und Palliativberatung',
		'hospice-palliative-care-counselling',
		'02-hospiz-und-palliativberatung'
	],
	['Leben im Alter', 'life-in-old-age', '02-leben-im-alter'],
	[
		'Rechtliche Betreuung & Vorsorge',
		'legal-guardianship-advance-care',
		'02-rechtliche-betreuung-vorsorge'
	],
	['Trauerberatung', 'trauerberatung', '02-trauerberatung'],
	[
		'Aus-, Rück- und Weiterwanderung',
		'initial-return-further-migration',
		'03-aus-rueck-weiterwanderung'
	],
	['Migration', 'migration', '03-migration'],
	[
		'Behinderung und psychische Beeinträchtigung',
		'disability-psychological-impairment',
		'04-behinderung-psychische-beeintraechtigung'
	],
	['HIV & AIDS', 'hiv-aids', '04-hiv-und-aids'],
	['Sucht', 'sucht', '04-sucht'],
	[
		'Allgemeine Sozialberatung',
		'general-social-counselling',
		'05-allgemeine-sozialberatung'
	],
	['Schulden', 'debt', '05-schulden'],
	['Straffälligkeit', 'offending', '05-straffaelligkeit']
];

describe('approved topic artwork', () => {
	it.each(subjects)(
		'maps %s and its canonical registration slug',
		(name, slug, motif) => {
			expect(hasTopicCardImage(name)).toBe(true);
			expect(getTopicCardImage(name)).toContain(`/640/${motif}.webp`);
			expect(getTopicCardImage(slug)).toBe(getTopicCardImage(name));
		}
	);

	it('recognizes the shorter Sozialberatung name used by agencies', () => {
		expect(getTopicCardImage('Sozialberatung')).toBe(
			getTopicCardImage('Allgemeine Sozialberatung')
		);
	});

	it.each([null, undefined, '', 'Noch unbekanntes Thema'])(
		'uses approved self-help artwork for %s',
		(topic) => {
			expect(hasTopicCardImage(topic)).toBe(false);
			expect(getTopicCardImage(topic)).toContain(
				'/640/06-selbsthilfegruppe.webp'
			);
		}
	);
});

describe('approved artwork inventory', () => {
	it('keeps all 32 motifs addressable, including category and repeated subject variants', () => {
		const artwork = Object.values(ARTWORK_CATALOGUE);
		expect(artwork).toHaveLength(32);
		expect(artwork.filter((item) => item.kind === 'category')).toHaveLength(
			5
		);
		expect(artwork.filter((item) => item.kind === 'format')).toHaveLength(
			2
		);
		const topicVariants = artwork.filter((item) => item.kind === 'topic');
		expect(topicVariants).toHaveLength(25);
		expect(new Set(topicVariants.map((item) => item.subject)).size).toBe(
			20
		);
		for (const item of artwork) {
			expect(item.src).toContain(`/640/${item.id}.webp`);
			expect(item.src1280).toContain(`/1280/${item.id}.webp`);
		}
	});
});
