import { AppConfigJitsiInterface } from './AppConfigJitsiInterface';
import { AppConfigNotificationsInterface } from './AppConfigNotificationsInterface';
import { AppConfigTwoFactorInterface } from './AppConfigTwoFactorInterface';
import { AppConfigUrlsInterface } from './AppConfigUrlsInterface';
import { AppSettingsInterface } from './AppSettingsInterface';
import { LegalLinkInterface } from '../LegalLinkInterface';
import { InitOptions } from 'i18next';
import { OverlaysConfigInterface } from './OverlaysConfigInterface';
import { TranslationConfig } from '../TranslationConfig';
import { GroupChatConfig } from '../GroupChatConfig';
import { SessionUserDataInterface } from '../SessionsDataInterface';

export interface AppConfigInterface extends AppSettingsInterface {
	urls: AppConfigUrlsInterface;
	legalLinks: LegalLinkInterface[];
	postcodeFallbackUrl: string;
	spokenLanguages: string[];
	jitsi: AppConfigJitsiInterface;
	emails: AppConfigNotificationsInterface;
	twofactor: AppConfigTwoFactorInterface;
	i18n: InitOptions;
	overlays?: OverlaysConfigInterface;
	releaseToggles?: ReleaseToggles;
	translation?: TranslationConfig;
	requestCollector?: {
		limit?: number;
		showCorrelationId?: {
			consultant?: boolean;
			user?: boolean;
			other?: boolean;
		};
	};
	groupChat?: GroupChatConfig;
	/**
	 * Blocks accounts with the `consultant` realm role from the app login.
	 * Default off: the block (PR #273) keys on the role every counsellor
	 * carries and locks the whole professional side out of the platform.
	 * Re-enable only together with an activation-state check.
	 */
	blockConsultantAppLogin?: boolean;
	registration: {
		useConsultingTypeSlug?: boolean;
		consultingTypeDefaults: {
			autoSelectPostcode: boolean;
			autoSelectAgency: boolean;
		};
	};
	user?: {
		profile?: {
			visibleOnEnquiry:
				| boolean
				| ((sessionUserData: SessionUserDataInterface) => boolean);
		};
	};
	welcomeScreen: {
		consultingType: {
			hidden: boolean;
		};
	};
}

interface ReleaseToggles {
	enableNewNotifications?: boolean;
	featureVideoGroupChatsEnabled?: boolean;
	enableMagicLinksLogin?: boolean;
}
