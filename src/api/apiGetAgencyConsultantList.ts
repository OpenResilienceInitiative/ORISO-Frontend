import { endpoints } from '../resources/scripts/endpoints';
import { fetchData, FETCH_ERRORS, FETCH_METHODS } from './fetchData';

export interface Consultant {
	consultantId: string;
	firstName: string;
	lastName: string;
	displayName: string;
	username: string;
	isSupervisor?: boolean;
}

/**
 * Throwing variant (#993). `/users/consultants` requires the
 * VIEW_AGENCY_CONSULTANTS authority, which not every consultant role carries
 * — a group-chat consultant, for instance, does not. Callers that need to
 * tell "this agency has no other consultants" apart from "the request was
 * rejected" must use this one; the swallowing variant below cannot.
 */
export const fetchAgencyConsultantList = async (
	agencyId: string
): Promise<Consultant[]> => {
	const url = endpoints.agencyConsultants + '?agencyId=' + agencyId;

	return await fetchData({
		url: url,
		method: FETCH_METHODS.GET,
		responseHandling: [FETCH_ERRORS.CATCH_ALL]
	});
};

export const apiGetAgencyConsultantList = async (
	agencyId: string
): Promise<Consultant[]> => {
	try {
		return await fetchAgencyConsultantList(agencyId);
	} catch {
		return [];
	}
};

/**
 * The Träger's other active consultants, for the co-moderator and Interna
 * pickers. UserService answers 204 when there are none, which `fetchData`
 * resolves as `{}` — normalised to `[]` here so "nobody to pick" is an empty
 * list and not a crash in the caller's `reduce` that then reads as a failed
 * load (#1499).
 */
export const apiGetTenantConsultantList = async (): Promise<Consultant[]> => {
	try {
		const consultants = await fetchData({
			url: `${endpoints.chatSeriesBase}consultants`,
			method: FETCH_METHODS.GET,
			responseHandling: [FETCH_ERRORS.CATCH_ALL]
		});
		return Array.isArray(consultants) ? consultants : [];
	} catch {
		return [];
	}
};
