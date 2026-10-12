import {
	AUTH_SESSION_CHANGE_EVENT,
	getValueFromCookie
} from '../components/sessionCookie/accessSessionCookie';
import { parseJwt } from './parseJWT';

/**
 * The tenant the *signed-in* user belongs to, taken from the access token.
 *
 * Under single-domain multitenancy the host says nothing about the tenant: every
 * Träger is served from the same domain, so the subdomain only ever resolves to
 * the main tenant. The token is the one place that names the user's own tenant,
 * and the backend gates features against exactly that (a counsellor of tenant 14
 * was offered the Gesprächskreis of tenant 1 and got a bare 403 on create).
 *
 * `null` means "no session": an anonymous visitor, or a token without the claim.
 */
export const getAuthenticatedTenantId = (): number | null => {
	const accessToken = getValueFromCookie('keycloak');
	if (!accessToken) {
		return null;
	}

	const claim = parseJwt(accessToken)?.tenantId;
	// Keycloak serialises the claim as a number on some realms and as a string
	// on others; both mean the same tenant.
	const tenantId =
		typeof claim === 'number'
			? claim
			: typeof claim === 'string' && claim.trim() !== ''
				? Number(claim)
				: Number.NaN;

	return Number.isFinite(tenantId) && tenantId > 0 ? tenantId : null;
};

/**
 * Notifies when the auth session changes, so tenant-derived state can be
 * re-resolved. Signing in does not remount the providers above the router —
 * without this the app keeps the tenant it resolved on the login screen.
 */
export const subscribeToAuthenticatedTenant = (listener: () => void) => {
	window.addEventListener(AUTH_SESSION_CHANGE_EVENT, listener);
	return () =>
		window.removeEventListener(AUTH_SESSION_CHANGE_EVENT, listener);
};
