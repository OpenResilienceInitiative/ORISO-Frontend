import { describe, expect, it, vi } from 'vitest';
import {
	buildRegistrationTopicPresentationGroups,
	getRegistrationCategoryIcon,
	getRegistrationCategoryName,
	RegistrationCategoryId,
	getRegistrationTopicDisplay,
	getRegistrationTopicIcon
} from './registrationDesign';

import { TopicsDataInterface } from '../../../globalState/interfaces/TopicsDataInterface';
import deCommon from '../../../resources/i18n/de/common.json';
import enCommon from '../../../resources/i18n/en/common.json';
import trCommon from '../../../resources/i18n/tr/common.json';

// The pinned de/en/tr copy never consults i18n, so this stub only ever answers
// for the languages #1154 is about. An unknown key returns the empty
// `defaultValue`, which is what i18next does for a key no catalogue carries.
const translations: Record<string, Record<string, string>> = {
	'registration.topic.catalog.trauerberatung.title': {
		ru: 'Консультация в связи с утратой'
	},
	'registration.topic.category.alter': { ru: 'Пожилой возраст' }
};

vi.mock('i18next', () => ({
	default: {
		isInitialized: true,
		t: (key: string, options?: { lng?: string; defaultValue?: string }) =>
			translations[key]?.[options?.lng ?? ''] ??
			options?.defaultValue ??
			''
	}
}));

/**
 * The cluster/topic taxonomy of the first registration step is owned by
 * Deutscher Caritasverband e.V. (ORISO-Frontend#973). These tests pin the
 * agreed wording and the agreed cluster membership so a future refactor of the
 * presentation layer cannot silently reshuffle the offering.
 */

const topicBySlug = (slug: string, id: number): TopicsDataInterface =>
	({
		id,
		name: slug,
		slug,
		description: '',
		internalIdentifier: slug,
		status: 'ACTIVE',
		createDate: '2026-08-07T00:00:00Z',
		updateDate: '2026-08-07T00:00:00Z',
		fallbackUrl: '',
		titles: {
			short: slug,
			long: slug,
			registrationDropdown: slug,
			welcome: slug
		}
	}) as unknown as TopicsDataInterface;

const ALL_TOPIC_SLUGS = [
	'general-social-counselling',
	'hospice-palliative-care-counselling',
	'life-in-old-age',
	'trauerberatung',
	'debt',
	'pregnancy',
	'offending',
	'sucht',
	'u25-suicide-prevention',
	'disability-psychological-impairment',
	'hiv-aids',
	'child-youth-rehabilitation',
	'cures-mothers-fathers',
	'parents-and-family',
	'counselling-men-boys',
	'children-youth-counselling',
	'school-to-work-transition',
	'initial-return-further-migration',
	'migration',
	'legal-guardianship-advance-care'
];

const allTopics = ALL_TOPIC_SLUGS.map((slug, index) =>
	topicBySlug(slug, index + 1)
);

describe('registration topic clusters (ORISO-Frontend#973)', () => {
	it('offers the six Caritas clusters in the agreed German wording and order', () => {
		const groups = buildRegistrationTopicPresentationGroups(
			allTopics,
			'de'
		);

		expect(groups.map((group) => group.name)).toEqual([
			'Alter',
			'Besondere Lebenssituationen & Krisen',
			'Gesundheit & Sucht',
			'Kinder, Jugend, Erwachsene, Schwangerschaft und Familie',
			'Migration',
			'Teilhabe für Menschen mit Beeinträchtigungen'
		]);
	});

	it('offers the same six clusters in the agreed English wording', () => {
		const groups = buildRegistrationTopicPresentationGroups(
			allTopics,
			'en'
		);

		expect(groups.map((group) => group.name)).toEqual([
			'Ageing, Older Adults',
			'Challenging Life Situations & Crises',
			'Health and Addiction',
			'Children, Young People and Families',
			'Migration & Integration',
			'Disability Inclusion'
		]);
	});

	it('assigns every topic to the agreed clusters (German wording)', () => {
		const groups = buildRegistrationTopicPresentationGroups(
			allTopics,
			'de'
		);
		const assignment = Object.fromEntries(
			groups.map((group) => [
				group.name,
				group.topics.map(
					(placement) =>
						getRegistrationTopicDisplay(placement.topic, 'de').title
				)
			])
		);

		expect(assignment).toEqual({
			'Alter': [
				'Allgemeine Sozialberatung',
				'Hospiz- und Palliativberatung',
				'Leben im Alter',
				'Trauerberatung'
			],
			'Besondere Lebenssituationen & Krisen': [
				'Allgemeine Sozialberatung',
				'Hospiz- und Palliativberatung',
				'Schulden',
				'Schwangerschaft',
				'Straffälligkeit',
				'Sucht',
				'Trauerberatung',
				'[U25] Suizidprävention'
			],
			'Gesundheit & Sucht': [
				'Behinderung und psychische Beeinträchtigung',
				'HIV und Aids',
				'Hospiz- und Palliativberatung',
				'Kinder- und Jugend-Reha',
				'Kuren für Mütter und Väter',
				'Leben im Alter',
				'Sucht',
				'[U25] Suizidprävention'
			],
			'Kinder, Jugend, Erwachsene, Schwangerschaft und Familie': [
				'Allgemeine Sozialberatung',
				'Eltern und Familie',
				'Hospiz- und Palliativberatung',
				'Jungen- und Männerberatung',
				'Kinder und Jugendliche',
				'Kinder- und Jugend-Reha',
				'Kuren für Mütter und Väter',
				'Schwangerschaft',
				'Sucht',
				'Übergang von Schule zu Beruf',
				'Trauerberatung',
				'[U25] Suizidprävention'
			],
			'Migration': ['Aus-/Rück- und Weiterwanderung', 'Migration'],
			'Teilhabe für Menschen mit Beeinträchtigungen': [
				'Behinderung und psychische Beeinträchtigung',
				'Kinder- und Jugend-Reha',
				'Rechtliche Betreuung und Vorsorge'
			]
		});
	});

	it('renders every topic with the agreed English title', () => {
		const titles = Object.fromEntries(
			allTopics.map((topic) => [
				topic.slug,
				getRegistrationTopicDisplay(topic, 'en').title
			])
		);

		expect(titles).toEqual({
			'general-social-counselling': 'Social Support',
			'hospice-palliative-care-counselling':
				'Hospice and Palliative Care Support',
			'life-in-old-age': 'Later Life Support',
			'trauerberatung': 'Bereavement Support',
			'debt': 'Debt',
			'pregnancy': 'Pregnancy',
			'offending': 'Offender Support',
			'sucht': 'Addiction',
			'u25-suicide-prevention': '[U25] Suicide Prevention',
			'disability-psychological-impairment':
				'Disability and Mental Health Support',
			'hiv-aids': 'HIV and AIDS',
			'child-youth-rehabilitation': 'Pediatric Rehabilitation',
			'cures-mothers-fathers': 'Parent Health Rehabilitation',
			'parents-and-family': 'Parent and Family Support',
			'counselling-men-boys': "Boys and Men's Support",
			'children-youth-counselling': 'Children and Young People',
			'school-to-work-transition': 'School-to-Work Transition',
			'initial-return-further-migration': 'Relocation and Return Support',
			'migration': 'Migration Support',
			'legal-guardianship-advance-care':
				'Supported Decision-Making and Advance Planning'
		});
	});

	// Topics created through the admin panel carry no slug — the form only
	// offers name, description, internal identifier and status. The four
	// topics #973 still needs from the backend must therefore be reachable by
	// internal identifier alone, and "migration" is already taken by
	// Aus-/Rück- und Weiterwanderung.
	it.each([
		['school-to-work', 'Übergang von Schule zu Beruf'],
		['addiction', 'Sucht'],
		['bereavement', 'Trauerberatung'],
		['migration-support', 'Migration']
	])(
		'recognises internal identifier "%s" when the backend sends no slug',
		(internalIdentifier, expectedTitle) => {
			const backendTopic = { slug: undefined, internalIdentifier };

			expect(getRegistrationTopicDisplay(backendTopic, 'de').title).toBe(
				expectedTitle
			);
		}
	);

	it('keeps Aus-/Rück- und Weiterwanderung on the internal identifier it already uses', () => {
		expect(
			getRegistrationTopicDisplay(
				{ slug: undefined, internalIdentifier: 'migration' },
				'de'
			).title
		).toBe('Aus-/Rück- und Weiterwanderung');
	});

	it('gives the school-to-work topic its own icon rather than the cluster fallback', () => {
		const icon = getRegistrationTopicIcon({
			slug: 'school-to-work-transition',
			internalIdentifier: 'school-to-work'
		});

		expect(icon).not.toBe(getRegistrationCategoryIcon(10004));
		expect(icon).toContain('schule');
	});

	it('keeps a topic that lives in several clusters independently selectable', () => {
		const groups = buildRegistrationTopicPresentationGroups(
			allTopics,
			'de'
		);
		const addictionPlacements = groups
			.flatMap((group) => group.topics)
			.filter((placement) => placement.topic.slug === 'sucht');

		expect(addictionPlacements).toHaveLength(3);
		expect(
			new Set(addictionPlacements.map((p) => p.placementId)).size
		).toBe(3);
		expect(new Set(addictionPlacements.map((p) => p.topic.id)).size).toBe(
			1
		);
	});

	it('drops topics the backend does not offer instead of rendering empty rows', () => {
		const groups = buildRegistrationTopicPresentationGroups(
			allTopics.filter((topic) => topic.slug !== 'migration'),
			'de'
		);
		const migrationGroup = groups.find(
			(group) => group.name === 'Migration'
		);

		expect(
			migrationGroup?.topics.map(
				(placement) =>
					getRegistrationTopicDisplay(placement.topic, 'de').title
			)
		).toEqual(['Aus-/Rück- und Weiterwanderung']);
	});
});

/**
 * Registration topic copy used to resolve through a `de | en | tr` table whose
 * default branch was English, so a Russian advice seeker got a Russian frame
 * around an English topic list. The pinned three stay pinned; every other
 * language now resolves through i18n and degrades to German like the rest of
 * the registration flow.
 */
describe('registration topic copy for other languages (ORISO-Frontend#1154)', () => {
	const bereavement = topicBySlug('trauerberatung', 1);

	it('renders a translated topic title when the catalogue carries one', () => {
		expect(getRegistrationTopicDisplay(bereavement, 'ru').title).toBe(
			'Консультация в связи с утратой'
		);
	});

	it('renders a translated cluster name when the catalogue carries one', () => {
		expect(getRegistrationCategoryName('alter', 'ru')).toBe(
			'Пожилой возраст'
		);
	});

	it('degrades an untranslated topic to German rather than English', () => {
		const { title } = getRegistrationTopicDisplay(
			topicBySlug('debt', 2),
			'ru'
		);

		expect(title).not.toBe('Debt');
		expect(title).toBe('Schulden');
	});

	it('degrades an untranslated cluster to German rather than English', () => {
		expect(getRegistrationCategoryName('migration', 'fr')).toBe(
			'Migration'
		);
		expect(getRegistrationCategoryName('gesundheit', 'fr')).toBe(
			'Gesundheit & Sucht'
		);
	});

	it('never renders the English cluster names for an unpinned language', () => {
		const groups = buildRegistrationTopicPresentationGroups(
			allTopics,
			'ti'
		);

		expect(groups.map((group) => group.name)).not.toContain(
			'Ageing, Older Adults'
		);
		expect(groups.map((group) => group.name)).not.toContain(
			'Disability Inclusion'
		);
	});

	it.each([
		['de', 'Trauerberatung'],
		['en', 'Bereavement Support'],
		['tr', 'Yas danışmanlığı']
	])('keeps the agreed %s wording pinned in code', (locale, expected) => {
		expect(getRegistrationTopicDisplay(bereavement, locale).title).toBe(
			expected
		);
	});
});

/**
 * de/en/tr copy is served from the pinned code table, not from i18n, so that
 * translation tooling cannot reword what Caritas agreed (#973). The catalogue
 * still has to carry those strings: the drift guard requires every locale to
 * hold the German key set, and Weblate needs the German source to translate
 * from. That leaves two copies of the same three languages, so pin them to
 * each other — otherwise they drift apart silently.
 */
describe('pinned copy matches the catalogue it is duplicated into', () => {
	type CatalogueTopicCopy = {
		category: Record<string, string>;
		catalog: Record<string, { title: string; description: string }>;
	};

	const catalogueOf = (catalogue: unknown): CatalogueTopicCopy =>
		(catalogue as { registration: { topic: CatalogueTopicCopy } })
			.registration.topic;

	it.each([
		['de', deCommon],
		['en', enCommon],
		['tr', trCommon]
	])('%s/common.json matches the pinned table', (locale, catalogue) => {
		const { category, catalog } = catalogueOf(catalogue);

		Object.entries(catalog).forEach(([slug, copy]) => {
			const display = getRegistrationTopicDisplay(
				topicBySlug(slug, 1),
				locale
			);

			expect(display.title, `${locale} ${slug} title`).toBe(copy.title);
			expect(display.description, `${locale} ${slug} description`).toBe(
				copy.description
			);
		});

		Object.entries(category).forEach(([id, name]) => {
			expect(
				getRegistrationCategoryName(
					id as RegistrationCategoryId,
					locale
				),
				`${locale} category ${id}`
			).toBe(name);
		});
	});
});
