import { ConsultingTypeInterface } from './ConsultingTypeInterface';
import { TWO_FACTOR_TYPES } from '../../components/twoFactorAuth/twoFactorAuthConstants';

export interface UserDataInterface {
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
	url?: string;
	external?: boolean;
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
}

export interface AgencyDepartmentDataInterface {
	topicId: number;
	hasPublishedDpp?: boolean;
	hasPublishedImprint?: boolean;
}

export interface ConsultingTypeDataInterface {
	agency: AgencyDataInterface;
	isRegistered: boolean;
	sessionData: Object;
}

export interface TwoFactorAuthInterface {
	isEnabled: boolean;
	isActive: boolean;
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
