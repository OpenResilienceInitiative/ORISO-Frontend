import type { UserDataInterface } from '../../globalState/interfaces/UserDataInterface';

// The same Keycloak grants as AUTHORITIES in stateHelpers. Kept local so this
// URL parser does not pull the authenticated app's components into the login page.
const CONSULTANT = 'AUTHORIZATION_CONSULTANT_DEFAULT';
const ASKER = 'AUTHORIZATION_USER_DEFAULT';

/** A group appointment link carries an ID, never an arbitrary redirect URL. */
export const groupAppointmentRedirect = (
	seriesId: string | null | undefined,
	userData: UserDataInterface
): { sessionId: number } | { restorePath: string } | null => {
	if (!seriesId || !/^[1-9]\d*$/.test(seriesId)) {
		return null;
	}
	const id = Number(seriesId);
	if (!Number.isSafeInteger(id)) {
		return null;
	}
	if (userData?.grantedAuthorities?.includes(CONSULTANT)) {
		return {
			restorePath: `/sessions/consultant/sessionView/session/${id}`
		};
	}
	if (userData?.grantedAuthorities?.includes(ASKER)) {
		return { sessionId: id };
	}
	return null;
};
