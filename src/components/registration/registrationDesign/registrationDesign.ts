import { TopicsDataInterface } from '../../../globalState/interfaces/TopicsDataInterface';
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
import hivAids05 from '../../../resources/img/registration-md3/icons/t-05-hiv-und-aids.png';
import legalGuardianship05 from '../../../resources/img/registration-md3/icons/t-05-rechtliche-betreuung-und-vorsorge.png';
import u25Prevention05 from '../../../resources/img/registration-md3/icons/t-05-u25-suizidpra-vention.png';

export const registrationMd3 = {
	...orisoInputColors,
	heroGradient:
		'linear-gradient(152deg, #DA2530 0%, #C0121F 46%, #7C0D15 100%)'
} as const;

export const registrationMd3TextFieldSx = orisoTextFieldSx;

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
	'migration': initialReturnMigration03,
	'disability-psych': disabilityPsych,
	'hiv-aids': hivAids04,
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
			title: 'Parents and family',
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
			title: 'Children and young people',
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
			title: 'Child and youth rehabilitation',
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
			title: 'Rehabilitation cures for parents',
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
			title: 'U25 Suizidprävention',
			description:
				'Anonyme Begleitung für junge Menschen in Krisen und Suizidgedanken.'
		},
		en: {
			title: 'U25 suicide prevention',
			description:
				'Anonymous support for young people in crisis or with suicidal thoughts.'
		},
		tr: {
			title: 'U25 intiharı önleme',
			description:
				'Kriz yaşayan veya intihar düşünceleri olan gençler için anonim destek.'
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
			title: 'Hospice and palliative care',
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
			title: 'Life in old age',
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
			title: 'Legal guardianship and advance care',
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
			title: 'Aus-, Rück- und Weiterwanderung',
			description:
				'Beratung zu Migration, Rückkehr und nächsten Schritten.'
		},
		en: {
			title: 'Migration and return',
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
			title: 'Migration',
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
			title: 'Disability and psychological impairment',
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
			title: 'Bereavement counselling',
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
			title: 'General social counselling',
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
			title: 'Offending',
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
	| 'familie'
	| 'alter'
	| 'soziales'
	| 'gesundheit'
	| 'migration';

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
	categoryId: RegistrationCategoryId;
};

export type RegistrationTopicPresentationGroup = {
	id: number;
	categoryId: RegistrationCategoryId;
	name: string;
	icon: string;
	topicIds: number[];
	topics: RegistrationTopicPlacement[];
};

const presentationCategoryDefinitions: PresentationCategoryDefinition[] = [
	{
		id: 10001,
		categoryId: 'familie',
		icon: category01,
		topics: [
			{ key: 'parents-and-family', icon: parentsFamily },
			{ key: 'children-youth-counselling', icon: childrenYouth },
			{ key: 'child-youth-rehabilitation', icon: childYouthRehab01 },
			{ key: 'cures-mothers-fathers', icon: curesParents01 },
			{ key: 'counselling-men-boys', icon: menBoys },
			{ key: 'pregnancy', icon: pregnancy },
			{ key: 'u25-suicide-prevention', icon: u25Prevention01 }
		]
	},
	{
		id: 10002,
		categoryId: 'alter',
		icon: category02,
		topics: [
			{ key: 'life-in-old-age', icon: lifeInOldAge },
			{
				key: 'legal-guardianship-advance-care',
				icon: legalGuardianship02
			},
			{
				key: 'hospice-palliative-care-counselling',
				icon: hospicePalliative
			},
			{ key: 'trauerberatung', icon: bereavement02 }
		]
	},
	{
		id: 10003,
		categoryId: 'soziales',
		icon: category05,
		topics: [
			{ key: 'general-social-counselling', icon: generalSocial },
			{ key: 'debt', icon: debt },
			{ key: 'offending', icon: offending },
			{ key: 'u25-suicide-prevention', icon: u25Prevention05 },
			{
				key: 'legal-guardianship-advance-care',
				icon: legalGuardianship05
			},
			{ key: 'hiv-aids', icon: hivAids05 }
		]
	},
	{
		id: 10004,
		categoryId: 'gesundheit',
		icon: category04,
		topics: [
			{
				key: 'disability-psychological-impairment',
				icon: disabilityPsych
			},
			{ key: 'sucht', icon: addiction04 },
			{ key: 'hiv-aids', icon: hivAids04 },
			{ key: 'child-youth-rehabilitation', icon: childYouthRehab04 },
			{ key: 'cures-mothers-fathers', icon: curesParents04 }
		]
	},
	{
		id: 10005,
		categoryId: 'migration',
		icon: category03,
		topics: [
			{ key: 'migration', icon: migration03 },
			{
				key: 'initial-return-further-migration',
				icon: initialReturnMigration03
			}
		]
	}
];

const categoryCopyById: Record<
	RegistrationCategoryId,
	{ de: string; en: string; tr: string }
> = {
	familie: {
		de: 'Familie, Kinder & Jugend',
		en: 'Family, children & youth',
		tr: 'Aile, çocuklar ve gençler'
	},
	alter: {
		de: 'Alter, Pflege & Abschied',
		en: 'Ageing, care & farewell',
		tr: 'Yaşlılık, bakım ve veda'
	},
	soziales: {
		de: 'Soziale Notlagen, Krisen & Finanzen',
		en: 'Social hardship, crises & finances',
		tr: 'Sosyal zorluklar, krizler ve finans'
	},
	gesundheit: {
		de: 'Gesundheit, Behinderung & Sucht',
		en: 'Health, disability & addiction',
		tr: 'Sağlık, engellilik ve bağımlılık'
	},
	migration: {
		de: 'Migration & Integration',
		en: 'Migration & integration',
		tr: 'Göç ve entegrasyon'
	}
};

const getRegistrationCopyLocale = (locale?: string): 'de' | 'en' | 'tr' => {
	if (locale?.startsWith('de')) {
		return 'de';
	}

	if (locale?.startsWith('tr')) {
		return 'tr';
	}

	return 'en';
};

export const getRegistrationCategoryName = (
	categoryId: RegistrationCategoryId,
	locale?: string
) => categoryCopyById[categoryId][getRegistrationCopyLocale(locale)];

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
	const copyLocale = getRegistrationCopyLocale(locale);
	const copy = topicDisplayCopyByKey[key || '']?.[copyLocale];

	return {
		title: copy?.title || topic?.titles?.long || topic?.name || '',
		description: copy?.description || topic?.description || ''
	};
};

export const buildRegistrationTopicPresentationGroups = (
	topics: TopicsDataInterface[],
	locale?: string
): RegistrationTopicPresentationGroup[] => {
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
						icon: placement.icon,
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
	topic?: Pick<TopicsDataInterface, 'slug' | 'internalIdentifier'>,
	topicGroupId?: number
) => {
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
