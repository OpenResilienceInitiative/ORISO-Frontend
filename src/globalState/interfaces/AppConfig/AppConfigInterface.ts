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
	registration: {
		useConsultingTypeSlug?: boolean;
		/**
		 * Consulting type id used for the public agency search during
		 * registration when the user has not selected a consulting type
		 * (FE#245). The backend requires the parameter, so it cannot be
		 * omitted. Defaults to 1 (the historic hard-coded value) so
		 * existing tenants keep their behavior; deployments whose agencies
		 * use another modality can override it here.
		 */
		defaultConsultingTypeId?: number;
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
