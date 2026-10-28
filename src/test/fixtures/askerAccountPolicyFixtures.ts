import type {
	TenantDataInterface,
	TenantDataSettingsInterface
} from '../../globalState/interfaces/TenantDataInterface';
import type { UserDataInterface } from '../../globalState/interfaces/UserDataInterface';

export const accountPolicyTenant = (
	settings: Partial<TenantDataSettingsInterface> = {}
): TenantDataInterface => ({
	id: 1,
	name: 'Policy test',
	theming: {
		logo: '',
		associationLogo: null,
		favicon: '',
		primaryColor: '#ff0000',
		secondaryColor: '#ffffff'
	},
	content: {
		impressum: '',
		privacy: '',
		termsAndConditions: '',
		claim: '',
		dataPrivacyConfirmation: '',
		termsAndConditionsConfirmation: ''
	},
	settings: {
		activeLanguages: ['de'],
		featureAppointmentsEnabled: false,
		featureDemographicsEnabled: false,
		featureGroupChatV2Enabled: false,
		featureStatisticsEnabled: false,
		featureToolsEnabled: false,
		featureToolsOICDToken: '',
		featureTopicsEnabled: true,
		topicsInRegistrationEnabled: true,
		...settings
	}
});

export const accountPolicyUser = (
	overrides: Partial<UserDataInterface> = {}
): UserDataInterface => ({
	userId: 'policy-asker',
	userName: 'immutable-login',
	userRoles: ['ASKER'],
	grantedAuthorities: ['AUTHORIZATION_USER_DEFAULT'],
	agencies: [],
	e2eEncryptionEnabled: false,
	emailToggles: [],
	formalLanguage: true,
	hasArchive: false,
	isDisplayNameEditable: false,
	preferredLanguage: 'de',
	termsAndConditionsConfirmation: '',
	dataPrivacyConfirmation: '',
	...overrides
});
