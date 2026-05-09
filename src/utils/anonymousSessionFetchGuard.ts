import { decode } from 'hi-base32';
import { getValueFromCookie } from '../components/sessionCookie/accessSessionCookie';
import { parseJwt } from './parseJWT';

/**
 * Decode Keycloak `preferred_username` same as `decodeUsername` in
 * encryptionHelpers, without importing that module (avoids circular imports).
 */
export const decodeKeycloakPreferredUsername = (raw: string): string => {
	if (!raw) return '';
	const parts = raw.split('.');
	if (parts[0] !== 'enc') return raw;
	try {
		return decode(parts[1].toUpperCase() + '=');
	} catch {
		return raw;
	}
};

/**
 * Invite / anonymous asker sessions: must not trigger global logout on 403
 * to profile or live endpoints. Used by fetchData and the rest of the app.
 */
export const isAnonymousSession = (): boolean => {
	try {
		if (sessionStorage.getItem('isAnonymousInvite') === '1') return true;
	} catch {
		/* private mode / blocked */
	}

	const token = getValueFromCookie('keycloak');
	if (!token) return false;

	const raw = String(parseJwt(token)?.preferred_username ?? '');
	if (raw.startsWith('Anonymous-')) return true;

	return decodeKeycloakPreferredUsername(raw).startsWith('Anonymous-');
};

const ANONYMOUS_RESTRICTED_PATH =
	/\/service\/users\/data|\/service\/users\/drafts|\/service\/live/;

/** True → caller should reject without redirectToErrorPage / logout */
export const shouldRejectSilentlyForAnonymousRestrictedUrl = (
	url: string,
	status: number
): boolean =>
	(status === 403 || status === 404) &&
	ANONYMOUS_RESTRICTED_PATH.test(url) &&
	isAnonymousSession();
