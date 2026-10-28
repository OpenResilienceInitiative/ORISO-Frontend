import { endpoints } from '../resources/scripts/endpoints';
import { fetchData, FETCH_ERRORS, FETCH_METHODS } from './fetchData';

/** A centre admin the counsellor can invite into an internal chat (#117). */
export interface AgencyAdminContact {
	/** Id to pass as `consultantIds` to `POST /users/chat/internal-subset`. */
	consultantId: string;
	displayName: string;
}

const isContact = (entry: unknown): entry is AgencyAdminContact =>
	typeof (entry as AgencyAdminContact)?.consultantId === 'string' &&
	(entry as AgencyAdminContact).consultantId !== '';

/**
 * `GET /users/agencies/{agencyId}/admin-contacts`: the agency admins of one of
 * the caller's own counselling centres who can be invited into a chat. An
 * empty answer (`[]`, or 204 which `fetchData` resolves as `{}`) is "nobody to
 * contact"; a failed request rejects, so the caller can tell the two apart.
 */
export const apiGetAgencyAdminContacts = async (
	agencyId: number
): Promise<AgencyAdminContact[]> => {
	const contacts = await fetchData({
		url: endpoints.agencyAdminContacts(agencyId),
		method: FETCH_METHODS.GET,
		responseHandling: [FETCH_ERRORS.CATCH_ALL]
	});
	return Array.isArray(contacts) ? contacts.filter(isContact) : [];
};
