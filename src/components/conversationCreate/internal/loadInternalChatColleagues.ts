import { FETCH_ERRORS, FETCH_METHODS, fetchData } from '../../../api/fetchData';
import { endpoints } from '../../../resources/scripts/endpoints';

export interface InternalChatColleague {
	consultantId: string;
	displayName: string;
	tenantName?: string;
	agencies: { id: number; name: string }[];
}

export const loadInternalChatColleagues = async (
	agencyId: number
): Promise<InternalChatColleague[]> => {
	const response: unknown = await fetchData({
		url: `${endpoints.internalSubsetChat}/recipients?agencyId=${agencyId}`,
		method: FETCH_METHODS.GET,
		responseHandling: [FETCH_ERRORS.CATCH_ALL]
	});
	if (Array.isArray(response)) {
		return response;
	}
	if (
		response &&
		typeof response === 'object' &&
		Object.keys(response).length === 0
	) {
		return [];
	}
	throw new Error(FETCH_ERRORS.CATCH_ALL);
};
