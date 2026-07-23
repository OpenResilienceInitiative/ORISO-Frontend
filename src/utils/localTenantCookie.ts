import {
	deleteCookieByName,
	setValueInCookie
} from '../components/sessionCookie/accessSessionCookie';
import { getLocalTenantId } from '../resources/scripts/runtimeConfig';

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export const syncLocalTenantCookie = (hostname?: string) => {
	const resolvedHostname =
		hostname ??
		(typeof window !== 'undefined' ? window.location.hostname : '');

	if (!LOCAL_HOSTNAMES.has(resolvedHostname)) {
		return;
	}

	deleteCookieByName('tenantId');

	const localTenantId = getLocalTenantId();
	if (localTenantId) {
		setValueInCookie('tenantId', localTenantId);
	}
};
