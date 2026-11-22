// The configured singleton, not `src/i18n.ts` — importing the app module here
// would drag its module-level localStorage and DevToolbar side effects into
// every consumer of this design module.
import i18n from 'i18next';
import { TopicsDataInterface } from '../../../globalState/interfaces/TopicsDataInterface';
import { TopicGroup } from '../../../globalState/interfaces/TopicGroups';
import { getConsultingTypeServiceOrigin } from '../../../resources/scripts/runtimeConfig';
import {
	orisoInputColors,
	orisoTextFieldSx
} from '../../form/orisoInputDesign';

import category01 from '../../../resources/img/registration-md3/icons/cat-01.png';
import category02 from '../../../resources/img/registration-md3/icons/cat-02.png';
import category03 from '../../../resources/img/registration-md3/icons/cat-03.png';
import category04 from '../../../resources/img/registration-md3/icons/cat-04.png';
import category05 from '../../../resources/img/registration-md3/icons/cat-05.png';

import parentsFamily from '../../../resources/img/registration-md3/icons/t-01-eltern-und-familie.png';
import menBoys from '../../../resources/img/registration-md3/icons/t-01-jungen-und-ma-nnerberatung.png';
import childYouthRehab01 from '../../../resources/img/registration-md3/icons/t-01-kinder-und-jugend-reha.png';
import childrenYouth from '../../../resources/img/registration-md3/icons/t-01-kinder-und-jugendliche.png';
import curesParents01 from '../../../resources/img/registration-md3/icons/t-01-kuren-fu-r-mu-tter-und-va-ter.png';
import pregnancy from '../../../resources/img/registration-md3/icons/t-01-schwangerschaft.png';
import u25Prevention01 from '../../../resources/img/registration-md3/icons/t-01-u25-suizidpra-vention.png';
import schoolToWork from '../../../resources/img/registration-md3/icons/t-01-u-bergang-von-schule-zu-beruf.png';
import bereavement02 from '../../../resources/img/registration-md3/icons/t-02-trauerberatung.png';
import hospicePalliative from '../../../resources/img/registration-md3/icons/t-02-hospiz-und-palliativberatung.png';
import lifeInOldAge from '../../../resources/img/registration-md3/icons/t-02-leben-im-alter.png';
import legalGuardianship02 from '../../../resources/img/registration-md3/icons/t-02-rechtliche-betreuung-und-vorsorge.png';
import migration03 from '../../../resources/img/registration-md3/icons/t-03-migration.png';
import initialReturnMigration03 from '../../../resources/img/registration-md3/icons/t-03-aus-ru-ck-und-weiterwanderung.png';
import disabilityPsych from '../../../resources/img/registration-md3/icons/t-04-behinderung-und-psychische-beeintra-chtigung.png';
import hivAids04 from '../../../resources/img/registration-md3/icons/t-04-hiv-und-aids.png';
import childYouthRehab04 from '../../../resources/img/registration-md3/icons/t-04-kinder-und-jugend-reha.png';
import curesParents04 from '../../../resources/img/registration-md3/icons/t-04-kuren-fu-r-mu-tter-und-va-ter.png';
import addiction04 from '../../../resources/img/registration-md3/icons/t-04-sucht.png';
import generalSocial from '../../../resources/img/registration-md3/icons/t-05-allgemeine-sozialberatung.png';
import debt from '../../../resources/img/registration-md3/icons/t-05-schulden.png';
import offending from '../../../resources/img/registration-md3/icons/t-05-straffa-lligkeit.png';
import u25Prevention05 from '../../../resources/img/registration-md3/icons/t-05-u25-suizidpra-vention.png';

export const registrationMd3 = {
	...orisoInputColors,
	// #143: hero panel follows the tenant primary family; the literal stops
	// keep the designed red gradient when no palette is injected.
	heroGradient:
		'linear-gradient(152deg, var(--m3-primary-container, #DA2530) 0%, var(--m3-primary, #C0121F) 46%, var(--m3-primary-hover, #7C0D15) 100%)'
} as const;

export const registrationMd3TextFieldSx = orisoTextFieldSx;

export const registrationMotion = {
	easeOut: 'cubic-bezier(0.22, 1, 0.36, 1)',
	softSpring: 'cubic-bezier(0.34, 1.24, 0.44, 1)',
	quick: '180ms',
	standard: '240ms',
	slow: '320ms'
} as const;

export const registrationScreenTitleSx = {
	color: registrationMd3.onSurface,
	fontSize: { xs: 28, sm: 28 },
	fontWeight: 700,
	lineHeight: '35px',
	letterSpacing: 0
} as const;

export const registrationScreenIntroSx = {
	color: registrationMd3.onSurfaceVariant,
	fontSize: 16,
	lineHeight: '24px',
	letterSpacing: 0
} as const;

export const registrationScreenKickerSx = {
	color: registrationMd3.onSurfaceVariant,
	fontSize: 14,
	fontWeight: 600,
	lineHeight: '20px',
	letterSpacing: '0.1px',
	textTransform: 'uppercase'
} as const;

const categoryIcons = [
	category01,
	category02,
	category03,
	category04,
	category05
];

const topicIconBySlug: Record<string, string> = {
	'parents-and-family': parentsFamily,
	'children-youth-counselling': childrenYouth,
	'child-youth-rehabilitation': childYouthRehab01,
	'cures-mothers-fathers': curesParents01,
	'pregnancy': pregnancy,
	'u25-suicide-prevention': u25Prevention01,
	'counselling-men-boys': menBoys,
	'hospice-palliative-care-counselling': hospicePalliative,
	'life-in-old-age': lifeInOldAge,
	'legal-guardianship-advance-care': legalGuardianship02,
	'initial-return-further-migration': initialReturnMigration03,
	'migration': migration03,
	'disability-psychological-impairment': disabilityPsych,
	'hiv-aids': hivAids04,
	'sucht': addiction04,
	'trauerberatung': bereavement02,
	'general-social-counselling': generalSocial,
	'debt': debt,
	'offending': offending,
	'school-to-work-transition': schoolToWork
};

const topicIconByInternalIdentifier: Record<string, string> = {
	'parents-family': parentsFamily,
	'children-youth': childrenYouth,
	'child-youth-rehab': childYouthRehab01,
	'cures-parents': curesParents01,
	'pregnancy': pregnancy,
	'u25-suicide-prevention': u25Prevention01,
	'men-boys': menBoys,
	'hospice-palliative': hospicePalliative,
	'life-in-old-age': lifeInOldAge,
	'legal-guardianship': legalGuardianship02,
	'migration': initialReturnMigration03,
	'disability-psych': disabilityPsych,
	'hiv-aids': hivAids04,
	'general-social': generalSocial,
	'debt': debt,
	'offending': offending,
	'school-to-work': schoolToWork,
	'addiction': addiction04,
	'bereavement': bereavement02,
	'migration-support': migration03
};

type RegistrationTopicCopy = {
	title: string;
	description: string;
};

const topicDisplayCopyByKey: Record<
	string,
	{
		de: RegistrationTopicCopy;
		en: RegistrationTopicCopy;
		tr: RegistrationTopicCopy;
	}
> = {
	'parents-and-family': {
		de: {
			title: 'Eltern und Familie',
			description:
				'Ob Erziehungsfragen, Konflikte oder familiäre Krisen - hier finden Sie verständnisvolle Begleitung.'
		},
		en: {
			title: 'Parent and Family Support',
			description:
				'Support for parenting questions, conflict, and family pressure.'
		},
		tr: {
			title: 'Ebeveynler ve aile',
			description:
				'Ebeveynlik soruları, çatışmalar veya aile içi krizlerde anlayışlı destek bulabilirsiniz.'
		}
	},
	'children-youth-counselling': {
		de: {
			title: 'Kinder und Jugendliche',
			description:
				'Wenn der Alltag zu viel wird - hier gibt es Hilfe und ein offenes Ohr.'
		},
		en: {
			title: 'Children and Young People',
			description:
				'Support and a listening ear when everyday life becomes too much.'
		},
		tr: {
			title: 'Çocuklar ve gençler',
			description:
				'Günlük yaşam fazla geldiğinde burada yardım ve sizi dinleyen biri var.'
		}
	},
	'child-youth-rehabilitation': {
		de: {
			title: 'Kinder- und Jugend-Reha',
			description:
				'Für junge Menschen, die nach Krankheit oder Belastung neue Kraft schöpfen möchten.'
		},
		en: {
			title: 'Pediatric Rehabilitation',
			description:
				'Rehabilitation guidance for children and young people.'
		},
		tr: {
			title: 'Çocuk ve gençlik rehabilitasyonu',
			description:
				'Hastalık veya zorlanmadan sonra yeniden güç kazanmak isteyen gençler için.'
		}
	},
	'cures-mothers-fathers': {
		de: {
			title: 'Kuren für Mütter und Väter',
			description:
				'Kurmaßnahmen helfen erschöpften Eltern, wieder zu sich zu finden.'
		},
		en: {
			title: 'Parent Health Rehabilitation',
			description: 'Guidance on recovery programs for exhausted parents.'
		},
		tr: {
			title: 'Anneler ve babalar için kürler',
			description:
				'Yorgun ebeveynlerin yeniden güç toplamasına yardımcı olan kür programları hakkında danışmanlık.'
		}
	},
	'pregnancy': {
		de: {
			title: 'Schwangerschaft',
			description:
				'Bei Fragen, Unsicherheit oder schwierigen Umständen sind wir da.'
		},
		en: {
			title: 'Pregnancy',
			description:
				'Support for pregnancy-related questions and difficult circumstances.'
		},
		tr: {
			title: 'Hamilelik',
			description:
				'Sorularınız, belirsizlikleriniz veya zor durumlarınız olduğunda yanınızdayız.'
		}
	},
	'u25-suicide-prevention': {
		de: {
			title: '[U25] Suizidprävention',
			description:
				'Anonyme Begleitung für junge Menschen in Krisen und Suizidgedanken.'
		},
		en: {
			title: '[U25] Suicide Prevention',
			description:
				'Anonymous support for young people in crisis or with suicidal thoughts.'
		},
		tr: {
			title: 'U25 intiharı önleme',
			description:
				'Kriz yaşayan veya intihar düşünceleri olan gençler için anonim destek.'
		}
	},
	'school-to-work-transition': {
		de: {
			title: 'Übergang von Schule zu Beruf',
			description:
				'Begleitung beim Schritt von der Schule in Ausbildung, Studium und Beruf.'
		},
		en: {
			title: 'School-to-Work Transition',
			description:
				'Support for the step from school into training, study, and work.'
		},
		tr: {
			title: 'Okuldan mesleğe geçiş',
			description:
				'Okuldan mesleki eğitime, üniversiteye ve iş hayatına geçişte destek.'
		}
	},
	'counselling-men-boys': {
		de: {
			title: 'Jungen- und Männerberatung',
			description:
				'Ein sicherer Raum für Männer und Jungen, um offen über Sorgen zu sprechen.'
		},
		en: {
			title: "Boys and Men's Support",
			description:
				'A safe space for men and boys to talk openly about worries.'
		},
		tr: {
			title: 'Erkek çocuklar ve erkekler için danışmanlık',
			description:
				'Erkeklerin ve erkek çocukların endişelerini açıkça konuşabileceği güvenli bir alan.'
		}
	},
	'hospice-palliative-care-counselling': {
		de: {
			title: 'Hospiz- und Palliativberatung',
			description:
				'Beratung bei schwerer Krankheit, Sterben, Abschied und Begleitung.'
		},
		en: {
			title: 'Hospice and Palliative Care Support',
			description:
				'Counselling around serious illness, dying, farewell, and care.'
		},
		tr: {
			title: 'Hospis ve palyatif danışmanlık',
			description:
				'Ağır hastalık, ölüm, veda ve bakım süreçlerinde danışmanlık.'
		}
	},
	'life-in-old-age': {
		de: {
			title: 'Leben im Alter',
			description:
				'Unterstuetzung bei Fragen rund um Alter, Pflege und Alltag.'
		},
		en: {
			title: 'Later Life Support',
			description:
				'Support for questions around ageing, care, and everyday life.'
		},
		tr: {
			title: 'Yaşlılıkta yaşam',
			description:
				'Yaşlanma, bakım ve günlük yaşamla ilgili sorularda destek.'
		}
	},
	'legal-guardianship-advance-care': {
		de: {
			title: 'Rechtliche Betreuung und Vorsorge',
			description:
				'Orientierung zu Betreuung, Vollmacht und persönlicher Vorsorge.'
		},
		en: {
			title: 'Supported Decision-Making and Advance Planning',
			description:
				'Guidance on guardianship, powers of attorney, and advance care.'
		},
		tr: {
			title: 'Yasal temsil ve önlem danışmanlığı',
			description:
				'Vesayet, vekaletname ve kişisel önlemler konusunda yönlendirme.'
		}
	},
	'initial-return-further-migration': {
		de: {
			title: 'Aus-/Rück- und Weiterwanderung',
			description:
				'Beratung zu Migration, Rückkehr und nächsten Schritten.'
		},
		en: {
			title: 'Relocation and Return Support',
			description:
				'Counselling on migration, return, and onward movement.'
		},
		tr: {
			title: 'Göç ve geri dönüş',
			description:
				'Göç, geri dönüş ve sonraki adımlar hakkında danışmanlık.'
		}
	},
	'migration': {
		de: {
			title: 'Migration',
			description:
				'Unterstützung bei Ankommen, Integration und Orientierung.'
		},
		en: {
			title: 'Migration Support',
			description: 'Support with arrival, integration, and orientation.'
		},
		tr: {
			title: 'Göç',
			description: 'Varış, entegrasyon ve yön bulma konusunda destek.'
		}
	},
	'disability-psychological-impairment': {
		de: {
			title: 'Behinderung und psychische Beeinträchtigung',
			description:
				'Unterstuetzung bei Fragen zu Teilhabe, Alltag und Belastungen.'
		},
		en: {
			title: 'Disability and Mental Health Support',
			description:
				'Support for participation, everyday life, and psychological strain.'
		},
		tr: {
			title: 'Engellilik ve psikolojik zorlanma',
			description:
				'Katılım, günlük yaşam ve psikolojik yüklerle ilgili sorularda destek.'
		}
	},
	'hiv-aids': {
		de: {
			title: 'HIV und Aids',
			description:
				'Vertrauliche Beratung zu HIV, Aids, Gesundheit und Alltag.'
		},
		en: {
			title: 'HIV and AIDS',
			description:
				'Confidential counselling about HIV, AIDS, health, and everyday life.'
		},
		tr: {
			title: 'HIV ve AIDS',
			description:
				'HIV, AIDS, sağlık ve günlük yaşam hakkında gizli danışmanlık.'
		}
	},
	'sucht': {
		de: {
			title: 'Sucht',
			description:
				'Beratung bei Suchtfragen, Abhängigkeit und belastenden Gewohnheiten.'
		},
		en: {
			title: 'Addiction',
			description:
				'Counselling for addiction questions, dependency, and harmful habits.'
		},
		tr: {
			title: 'Bağımlılık',
			description:
				'Bağımlılık soruları, bağımlılık durumu ve zorlayıcı alışkanlıklar için danışmanlık.'
		}
	},
	'trauerberatung': {
		de: {
			title: 'Trauerberatung',
			description: 'Begleitung bei Verlust, Abschied und schwerer Trauer.'
		},
		en: {
			title: 'Bereavement Support',
			description: 'Support with loss, farewell, and grief.'
		},
		tr: {
			title: 'Yas danışmanlığı',
			description: 'Kayıp, veda ve derin yas dönemlerinde destek.'
		}
	},
	'general-social-counselling': {
		de: {
			title: 'Allgemeine Sozialberatung',
			description:
				'Hilfe bei sozialen, finanziellen und persönlichen Fragen.'
		},
		en: {
			title: 'Social Support',
			description: 'Help with social, financial, and personal questions.'
		},
		tr: {
			title: 'Genel sosyal danışmanlık',
			description: 'Sosyal, maddi ve kişisel sorularda yardım.'
		}
	},
	'debt': {
		de: {
			title: 'Schulden',
			description:
				'Beratung bei finanziellen Sorgen, Mahnungen und Überschuldung.'
		},
		en: {
			title: 'Debt',
			description:
				'Counselling for financial worries, reminders, and over-indebtedness.'
		},
		tr: {
			title: 'Borç',
			description:
				'Maddi kaygılar, ihtarlar ve aşırı borçlanma konusunda danışmanlık.'
		}
	},
	'offending': {
		de: {
			title: 'Straffälligkeit',
			description:
				'Begleitung bei Fragen zu Straffälligkeit, Neustart und Alltag.'
		},
		en: {
			title: 'Offender Support',
			description:
				'Support for questions around offending, restart, and daily life.'
		},
		tr: {
			title: 'Suç ve yeniden başlangıç',
			description:
				'Suç, yeniden başlangıç ve günlük yaşamla ilgili sorularda destek.'
		}
	}
};

const topicDisplayCopyByInternalIdentifier: Record<string, string> = {
	'parents-family': 'parents-and-family',
	'children-youth': 'children-youth-counselling',
	'child-youth-rehab': 'child-youth-rehabilitation',
	'cures-parents': 'cures-mothers-fathers',
	'pregnancy': 'pregnancy',
	'u25-suicide-prevention': 'u25-suicide-prevention',
	'men-boys': 'counselling-men-boys',
	'school-to-work': 'school-to-work-transition',
	// Topics created in the admin panel arrive without a slug, so the four
	// topics #973 still needs must be reachable by identifier alone.
	'addiction': 'sucht',
	'bereavement': 'trauerberatung',
	'migration-support': 'migration',
	'hospice-palliative': 'hospice-palliative-care-counselling',
	'life-in-old-age': 'life-in-old-age',
	'legal-guardianship': 'legal-guardianship-advance-care',
	'migration': 'initial-return-further-migration',
	'disability-psych': 'disability-psychological-impairment',
	'hiv-aids': 'hiv-aids',
	'general-social': 'general-social-counselling',
	'debt': 'debt',
	'offending': 'offending'
};

export type RegistrationCategoryId =
	| 'alter'
	| 'krisen'
	| 'gesundheit'
	| 'familie'
	| 'migration'
	| 'teilhabe';

type PresentationTopicDefinition = {
	key: string;
	icon: string;
};

type PresentationCategoryDefinition = {
	id: number;
	categoryId: RegistrationCategoryId;
	icon: string;
	topics: PresentationTopicDefinition[];
};

export type RegistrationTopicPlacement = {
	placementId: string;
	topic: TopicsDataInterface;
	icon: string;
	topicGroupId: number;
	categoryId: RegistrationPanelId;
};

/** A Caritas cluster, or `group-<id>` for a category the platform admin added. */
export type RegistrationPanelId = RegistrationCategoryId | `group-${number}`;

export type RegistrationTopicPresentationGroup = {
	id: number;
	categoryId: RegistrationPanelId;
	name: string;
	icon: string;
	topicIds: number[];
	topics: RegistrationTopicPlacement[];
};

// Cluster order and membership are owned by Deutscher Caritasverband e.V.
// (ORISO-Frontend#973); the list follows the German cluster names alphabetically.
const presentationCategoryDefinitions: PresentationCategoryDefinition[] = [
	{
		id: 10001,
		categoryId: 'alter',
		icon: category02,
		topics: [
			{ key: 'general-social-counselling', icon: generalSocial },
			{
				key: 'hospice-palliative-care-counselling',
				icon: hospicePalliative
			},
			{ key: 'life-in-old-age', icon: lifeInOldAge },
			{ key: 'trauerberatung', icon: bereavement02 }
		]
	},
	{
		id: 10002,
		categoryId: 'krisen',
		icon: category05,
		topics: [
			{ key: 'general-social-counselling', icon: generalSocial },
			{
				key: 'hospice-palliative-care-counselling',
				icon: hospicePalliative
			},
			{ key: 'debt', icon: debt },
			{ key: 'pregnancy', icon: pregnancy },
			{ key: 'offending', icon: offending },
			{ key: 'sucht', icon: addiction04 },
			{ key: 'trauerberatung', icon: bereavement02 },
			{ key: 'u25-suicide-prevention', icon: u25Prevention05 }
		]
	},
	{
		id: 10003,
		categoryId: 'gesundheit',
		icon: category04,
		topics: [
			{
				key: 'disability-psychological-impairment',
				icon: disabilityPsych
			},
			{ key: 'hiv-aids', icon: hivAids04 },
			{
				key: 'hospice-palliative-care-counselling',
				icon: hospicePalliative
			},
			{ key: 'child-youth-rehabilitation', icon: childYouthRehab04 },
			{ key: 'cures-mothers-fathers', icon: curesParents04 },
			{ key: 'life-in-old-age', icon: lifeInOldAge },
			{ key: 'sucht', icon: addiction04 },
			{ key: 'u25-suicide-prevention', icon: u25Prevention05 }
		]
	},
	{
		id: 10004,
		categoryId: 'familie',
		icon: category01,
		topics: [
			{ key: 'general-social-counselling', icon: generalSocial },
			{ key: 'parents-and-family', icon: parentsFamily },
			{
				key: 'hospice-palliative-care-counselling',
				icon: hospicePalliative
			},
			{ key: 'counselling-men-boys', icon: menBoys },
			{ key: 'children-youth-counselling', icon: childrenYouth },
			{ key: 'child-youth-rehabilitation', icon: childYouthRehab01 },
			{ key: 'cures-mothers-fathers', icon: curesParents01 },
			{ key: 'pregnancy', icon: pregnancy },
			{ key: 'sucht', icon: addiction04 },
			{ key: 'school-to-work-transition', icon: schoolToWork },
			{ key: 'trauerberatung', icon: bereavement02 },
			{ key: 'u25-suicide-prevention', icon: u25Prevention01 }
		]
	},
	{
		id: 10005,
		categoryId: 'migration',
		icon: category03,
		topics: [
			{
				key: 'initial-return-further-migration',
				icon: initialReturnMigration03
			},
			{ key: 'migration', icon: migration03 }
		]
	},
	{
		id: 10006,
		categoryId: 'teilhabe',
		// TODO(#973): reuses the health cluster icon until design delivers a
		// dedicated asset for the disability-inclusion cluster.
		icon: category04,
		topics: [
			{
				key: 'disability-psychological-impairment',
				icon: disabilityPsych
			},
			{ key: 'child-youth-rehabilitation', icon: childYouthRehab04 },
			{
				key: 'legal-guardianship-advance-care',
				icon: legalGuardianship02
			}
		]
	}
];

const categoryCopyById: Record<
	RegistrationCategoryId,
	{ de: string; en: string; tr: string }
> = {
	alter: {
		de: 'Alter',
		en: 'Ageing, Older Adults',
		tr: 'Yaşlılık ve yaşlı yetişkinler'
	},
	krisen: {
		de: 'Besondere Lebenssituationen & Krisen',
		en: 'Challenging Life Situations & Crises',
		tr: 'Zorlu yaşam durumları ve krizler'
	},
	gesundheit: {
		de: 'Gesundheit & Sucht',
		en: 'Health and Addiction',
		tr: 'Sağlık ve bağımlılık'
	},
	familie: {
		de: 'Kinder, Jugend, Erwachsene, Schwangerschaft und Familie',
		en: 'Children, Young People and Families',
		tr: 'Çocuklar, gençler ve aileler'
	},
	migration: {
		de: 'Migration',
		en: 'Migration & Integration',
		tr: 'Göç ve entegrasyon'
	},
	teilhabe: {
		de: 'Teilhabe für Menschen mit Beeinträchtigungen',
		en: 'Disability Inclusion',
		tr: 'Engelli bireylerin katılımı'
	}
};

const PINNED_COPY_LOCALES = ['de', 'en', 'tr'] as const;

type PinnedCopyLocale = (typeof PINNED_COPY_LOCALES)[number];

/**
 * The cluster/topic wording for these three languages is owned by Deutscher
 * Caritasverband e.V. (ORISO-Frontend#973) and stays pinned in code so it
 * cannot be reworded through translation tooling.
 */
const getPinnedCopyLocale = (locale?: string): PinnedCopyLocale | undefined =>
	PINNED_COPY_LOCALES.find((pinned) => locale?.startsWith(pinned));

/**
 * Every other language resolves through i18n instead of silently rendering the
 * English copy, which left e.g. a Russian advice seeker with a Russian frame
 * around an English topic list (ORISO-Frontend#1154). Until a translation
 * exists the key resolves to German through the normal `fallbackLng` chain,
 * matching how the rest of the registration flow degrades.
 */
const translateRegistrationCopy = (key: string, locale?: string) => {
	if (!i18n.isInitialized) {
		return undefined;
	}

	const value = i18n.t(key, { lng: locale, defaultValue: '' });

	return typeof value === 'string' && value ? value : undefined;
};

export const getRegistrationCategoryName = (
	categoryId: RegistrationCategoryId,
	locale?: string
) => {
	const pinnedLocale = getPinnedCopyLocale(locale);

	if (pinnedLocale) {
		return categoryCopyById[categoryId][pinnedLocale];
	}

	return (
		translateRegistrationCopy(
			`registration.topic.category.${categoryId}`,
			locale
		) || categoryCopyById[categoryId].de
	);
};

export const getRegistrationTopicKey = (
	topic?: Pick<TopicsDataInterface, 'slug' | 'internalIdentifier'>
) =>
	topic?.slug ||
	topicDisplayCopyByInternalIdentifier[topic?.internalIdentifier || ''];

const SHIPPED_ICON_PATH = '/service/topic/public/icons/';

type TopicIconSource = Pick<
	TopicsDataInterface,
	'slug' | 'internalIdentifier'
> &
	Partial<Pick<TopicsDataInterface, 'icon'>>;

const isShippedIcon = (icon: string) => icon.startsWith(SHIPPED_ICON_PATH);

/** A shipped icon is served by the ConsultingTypeService, wherever that runs. */
const resolveShippedIcon = (icon: string) =>
	getConsultingTypeServiceOrigin() + icon;

/**
 * A picture the platform admin uploaded wins. A shipped Caritas icon keeps the
 * bundled picture (which has per-category variants); only a topic the frontend
 * does not know loads its shipped icon from the topic service.
 */
const ownTopicIcon = (topic?: TopicIconSource) =>
	topic?.icon && !isShippedIcon(topic.icon) ? topic.icon : undefined;

export const getRegistrationTopicIcon = (topic?: TopicIconSource) =>
	ownTopicIcon(topic) ||
	topicIconBySlug[topic?.slug || ''] ||
	topicIconByInternalIdentifier[topic?.internalIdentifier || ''] ||
	(topic?.icon ? resolveShippedIcon(topic.icon) : undefined) ||
	category01;

/**
 * A topic with an `icon` comes from the catalogue the ConsultingTypeService ships
 * (Caritas defaults in every language, overridable by the platform admin); it
 * already arrives in the visitor's language (`lang` cookie).
 */
const isCatalogueTopic = (topic?: Pick<TopicsDataInterface, 'icon'>) =>
	!!topic?.icon;

export const getRegistrationTopicDisplay = (
	topic?: Pick<
		TopicsDataInterface,
		'slug' | 'internalIdentifier' | 'titles' | 'name' | 'description'
	> &
		Partial<Pick<TopicsDataInterface, 'icon'>>,
	locale?: string
) => {
	if (isCatalogueTopic(topic) && topic?.name) {
		return {
			title: topic.name,
			description: topic.description || ''
		};
	}

	const key = getRegistrationTopicKey(topic);
	const pinnedLocale = getPinnedCopyLocale(locale);
	const pinned = topicDisplayCopyByKey[key || ''];
	const copy = pinnedLocale
		? pinned?.[pinnedLocale]
		: {
				title:
					translateRegistrationCopy(
						`registration.topic.catalog.${key}.title`,
						locale
					) || pinned?.de.title,
				description:
					translateRegistrationCopy(
						`registration.topic.catalog.${key}.description`,
						locale
					) || pinned?.de.description
			};

	return {
		title: copy?.title || topic?.titles?.long || topic?.name || '',
		description: copy?.description || topic?.description || ''
	};
};

/**
 * The Caritas cluster a saved category stands for: the one sharing the most topics,
 * at least half of the cluster's own.
 */
const matchCategoryDefinition = (
	topicKeys: string[],
	taken: Set<RegistrationCategoryId>
) => {
	let best: PresentationCategoryDefinition | undefined;
	let bestOverlap = 0;
	presentationCategoryDefinitions.forEach((definition) => {
		if (taken.has(definition.categoryId)) return;
		const overlap = definition.topics.filter(({ key }) =>
			topicKeys.includes(key)
		).length;
		if (overlap > bestOverlap && overlap * 2 >= definition.topics.length) {
			best = definition;
			bestOverlap = overlap;
		}
	});
	return best;
};

/** The category pictures the topic service ships that the frontend also bundles. */
const bundledCategoryIconByShippedFile: Record<string, string> = {
	'cat-01.png': category01,
	'cat-02.png': category02,
	'cat-03.png': category03,
	'cat-04.png': category04,
	'cat-05.png': category05
};

/** The picture the platform admin chose; bundled when the frontend has it, else from the topic service. */
const resolveGroupIcon = (icon: string) => {
	if (!isShippedIcon(icon)) return icon;
	return (
		bundledCategoryIconByShippedFile[
			icon.slice(SHIPPED_ICON_PATH.length)
		] || resolveShippedIcon(icon)
	);
};

/**
 * The categories the topic service ships (Caritas defaults, overridable by the
 * platform admin): order, membership, names and pictures come from there. A
 * category that matches a Caritas cluster keeps the bundled per-cluster pictures.
 */
const buildCatalogueGroups = (
	topics: TopicsDataInterface[],
	apiGroups: TopicGroup[]
): RegistrationTopicPresentationGroup[] => {
	const topicById = new Map(topics.map((topic) => [topic.id, topic]));
	const taken = new Set<RegistrationCategoryId>();

	return apiGroups
		.map((group) => {
			const groupTopics = group.topicIds.flatMap((id) => {
				const topic = topicById.get(id);
				return topic ? [topic] : [];
			});
			const definition = matchCategoryDefinition(
				groupTopics.map(
					(topic) => getRegistrationTopicKey(topic) || ''
				),
				taken
			);
			if (definition) taken.add(definition.categoryId);
			const categoryId: RegistrationPanelId =
				definition?.categoryId ?? `group-${group.id}`;

			const placements = groupTopics.map((topic) => {
				const key = getRegistrationTopicKey(topic);
				const bundled = definition?.topics.find(
					(placement) => placement.key === key
				)?.icon;
				return {
					placementId: `${categoryId}/${key || topic.id}`,
					topic,
					icon:
						ownTopicIcon(topic) ||
						bundled ||
						getRegistrationTopicIcon(topic),
					topicGroupId: group.id,
					categoryId
				};
			});

			return {
				id: group.id,
				categoryId,
				name: group.name,
				icon: group.icon
					? resolveGroupIcon(group.icon)
					: definition?.icon || category01,
				topicIds: placements.map(({ topic }) => topic.id),
				topics: placements
			};
		})
		.filter(({ topics }) => topics.length > 0);
};

export const buildRegistrationTopicPresentationGroups = (
	topics: TopicsDataInterface[],
	locale?: string,
	apiGroups?: TopicGroup[]
): RegistrationTopicPresentationGroup[] => {
	// Only a topic service that ships the catalogue sends category pictures.
	if (apiGroups?.some((group) => !!group.icon)) {
		return buildCatalogueGroups(topics, apiGroups);
	}

	const topicByKey = new Map<string, TopicsDataInterface>();

	topics.forEach((topic) => {
		const key = getRegistrationTopicKey(topic);
		if (key) {
			topicByKey.set(key, topic);
		}
	});

	return presentationCategoryDefinitions
		.map((category) => {
			const placements = category.topics.flatMap((placement) => {
				const topic = topicByKey.get(placement.key);

				if (!topic) {
					return [];
				}

				return [
					{
						placementId: `${category.categoryId}/${placement.key}`,
						topic,
						icon: ownTopicIcon(topic) || placement.icon,
						topicGroupId: category.id,
						categoryId: category.categoryId
					}
				];
			});

			return {
				id: category.id,
				categoryId: category.categoryId,
				name: getRegistrationCategoryName(category.categoryId, locale),
				icon: category.icon,
				topicIds: placements.map(({ topic }) => topic.id),
				topics: placements
			};
		})
		.filter(({ topics }) => topics.length > 0);
};

export const getRegistrationTopicIconForGroup = (
	topic?: TopicIconSource,
	topicGroupId?: number
) => {
	const own = ownTopicIcon(topic);
	if (own) {
		return own;
	}
	const key = getRegistrationTopicKey(topic);
	const category = presentationCategoryDefinitions.find(
		({ id }) => id === topicGroupId
	);
	const placement = category?.topics.find((topic) => topic.key === key);

	return placement?.icon || getRegistrationTopicIcon(topic);
};

export const getRegistrationCategoryIcon = (indexOrGroupId: number) => {
	const category = presentationCategoryDefinitions.find(
		({ id }) => id === indexOrGroupId
	);

	return (
		category?.icon || categoryIcons[indexOrGroupId % categoryIcons.length]
	);
};
