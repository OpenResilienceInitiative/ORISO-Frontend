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

export const apiGetAgencyConsultantList = async (
	agencyId: string
): Promise<Consultant[]> => {
	const url = endpoints.agencyConsultants + '?agencyId=' + agencyId;

	try {
		return await fetchData({
			url: url,
			method: FETCH_METHODS.GET,
			responseHandling: [FETCH_ERRORS.CATCH_ALL]
		});
	} catch {
		return [];
	}
};

export const apiGetTenantConsultantList = async (): Promise<Consultant[]> => {
	try {
		return await fetchData({
			url: `${endpoints.chatSeriesBase}consultants`,
			method: FETCH_METHODS.GET,
			responseHandling: [FETCH_ERRORS.CATCH_ALL]
		});
	} catch {
		return [];
	}
};
