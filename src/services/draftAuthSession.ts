import {
	getValueFromCookie,
	hasAuthCookie
} from '../components/sessionCookie/accessSessionCookie';
import { parseJwt } from '../utils/parseJWT';

const readIdentity = (token: string): string | null => {
	const { iss, sub, sid, session_state } = parseJwt(token);
	const session = sid || session_state;
	return [iss, sub, session].every(
		(value) => typeof value === 'string' && value.length > 0
	)
		? JSON.stringify([iss, sub, session])
		: null;
};

/** In-memory identity of the current App login, stable across token renewal. */
export const getDraftAuthSessionIdentity = (): string | null => {
	if (typeof document === 'undefined') return null;
	const accessIdentity = readIdentity(getValueFromCookie('keycloak'));
	if (hasAuthCookie('keycloak')) return accessIdentity;

	// A large access token can legitimately fall back to the storage mirror.
	// It must match a real refresh cookie to establish an active session.
	return hasAuthCookie('refreshToken') &&
		readIdentity(getValueFromCookie('refreshToken')) === accessIdentity
		? accessIdentity
		: null;
};
