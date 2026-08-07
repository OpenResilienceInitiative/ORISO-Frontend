import { describe, expect, it } from 'vitest';
import {
	buildRegistrationTopicPresentationGroups,
	getRegistrationTopicDisplay
} from './registrationDesign';
import { TopicsDataInterface } from '../../../globalState/interfaces/TopicsDataInterface';

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

	it('recognises the school-to-work topic when the backend only sends an internal identifier', () => {
		const backendTopic = {
			slug: undefined,
			internalIdentifier: 'school-to-work'
		};

		expect(getRegistrationTopicDisplay(backendTopic, 'de').title).toBe(
			'Übergang von Schule zu Beruf'
		);
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
