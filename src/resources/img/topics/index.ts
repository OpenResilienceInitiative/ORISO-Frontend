import artwork0_640 from './640/01-eltern-und-familie.webp';
import artwork0_1280 from './1280/01-eltern-und-familie.webp';
import artwork1_640 from './640/01-jungen-und-maennerberatung.webp';
import artwork1_1280 from './1280/01-jungen-und-maennerberatung.webp';
import artwork2_640 from './640/01-kategorie-familie-kinder-jugend.webp';
import artwork2_1280 from './1280/01-kategorie-familie-kinder-jugend.webp';
import artwork3_640 from './640/01-kinder-und-jugend-reha.webp';
import artwork3_1280 from './1280/01-kinder-und-jugend-reha.webp';
import artwork4_640 from './640/01-kinder-und-jugendliche.webp';
import artwork4_1280 from './1280/01-kinder-und-jugendliche.webp';
import artwork5_640 from './640/01-kuren-fuer-muetter-und-vaeter.webp';
import artwork5_1280 from './1280/01-kuren-fuer-muetter-und-vaeter.webp';
import artwork6_640 from './640/01-schwangerschaft.webp';
import artwork6_1280 from './1280/01-schwangerschaft.webp';
import artwork7_640 from './640/01-u25-suizidpraevention.webp';
import artwork7_1280 from './1280/01-u25-suizidpraevention.webp';
import artwork8_640 from './640/01-uebergang-schule-beruf.webp';
import artwork8_1280 from './1280/01-uebergang-schule-beruf.webp';
import artwork9_640 from './640/02-hospiz-und-palliativberatung.webp';
import artwork9_1280 from './1280/02-hospiz-und-palliativberatung.webp';
import artwork10_640 from './640/02-kategorie-alter-pflege-abschied.webp';
import artwork10_1280 from './1280/02-kategorie-alter-pflege-abschied.webp';
import artwork11_640 from './640/02-leben-im-alter.webp';
import artwork11_1280 from './1280/02-leben-im-alter.webp';
import artwork12_640 from './640/02-rechtliche-betreuung-vorsorge.webp';
import artwork12_1280 from './1280/02-rechtliche-betreuung-vorsorge.webp';
import artwork13_640 from './640/02-trauerberatung.webp';
import artwork13_1280 from './1280/02-trauerberatung.webp';
import artwork14_640 from './640/03-aus-rueck-weiterwanderung.webp';
import artwork14_1280 from './1280/03-aus-rueck-weiterwanderung.webp';
import artwork15_640 from './640/03-kategorie-migration-integration.webp';
import artwork15_1280 from './1280/03-kategorie-migration-integration.webp';
import artwork16_640 from './640/03-migration.webp';
import artwork16_1280 from './1280/03-migration.webp';
import artwork17_640 from './640/04-behinderung-psychische-beeintraechtigung.webp';
import artwork17_1280 from './1280/04-behinderung-psychische-beeintraechtigung.webp';
import artwork18_640 from './640/04-hiv-und-aids.webp';
import artwork18_1280 from './1280/04-hiv-und-aids.webp';
import artwork19_640 from './640/04-kategorie-gesundheit-behinderung-sucht.webp';
import artwork19_1280 from './1280/04-kategorie-gesundheit-behinderung-sucht.webp';
import artwork20_640 from './640/04-kinder-und-jugend-reha.webp';
import artwork20_1280 from './1280/04-kinder-und-jugend-reha.webp';
import artwork21_640 from './640/04-kuren-fuer-muetter-und-vaeter.webp';
import artwork21_1280 from './1280/04-kuren-fuer-muetter-und-vaeter.webp';
import artwork22_640 from './640/04-sucht.webp';
import artwork22_1280 from './1280/04-sucht.webp';
import artwork23_640 from './640/05-allgemeine-sozialberatung.webp';
import artwork23_1280 from './1280/05-allgemeine-sozialberatung.webp';
import artwork24_640 from './640/05-hiv-und-aids.webp';
import artwork24_1280 from './1280/05-hiv-und-aids.webp';
import artwork25_640 from './640/05-kategorie-soziale-notlagen-krisen-finanzen.webp';
import artwork25_1280 from './1280/05-kategorie-soziale-notlagen-krisen-finanzen.webp';
import artwork26_640 from './640/05-rechtliche-betreuung-vorsorge.webp';
import artwork26_1280 from './1280/05-rechtliche-betreuung-vorsorge.webp';
import artwork27_640 from './640/05-schulden.webp';
import artwork27_1280 from './1280/05-schulden.webp';
import artwork28_640 from './640/05-straffaelligkeit.webp';
import artwork28_1280 from './1280/05-straffaelligkeit.webp';
import artwork29_640 from './640/05-u25-suizidpraevention.webp';
import artwork29_1280 from './1280/05-u25-suizidpraevention.webp';
import artwork30_640 from './640/06-interner-gruppenchat.webp';
import artwork30_1280 from './1280/06-interner-gruppenchat.webp';
import artwork31_640 from './640/06-selbsthilfegruppe.webp';
import artwork31_1280 from './1280/06-selbsthilfegruppe.webp';

export interface CardArtwork {
	readonly id: string;
	readonly label: string;
	readonly kind: 'topic' | 'category' | 'format';
	readonly subject?: string;
	readonly src: string;
	readonly src1280: string;
}

/** Approved 16:9 illustrations. Category motifs are artwork only: registration
 * keeps its existing six-category taxonomy and square icons. Repeated subjects
 * retain each approved variant under its original motif id. */
export const ARTWORK_CATALOGUE = {
	'01-eltern-und-familie': {
		id: '01-eltern-und-familie',
		label: 'Eltern und Familie',
		kind: 'topic',
		subject: 'parents-and-family',
		src: artwork0_640,
		src1280: artwork0_1280
	},
	'01-jungen-und-maennerberatung': {
		id: '01-jungen-und-maennerberatung',
		label: 'Jungen- und Männerberatung',
		kind: 'topic',
		subject: 'counselling-men-boys',
		src: artwork1_640,
		src1280: artwork1_1280
	},
	'01-kategorie-familie-kinder-jugend': {
		id: '01-kategorie-familie-kinder-jugend',
		label: 'Familie, Kinder, Jugend',
		kind: 'category',
		src: artwork2_640,
		src1280: artwork2_1280
	},
	'01-kinder-und-jugend-reha': {
		id: '01-kinder-und-jugend-reha',
		label: 'Kinder- und Jugend-Reha',
		kind: 'topic',
		subject: 'child-youth-rehabilitation',
		src: artwork3_640,
		src1280: artwork3_1280
	},
	'01-kinder-und-jugendliche': {
		id: '01-kinder-und-jugendliche',
		label: 'Kinder und Jugendliche',
		kind: 'topic',
		subject: 'children-youth-counselling',
		src: artwork4_640,
		src1280: artwork4_1280
	},
	'01-kuren-fuer-muetter-und-vaeter': {
		id: '01-kuren-fuer-muetter-und-vaeter',
		label: 'Kuren für Mütter und Väter',
		kind: 'topic',
		subject: 'cures-mothers-fathers',
		src: artwork5_640,
		src1280: artwork5_1280
	},
	'01-schwangerschaft': {
		id: '01-schwangerschaft',
		label: 'Schwangerschaft',
		kind: 'topic',
		subject: 'pregnancy',
		src: artwork6_640,
		src1280: artwork6_1280
	},
	'01-u25-suizidpraevention': {
		id: '01-u25-suizidpraevention',
		label: 'U25 Suizidprävention',
		kind: 'topic',
		subject: 'u25-suicide-prevention',
		src: artwork7_640,
		src1280: artwork7_1280
	},
	'01-uebergang-schule-beruf': {
		id: '01-uebergang-schule-beruf',
		label: 'Übergang Schule – Beruf',
		kind: 'topic',
		subject: 'school-to-work-transition',
		src: artwork8_640,
		src1280: artwork8_1280
	},
	'02-hospiz-und-palliativberatung': {
		id: '02-hospiz-und-palliativberatung',
		label: 'Hospiz- und Palliativberatung',
		kind: 'topic',
		subject: 'hospice-palliative-care-counselling',
		src: artwork9_640,
		src1280: artwork9_1280
	},
	'02-kategorie-alter-pflege-abschied': {
		id: '02-kategorie-alter-pflege-abschied',
		label: 'Alter, Pflege, Abschied',
		kind: 'category',
		src: artwork10_640,
		src1280: artwork10_1280
	},
	'02-leben-im-alter': {
		id: '02-leben-im-alter',
		label: 'Leben im Alter',
		kind: 'topic',
		subject: 'life-in-old-age',
		src: artwork11_640,
		src1280: artwork11_1280
	},
	'02-rechtliche-betreuung-vorsorge': {
		id: '02-rechtliche-betreuung-vorsorge',
		label: 'Rechtliche Betreuung & Vorsorge',
		kind: 'topic',
		subject: 'legal-guardianship-advance-care',
		src: artwork12_640,
		src1280: artwork12_1280
	},
	'02-trauerberatung': {
		id: '02-trauerberatung',
		label: 'Trauerberatung',
		kind: 'topic',
		subject: 'trauerberatung',
		src: artwork13_640,
		src1280: artwork13_1280
	},
	'03-aus-rueck-weiterwanderung': {
		id: '03-aus-rueck-weiterwanderung',
		label: 'Aus-, Rück- und Weiterwanderung',
		kind: 'topic',
		subject: 'initial-return-further-migration',
		src: artwork14_640,
		src1280: artwork14_1280
	},
	'03-kategorie-migration-integration': {
		id: '03-kategorie-migration-integration',
		label: 'Migration, Integration',
		kind: 'category',
		src: artwork15_640,
		src1280: artwork15_1280
	},
	'03-migration': {
		id: '03-migration',
		label: 'Migration',
		kind: 'topic',
		subject: 'migration',
		src: artwork16_640,
		src1280: artwork16_1280
	},
	'04-behinderung-psychische-beeintraechtigung': {
		id: '04-behinderung-psychische-beeintraechtigung',
		label: 'Behinderung und psychische Beeinträchtigung',
		kind: 'topic',
		subject: 'disability-psychological-impairment',
		src: artwork17_640,
		src1280: artwork17_1280
	},
	'04-hiv-und-aids': {
		id: '04-hiv-und-aids',
		label: 'HIV & AIDS',
		kind: 'topic',
		subject: 'hiv-aids',
		src: artwork18_640,
		src1280: artwork18_1280
	},
	'04-kategorie-gesundheit-behinderung-sucht': {
		id: '04-kategorie-gesundheit-behinderung-sucht',
		label: 'Gesundheit, Behinderung, Sucht',
		kind: 'category',
		src: artwork19_640,
		src1280: artwork19_1280
	},
	'04-kinder-und-jugend-reha': {
		id: '04-kinder-und-jugend-reha',
		label: 'Kinder- und Jugend-Reha',
		kind: 'topic',
		subject: 'child-youth-rehabilitation',
		src: artwork20_640,
		src1280: artwork20_1280
	},
	'04-kuren-fuer-muetter-und-vaeter': {
		id: '04-kuren-fuer-muetter-und-vaeter',
		label: 'Kuren für Mütter und Väter',
		kind: 'topic',
		subject: 'cures-mothers-fathers',
		src: artwork21_640,
		src1280: artwork21_1280
	},
	'04-sucht': {
		id: '04-sucht',
		label: 'Sucht',
		kind: 'topic',
		subject: 'sucht',
		src: artwork22_640,
		src1280: artwork22_1280
	},
	'05-allgemeine-sozialberatung': {
		id: '05-allgemeine-sozialberatung',
		label: 'Allgemeine Sozialberatung',
		kind: 'topic',
		subject: 'general-social-counselling',
		src: artwork23_640,
		src1280: artwork23_1280
	},
	'05-hiv-und-aids': {
		id: '05-hiv-und-aids',
		label: 'HIV & AIDS',
		kind: 'topic',
		subject: 'hiv-aids',
		src: artwork24_640,
		src1280: artwork24_1280
	},
	'05-kategorie-soziale-notlagen-krisen-finanzen': {
		id: '05-kategorie-soziale-notlagen-krisen-finanzen',
		label: 'Soziale Notlagen, Krisen, Finanzen',
		kind: 'category',
		src: artwork25_640,
		src1280: artwork25_1280
	},
	'05-rechtliche-betreuung-vorsorge': {
		id: '05-rechtliche-betreuung-vorsorge',
		label: 'Rechtliche Betreuung & Vorsorge',
		kind: 'topic',
		subject: 'legal-guardianship-advance-care',
		src: artwork26_640,
		src1280: artwork26_1280
	},
	'05-schulden': {
		id: '05-schulden',
		label: 'Schulden',
		kind: 'topic',
		subject: 'debt',
		src: artwork27_640,
		src1280: artwork27_1280
	},
	'05-straffaelligkeit': {
		id: '05-straffaelligkeit',
		label: 'Straffälligkeit',
		kind: 'topic',
		subject: 'offending',
		src: artwork28_640,
		src1280: artwork28_1280
	},
	'05-u25-suizidpraevention': {
		id: '05-u25-suizidpraevention',
		label: 'U25 Suizidprävention',
		kind: 'topic',
		subject: 'u25-suicide-prevention',
		src: artwork29_640,
		src1280: artwork29_1280
	},
	'06-interner-gruppenchat': {
		id: '06-interner-gruppenchat',
		label: 'Interner Gruppenchat',
		kind: 'format',
		src: artwork30_640,
		src1280: artwork30_1280
	},
	'06-selbsthilfegruppe': {
		id: '06-selbsthilfegruppe',
		label: 'Selbsthilfegruppe',
		kind: 'format',
		src: artwork31_640,
		src1280: artwork31_1280
	}
} as const satisfies Record<string, CardArtwork>;

export const INTERNAL_CHAT_ARTWORK =
	ARTWORK_CATALOGUE['06-interner-gruppenchat'];
export const SELF_HELP_ARTWORK = ARTWORK_CATALOGUE['06-selbsthilfegruppe'];

/** Keep the established German-name normalization for agency id/name DTOs. */
export const topicSlug = (topic: string): string =>
	topic
		.toLowerCase()
		.replace(/ä/g, 'a')
		.replace(/ö/g, 'o')
		.replace(/ü/g, 'u')
		.replace(/ß/g, 'ss')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');

// AgencyTopicsDTO carries only id/name, so repeated subjects use the first
// supplied variant. Canonical English aliases match registrationDesign.ts;
// neither names nor these aliases are a stable-ID API contract.
const topicArtworkByAlias = new Map<string, CardArtwork>(
	[
		{
			artwork: ARTWORK_CATALOGUE['01-eltern-und-familie'],
			aliases: ['parents-and-family', 'Eltern und Familie']
		},
		{
			artwork: ARTWORK_CATALOGUE['01-kinder-und-jugendliche'],
			aliases: ['children-youth-counselling', 'Kinder und Jugendliche']
		},
		{
			artwork: ARTWORK_CATALOGUE['01-kinder-und-jugend-reha'],
			aliases: [
				'child-youth-rehabilitation',
				'Kinder- und Jugend-Reha',
				'Kinder und Jugend Reha'
			]
		},
		{
			artwork: ARTWORK_CATALOGUE['01-kuren-fuer-muetter-und-vaeter'],
			aliases: ['cures-mothers-fathers', 'Kuren für Mütter und Väter']
		},
		{
			artwork: ARTWORK_CATALOGUE['01-schwangerschaft'],
			aliases: ['pregnancy', 'Schwangerschaft']
		},
		{
			artwork: ARTWORK_CATALOGUE['01-u25-suizidpraevention'],
			aliases: ['u25-suicide-prevention', 'U25 Suizidprävention']
		},
		{
			artwork: ARTWORK_CATALOGUE['01-jungen-und-maennerberatung'],
			aliases: ['counselling-men-boys', 'Jungen- und Männerberatung']
		},
		{
			artwork: ARTWORK_CATALOGUE['01-uebergang-schule-beruf'],
			aliases: [
				'school-to-work-transition',
				'Übergang Schule – Beruf',
				'Übergang von Schule zu Beruf'
			]
		},
		{
			artwork: ARTWORK_CATALOGUE['02-hospiz-und-palliativberatung'],
			aliases: [
				'hospice-palliative-care-counselling',
				'Hospiz- und Palliativberatung'
			]
		},
		{
			artwork: ARTWORK_CATALOGUE['02-leben-im-alter'],
			aliases: ['life-in-old-age', 'Leben im Alter']
		},
		{
			artwork: ARTWORK_CATALOGUE['02-rechtliche-betreuung-vorsorge'],
			aliases: [
				'legal-guardianship-advance-care',
				'Rechtliche Betreuung & Vorsorge',
				'Rechtliche Betreuung und Vorsorge',
				'Rechtliche Betreuung Vorsorge'
			]
		},
		{
			artwork: ARTWORK_CATALOGUE['02-trauerberatung'],
			aliases: ['trauerberatung', 'Trauerberatung']
		},
		{
			artwork: ARTWORK_CATALOGUE['03-aus-rueck-weiterwanderung'],
			aliases: [
				'initial-return-further-migration',
				'Aus-, Rück- und Weiterwanderung',
				'Aus Rück Weiterwanderung'
			]
		},
		{
			artwork: ARTWORK_CATALOGUE['03-migration'],
			aliases: ['migration', 'Migration']
		},
		{
			artwork:
				ARTWORK_CATALOGUE[
					'04-behinderung-psychische-beeintraechtigung'
				],
			aliases: [
				'disability-psychological-impairment',
				'Behinderung und psychische Beeinträchtigung',
				'Behinderung psychische Beeinträchtigung'
			]
		},
		{
			artwork: ARTWORK_CATALOGUE['04-hiv-und-aids'],
			aliases: ['hiv-aids', 'HIV & AIDS', 'HIV und AIDS']
		},
		{ artwork: ARTWORK_CATALOGUE['04-sucht'], aliases: ['sucht', 'Sucht'] },
		{
			artwork: ARTWORK_CATALOGUE['05-allgemeine-sozialberatung'],
			aliases: [
				'general-social-counselling',
				'Allgemeine Sozialberatung',
				'Sozialberatung'
			]
		},
		{
			artwork: ARTWORK_CATALOGUE['05-schulden'],
			aliases: ['debt', 'Schulden']
		},
		{
			artwork: ARTWORK_CATALOGUE['05-straffaelligkeit'],
			aliases: ['offending', 'Straffälligkeit']
		}
	].flatMap(({ artwork, aliases }) =>
		aliases.map((alias): [string, CardArtwork] => [
			topicSlug(alias),
			artwork
		])
	)
);

export const getTopicCardArtwork = (topic?: string | null): CardArtwork =>
	(topic && topicArtworkByAlias.get(topicSlug(topic))) || SELF_HELP_ARTWORK;

/** Existing string URL API retained for other consumers. */
export const getTopicCardImage = (topic?: string | null): string =>
	getTopicCardArtwork(topic).src;

export const hasTopicCardImage = (topic?: string | null): boolean =>
	Boolean(topic && topicArtworkByAlias.has(topicSlug(topic)));
