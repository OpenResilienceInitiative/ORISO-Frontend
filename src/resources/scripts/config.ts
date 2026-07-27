import deAgency from '../i18n/de/agency.json';
import deConsultingTypes from '../i18n/de/consultingTypes.json';
import deLanguages from '../i18n/de/languages.json';
import en from '../i18n/en/common.json';
import enAgency from '../i18n/en/agency.json';
import enConsultingTypes from '../i18n/en/consultingTypes.json';
import enLanguages from '../i18n/en/languages.json';
import frCommon from '../i18n/fr/common.json';
import frLanguages from '../i18n/fr/languages.json';
import ruCommon from '../i18n/ru/common.json';
import ruLanguages from '../i18n/ru/languages.json';
import tiCommon from '../i18n/ti/common.json';
import tiLanguages from '../i18n/ti/languages.json';
import trCommon from '../i18n/tr/common.json';
import trLanguages from '../i18n/tr/languages.json';
import { AppConfigInterface } from '../../globalState/interfaces';
import {
	OVERLAY_RELEASE_NOTE,
	OVERLAY_TWO_FACTOR_NAG
} from '../../globalState/interfaces/AppConfig/OverlaysConfigInterface';

import {
	getLegalImprintUrl,
	getLegalPrivacyUrl,
	getOrganizationHomeUrl
} from './runtimeConfig';

const organizationHomeUrl = getOrganizationHomeUrl();
const legalImprintUrl = getLegalImprintUrl(organizationHomeUrl);
const legalPrivacyUrl = getLegalPrivacyUrl(organizationHomeUrl);

export const uiUrl = window.location.origin;

export const APP_PATH = 'app';

export const routePathNames = {
	root: '/',
	login: '/login',
	termsAndConditions: '/nutzungsbedingungen',
	imprint: '/impressum',
	privacy: '/datenschutz'
};

export const config: AppConfigInterface = {
	budibaseUrl: '',
	budibaseSSO: false, // Feature flag to enable SSO on budibase
	calcomUrl: '',
	calendarAppUrl: '',
	enableWalkthrough: false, // Feature flag to enable walkthrough (false by default here & true in the theme repo)
	multitenancyWithSingleDomainEnabled: false, // Feature flag to enable the multi tenancy with a single domain ex: lands
	useTenantService: true,
	useApiClusterSettings: true, // Feature flag to enable the cluster use the cluster settings instead of the config file
	mainTenantSubdomainForSingleDomainMultitenancy: 'app',
	blockConsultantAppLogin: false, // Block consultant-role app logins (PR #273). Off until an activation-state check exists — the bare role matches every counsellor.

	requestCollector: {
		limit: 10,
		showCorrelationId: {
			consultant: true,
			user: false,
			other: false
		}
	},
	urls: {
		chatScheduleUrl: uiUrl + '/registration',
		error401: uiUrl + '/error.401.html',
		error404: uiUrl + '/error.404.html',
		error500: uiUrl + '/error.500.html',
		home: organizationHomeUrl,
		landingpage: '/login',
		releases: uiUrl + '/releases',
		redirectToApp: uiUrl + '/' + APP_PATH,
		registration: uiUrl + '/registration',
		toEntry: uiUrl + '/login',
		toLogin: uiUrl + '/login',
		toRegistration: uiUrl + '/registration',
		videoCall: '/videoanruf/:roomId/:type'
	},
	groupChat: {
		info: {
			showCreator: false,
			showCreationDate: false
		}
	},
	postcodeFallbackUrl: '{url}{postcode}/',
	legalLinks: [
		{
			url: legalImprintUrl,
			label: 'login.legal.infoText.impressum'
		},
		{
			url: legalPrivacyUrl,
			label: 'login.legal.infoText.dataprotection',
			registration: true
		}
		// {
		// 	url: routePathNames.termsAndConditions,
		// 	label: 'login.legal.infoText.termsAndConditions',
		// 	registration: true
		// }
	],
	welcomeScreen: {
		consultingType: {
			hidden: false
		}
	},
	registration: {
		// FE#245: fallback consulting type for the public agency search when
		// none is selected. 1 = historic default; override per deployment
		// when agencies use a different modality.
		defaultConsultingTypeId: 1,
		consultingTypeDefaults: {
			autoSelectPostcode: false,
			autoSelectAgency: false
		}
	},
	emails: {
		notifications: [
			{
				label: 'profile.notifications.follow.up.email.label',
				types: ['NEW_CHAT_MESSAGE_FROM_ADVICE_SEEKER']
			}
		]
	},
	overlays: {
		priority: [OVERLAY_RELEASE_NOTE, OVERLAY_TWO_FACTOR_NAG]
	},
	twofactor: {
		startObligatoryHint: new Date('2022-07-31'),
		dateTwoFactorObligatory: new Date('2022-10-01'),
		messages: [
			{
				title: 'twoFactorAuth.nag.obligatory.moment.title',
				copy: 'twoFactorAuth.nag.obligatory.moment.copy',
				showClose: true
			},
			{
				title: 'twoFactorAuth.nag.obligatory.title',
				copy: 'twoFactorAuth.nag.obligatory.copy',
				showClose: false
			}
		]
	},
	spokenLanguages: [
		'de',
		'aa',
		'ab',
		'ae',
		'af',
		'ak',
		'am',
		'an',
		'ar',
		'as',
		'av',
		'ay',
		'az',
		'ba',
		'be',
		'bg',
		'bh',
		'bi',
		'bm',
		'bn',
		'bo',
		'br',
		'bs',
		'ca',
		'ce',
		'ch',
		'co',
		'cr',
		'cs',
		'cu',
		'cv',
		'cy',
		'da',
		'dv',
		'dz',
		'ee',
		'el',
		'en',
		'eo',
		'es',
		'et',
		'eu',
		'fa',
		'ff',
		'fi',
		'fj',
		'fo',
		'fr',
		'fy',
		'ga',
		'gd',
		'gl',
		'gn',
		'gu',
		'gv',
		'ha',
		'he',
		'hi',
		'ho',
		'hr',
		'ht',
		'hu',
		'hy',
		'hz',
		'ia',
		'id',
		'ie',
		'ig',
		'ii',
		'ik',
		'io',
		'is',
		'it',
		'iu',
		'ja',
		'jv',
		'ka',
		'kg',
		'ki',
		'kj',
		'kk',
		'kl',
		'km',
		'kn',
		'ko',
		'kr',
		'ks',
		'ku',
		'kv',
		'kw',
		'ky',
		'la',
		'lb',
		'lg',
		'li',
		'ln',
		'lo',
		'lt',
		'lu',
		'lv',
		'mg',
		'mh',
		'mi',
		'mk',
		'ml',
		'mn',
		'mr',
		'ms',
		'mt',
		'my',
		'na',
		'nb',
		'nd',
		'ne',
		'ng',
		'nl',
		'nn',
		'no',
		'nr',
		'nv',
		'ny',
		'oc',
		'oj',
		'om',
		'or',
		'os',
		'pa',
		'pi',
		'pl',
		'ps',
		'pt',
		'qu',
		'rm',
		'rn',
		'ro',
		'ru',
		'rw',
		'sa',
		'sc',
		'sd',
		'se',
		'sg',
		'si',
		'sk',
		'sl',
		'sm',
		'sn',
		'so',
		'sq',
		'sr',
		'ss',
		'st',
		'su',
		'sv',
		'sw',
		'ta',
		'te',
		'tg',
		'th',
		'ti',
		'tk',
		'tl',
		'tn',
		'to',
		'tr',
		'ts',
		'tt',
		'tw',
		'ty',
		'ug',
		'uk',
		'ur',
		'uz',
		've',
		'vi',
		'vo',
		'wa',
		'wo',
		'xh',
		'yi',
		'yo',
		'za',
		'zh',
		'zu'
	],
	i18n: {
		supportedLngs: ['en', 'de', 'fr', 'ru', 'ti', 'tr'],
		fallbackLng: {
			en: ['de'],
			en_informal: ['en', 'de_informal', 'de']
		},
		resources: {
			de: {
				languages: {
					...deLanguages
				},
				consultingTypes: {
					...deConsultingTypes
				},
				agencies: {
					...deAgency
				}
			},
			en: {
				common: [en],
				consultingTypes: {
					...enConsultingTypes
				},
				agencies: {
					...enAgency
				},
				languages: {
					...enLanguages
				}
			},
			fr: {
				common: [frCommon],
				consultingTypes: {
					...enConsultingTypes
				},
				agencies: {
					...enAgency
				},
				languages: {
					...frLanguages
				}
			},
			ru: {
				common: [ruCommon],
				consultingTypes: {
					...enConsultingTypes
				},
				agencies: {
					...enAgency
				},
				languages: {
					...ruLanguages
				}
			},
			ti: {
				common: [tiCommon],
				consultingTypes: {
					...enConsultingTypes
				},
				agencies: {
					...enAgency
				},
				languages: {
					...tiLanguages
				}
			},
			tr: {
				common: [trCommon],
				consultingTypes: {
					...enConsultingTypes
				},
				agencies: {
					...enAgency
				},
				languages: {
					...trLanguages
				}
			}
		}
	},
	user: {
		profile: {
			visibleOnEnquiry: (sessionUserData) =>
				Object.entries(sessionUserData).length !== 0
		}
	}
};

export const ALIAS_LAST_MESSAGES = {
	E2EE_ACTIVATED: 'aliases.lastMessage.e2ee_activated',
	FURTHER_STEPS: 'aliases.lastMessage.further_steps',
	REASSIGN_CONSULTANT: 'aliases.lastMessage.reassign_consultant',
	REASSIGN_CONSULTANT_RESET_LAST_MESSAGE:
		'aliases.lastMessage.reassign_consultant_reset_last_message',
	APPOINTMENT_SET: 'message.appointment.component.header.confirmation',
	APPOINTMENT_CANCELLED: 'message.appointment.component.header.cancellation',
	APPOINTMENT_RESCHEDULED: 'message.appointment.component.header.change'
};
