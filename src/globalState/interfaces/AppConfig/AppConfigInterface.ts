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
	/**
	 * #438 MSC4153 "invisible crypto": when on, Megolm keys are shared only with
	 * cross-signed devices (`OnlySignedDevicesIsolationMode`) — unverified
	 * devices receive no keys and see undecryptable noise. Hard-depends on the
	 * key-backup/recovery onboarding (#437) so legitimate users can verify.
	 */
	enableInvisibleCrypto?: boolean;
	/**
	 * Kill-switch for per-participant call media E2EE (ADR-018).
	 * Default / unset = ON: the host asks Element Call for
	 * `perParticipantE2EE`, so the LiveKit SFU only ever sees ciphertext.
	 * Set to `false` to fall back to transport-only media if MatrixRTC
	 * to-device key distribution fails in an environment (ORISO-ElementCall#35:
	 * call connects with no audio and no UI error). Call signalling and room
	 * events stay encrypted by the host regardless of this toggle.
	 */
	enableCallMediaE2EE?: boolean;
	/**
	 * #439 MSC3814 "dehydrated devices": when on, park a sleeping device
	 * server-side so Megolm keys sent during a login gap are delivered and the
	 * gap becomes readable on next login. Hard-depends on the key-backup /
	 * secret-storage setup (#437) and on the homeserver supporting MSC3814.
	 */
	enableDeviceDehydration?: boolean;
}
