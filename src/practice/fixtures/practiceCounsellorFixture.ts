import type { UserDataInterface } from '../../globalState/interfaces';

/**
 * Stand-in for the real logged-in counsellor in tests and stories. In the app
 * the sandbox receives the real `userData`; no practice code invents one.
 */
export const practiceCounsellorFixture = (
	overrides: Partial<UserDataInterface> = {}
): UserDataInterface =>
	({
		userId: 'counsellor-under-test',
		userName: 'beraterin',
		firstName: 'Bea',
		lastName: 'Beraterin',
		displayName: 'Bea Beraterin',
		grantedAuthorities: ['AUTHORIZATION_CONSULTANT_DEFAULT'],
		userRoles: ['CONSULTANT'],
		agencies: [
			{
				id: 4711,
				name: 'Echte Beratungsstelle',
				consultingType: 0,
				city: '',
				description: '',
				offline: false,
				postcode: ''
			}
		],
		e2eEncryptionEnabled: false,
		emailToggles: [],
		formalLanguage: true,
		hasArchive: false,
		isDisplayNameEditable: false,
		preferredLanguage: 'de',
		termsAndConditionsConfirmation: '',
		dataPrivacyConfirmation: '',
		...overrides
	}) as UserDataInterface;
