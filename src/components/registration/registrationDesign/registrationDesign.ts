import { TopicsDataInterface } from '../../../globalState/interfaces/TopicsDataInterface';

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
import hospicePalliative from '../../../resources/img/registration-md3/icons/t-02-hospiz-und-palliativberatung.png';
import lifeInOldAge from '../../../resources/img/registration-md3/icons/t-02-leben-im-alter.png';
import legalGuardianship02 from '../../../resources/img/registration-md3/icons/t-02-rechtliche-betreuung-und-vorsorge.png';
import migration from '../../../resources/img/registration-md3/icons/t-03-aus-ru-ck-und-weiterwanderung.png';
import disabilityPsych from '../../../resources/img/registration-md3/icons/t-04-behinderung-und-psychische-beeintra-chtigung.png';
import hivAids from '../../../resources/img/registration-md3/icons/t-04-hiv-und-aids.png';
import generalSocial from '../../../resources/img/registration-md3/icons/t-05-allgemeine-sozialberatung.png';
import debt from '../../../resources/img/registration-md3/icons/t-05-schulden.png';
import offending from '../../../resources/img/registration-md3/icons/t-05-straffa-lligkeit.png';

export const registrationMd3 = {
	onSurface: '#1b1b1c',
	onSurfaceVariant: '#444748',
	outline: '#74777b',
	outlineVariant: '#c4c7c8',
	surface: '#ffffff',
	surfaceContainerLow: '#f7f4f4',
	surfaceContainer: '#f1eeee',
	surfaceContainerHigh: '#ebe8e8',
	primary: '#a4262e',
	primaryDark: '#7e1d23',
	selectedLayer: 'rgba(164, 38, 46, 0.08)',
	hoverLayer: 'rgba(27, 27, 28, 0.04)'
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
	'initial-return-further-migration': migration,
	'disability-psychological-impairment': disabilityPsych,
	'hiv-aids': hivAids,
	'general-social-counselling': generalSocial,
	'debt': debt,
	'offending': offending
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
	'migration': migration,
	'disability-psych': disabilityPsych,
	'hiv-aids': hivAids,
	'general-social': generalSocial,
	'debt': debt,
	'offending': offending
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
	}
> = {
	'parents-and-family': {
		de: {
			title: 'Eltern und Familie',
			description:
				'Ob Erziehungsfragen, Konflikte oder familiäre Krisen - hier finden Sie verständnisvolle Begleitung.'
		},
		en: {
			title: 'Parents and family',
			description:
				'Support for parenting questions, conflict, and family pressure.'
		}
	},
	'children-youth-counselling': {
		de: {
			title: 'Kinder und Jugendliche',
			description:
				'Wenn der Alltag zu viel wird - hier gibt es Hilfe und ein offenes Ohr.'
		},
		en: {
			title: 'Children and young people',
			description:
				'Support and a listening ear when everyday life becomes too much.'
		}
	},
	'child-youth-rehabilitation': {
		de: {
			title: 'Kinder- und Jugend-Reha',
			description:
				'Für junge Menschen, die nach Krankheit oder Belastung neue Kraft schöpfen möchten.'
		},
		en: {
			title: 'Child and youth rehabilitation',
			description:
				'Rehabilitation guidance for children and young people.'
		}
	},
	'cures-mothers-fathers': {
		de: {
			title: 'Kuren für Mütter und Väter',
			description:
				'Kurmaßnahmen helfen erschöpften Eltern, wieder zu sich zu finden.'
		},
		en: {
			title: 'Rehabilitation cures for parents',
			description: 'Guidance on recovery programs for exhausted parents.'
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
		}
	},
	'u25-suicide-prevention': {
		de: {
			title: 'U25 Suizidprävention',
			description:
				'Anonyme Begleitung für junge Menschen in Krisen und Suizidgedanken.'
		},
		en: {
			title: 'U25 suicide prevention',
			description:
				'Anonymous support for young people in crisis or with suicidal thoughts.'
		}
	},
	'counselling-men-boys': {
		de: {
			title: 'Jungen- und Männerberatung',
			description:
				'Ein sicherer Raum für Männer und Jungen, um offen über Sorgen zu sprechen.'
		},
		en: {
			title: 'Counselling for men and boys',
			description:
				'A safe space for men and boys to talk openly about worries.'
		}
	},
	'hospice-palliative-care-counselling': {
		de: {
			title: 'Hospiz- und Palliativberatung',
			description:
				'Beratung bei schwerer Krankheit, Sterben, Abschied und Begleitung.'
		},
		en: {
			title: 'Hospice and palliative care',
			description:
				'Counselling around serious illness, dying, farewell, and care.'
		}
	},
	'life-in-old-age': {
		de: {
			title: 'Leben im Alter',
			description:
				'Unterstuetzung bei Fragen rund um Alter, Pflege und Alltag.'
		},
		en: {
			title: 'Life in old age',
			description:
				'Support for questions around ageing, care, and everyday life.'
		}
	},
	'legal-guardianship-advance-care': {
		de: {
			title: 'Rechtliche Betreuung und Vorsorge',
			description:
				'Orientierung zu Betreuung, Vollmacht und persönlicher Vorsorge.'
		},
		en: {
			title: 'Legal guardianship and advance care',
			description:
				'Guidance on guardianship, powers of attorney, and advance care.'
		}
	},
	'initial-return-further-migration': {
		de: {
			title: 'Aus-, Rück- und Weiterwanderung',
			description:
				'Beratung zu Migration, Rückkehr und nächsten Schritten.'
		},
		en: {
			title: 'Migration and return',
			description:
				'Counselling on migration, return, and onward movement.'
		}
	},
	'disability-psychological-impairment': {
		de: {
			title: 'Behinderung und psychische Beeinträchtigung',
			description:
				'Unterstuetzung bei Fragen zu Teilhabe, Alltag und Belastungen.'
		},
		en: {
			title: 'Disability and psychological impairment',
			description:
				'Support for participation, everyday life, and psychological strain.'
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
		}
	},
	'general-social-counselling': {
		de: {
			title: 'Allgemeine Sozialberatung',
			description:
				'Hilfe bei sozialen, finanziellen und persönlichen Fragen.'
		},
		en: {
			title: 'General social counselling',
			description: 'Help with social, financial, and personal questions.'
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
		}
	},
	'offending': {
		de: {
			title: 'Straffälligkeit',
			description:
				'Begleitung bei Fragen zu Straffälligkeit, Neustart und Alltag.'
		},
		en: {
			title: 'Offending',
			description:
				'Support for questions around offending, restart, and daily life.'
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

const getRegistrationTopicKey = (
	topic?: Pick<TopicsDataInterface, 'slug' | 'internalIdentifier'>
) =>
	topic?.slug ||
	topicDisplayCopyByInternalIdentifier[topic?.internalIdentifier || ''];

export const getRegistrationTopicIcon = (
	topic?: Pick<TopicsDataInterface, 'slug' | 'internalIdentifier'>
) =>
	topicIconBySlug[topic?.slug || ''] ||
	topicIconByInternalIdentifier[topic?.internalIdentifier || ''] ||
	category01;

export const getRegistrationTopicDisplay = (
	topic?: Pick<
		TopicsDataInterface,
		'slug' | 'internalIdentifier' | 'titles' | 'name' | 'description'
	>,
	locale?: string
) => {
	const key = getRegistrationTopicKey(topic);
	const copy =
		topicDisplayCopyByKey[key || '']?.[
			locale?.startsWith('de') ? 'de' : 'en'
		];

	return {
		title: copy?.title || topic?.titles?.long || topic?.name || '',
		description: copy?.description || topic?.description || ''
	};
};

export const getRegistrationCategoryIcon = (index: number) =>
	categoryIcons[index % categoryIcons.length];
