import { UserDataInterface } from '../globalState/interfaces/UserDataInterface';
import { AUTHORITIES } from '../globalState/helpers/stateHelpers';
import { decodeKeycloakPreferredUsername } from './anonymousSessionFetchGuard';
import { getValueFromCookie } from '../components/sessionCookie/accessSessionCookie';
import { parseJwt } from './parseJWT';

export { isAnonymousSession } from './anonymousSessionFetchGuard';

const getKeycloakPayload = () => {
	const token = getValueFromCookie('keycloak');
	if (!token) return null;
	return parseJwt(token);
};

export const isKeycloakConsultantSession = (): boolean => {
	const payload = getKeycloakPayload();
	const roles = payload?.realm_access?.roles;
	return Array.isArray(roles) && roles.includes('consultant');
};

/**
 * Build a minimal UserDataInterface stub from the JWT so the React
 * component tree renders without crashing. Anonymous invite users
 * never hit GET /service/users/data.
 */
export const buildAnonymousUserData = (): UserDataInterface => {
	const payload = getKeycloakPayload();
	const rawUsername = payload?.preferred_username ?? 'Anonymous';
	const decoded = decodeKeycloakPreferredUsername(String(rawUsername));
	const username = decoded.startsWith('Anonymous-')
		? decoded
		: String(rawUsername);
	const userId = payload?.sub ?? '';

	return {
		userId,
		userName: username,
		agencies: [],
		consultingTypes: {},
		e2eEncryptionEnabled: false,
		emailToggles: [],
		formalLanguage: true,
		grantedAuthorities: [AUTHORITIES.ASKER_DEFAULT] as [string],
		hasArchive: false,
		isDisplayNameEditable: false,
		preferredLanguage: 'de',
		userRoles: ['user'],
		termsAndConditionsConfirmation: '',
		dataPrivacyConfirmation: ''
	};
};
