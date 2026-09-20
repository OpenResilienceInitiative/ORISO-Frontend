import { ConsultingTypeInterface } from './ConsultingTypeInterface';
import { TWO_FACTOR_TYPES } from '../../components/twoFactorAuth/twoFactorAuthConstants';

export interface UserDataInterface {
	chatRecoveryMode?: 'RECOVERY_KEY' | 'LOGIN_PASSWORD' | null;
	chatRecoveryPolicyRevision?: number | null;
	absenceMessage?: string;
	absent?: boolean;
	agencies: AgencyDataInterface[];
	appointmentFeatureEnabled?: boolean;
	available?: boolean;
	consultingTypes?: { [consultingType: number]: ConsultingTypeDataInterface };
	displayName?: string;
	e2eEncryptionEnabled: boolean;
	email?: string;
	magicLinkLoginEnabled?: boolean;
	emailToggles: { name: string; state: boolean }[];
	firstName?: string;
	formalLanguage: boolean;
	grantedAuthorities: [string];
	hasArchive: boolean;
	isDisplayNameEditable: boolean;
	isWalkThroughEnabled?: boolean;
	languages?: string[];
	lastName?: string;
	publicSlug?: string;
	pendingPublicSlug?: string;
	publicSlugStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
	preferredLanguage: string;
	twoFactorAuth?: TwoFactorAuthInterface;
	/**
	 * The account still carries the password its administrator chose. Optional: backends
	 * predating the flag never send it.
	 */
	passwordChangeRequired?: boolean;
	userId: string;
	userName: string;
	userRoles: string[];
	termsAndConditionsConfirmation: string;
	dataPrivacyConfirmation: string;
	emailNotifications?: EmailNotificationsInterface;
}

export interface ConsultantDataInterface
	extends Omit<UserDataInterface, 'userId'> {
	consultantId: string;
	agencies: AgencyDataInterface[];
}

export interface AgencyDataInterface {
	city: string;
	consultingType: number;
	description: string;
	id: number;
	name: string;
	offline: boolean;
	postcode: string;
	street?: string;
	houseNumber?: string;
	lat?: number | null;
	lng?: number | null;
	phone?: string;
	openingHours?: string;
	url?: string;
	external?: boolean;
	/**
	 * When true, the whole counselling team can see the request;
	 * when false/undefined the centre is treated as single-counsellor.
	 */
	teamAgency?: boolean;
	tenantId?: number;
	agencySpecificPrivacy?: string;
	consultingTypeRel?: ConsultingTypeInterface;
	topicIds?: number[];
	agencyLogo?: string | null;
	/**
	 * The agency's departments (one per assigned topic) with the publication
	 * state of their own legal texts. Only present on backends with
	 * AgencyService #90 - older backends simply never send it.
	 */
	departments?: AgencyDepartmentDataInterface[];
	/**
	 * The agency's feature settings from the public agency response. The
	 * group-chat flags are the effective values (Träger AND Beratungsstelle
	 * combined, AgencyService #293); `null` means no restriction from this
	 * agency. Older backends omit them.
	 */
	settings?: AgencySettingsInterface | null;
}

export interface AgencySettingsInterface {
	featureGroupChatV2Enabled?: boolean | null;
	featureInternalGroupChatEnabled?: boolean | null;
	featureSelfHelpGroupsEnabled?: boolean | null;
}

export interface AgencyDepartmentDataInterface {
	topicId: number;
	hasPublishedDpp?: boolean;
	hasPublishedImprint?: boolean;
	/**
	 * Per-department contact overrides (AgencyService #242). Optional -
	 * older backends simply never send them.
	 */
	openingHours?: string;
	phoneExtension?: string;
	floorLocation?: string;
}

export interface ConsultingTypeDataInterface {
	agency: AgencyDataInterface;
	isRegistered: boolean;
	sessionData: Object;
}

export interface TwoFactorAuthInterface {
	isEnabled: boolean;
	isActive: boolean;
	/**
	 * The account may not be used until a factor is active. Optional: backends predating the
	 * flag never send it.
	 */
	isRequired?: boolean;
	secret: string;
	qrCode: string;
	isShown: boolean;
	type?: (typeof TWO_FACTOR_TYPES)[keyof typeof TWO_FACTOR_TYPES];
}

export interface AgencyLanguagesInterface {
	languages: string[];
}

export interface EmailNotificationsInterface {
	emailNotificationsEnabled?: boolean;
	settings?: EmailNotificationsSettingsInterface;
}

export interface EmailNotificationsSettingsInterface {
	initialEnquiryNotificationEnabled?: boolean;
	newChatMessageNotificationEnabled?: boolean;
	reassignmentNotificationEnabled?: boolean;
	appointmentNotificationEnabled?: boolean;
}
