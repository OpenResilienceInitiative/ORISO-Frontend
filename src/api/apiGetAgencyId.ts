import { endpoints } from '../resources/scripts/endpoints';
import { fetchData, FETCH_METHODS, FETCH_ERRORS } from './fetchData';
import { AgencyDataInterface } from '../globalState/interfaces';
import { apiGetConsultingType } from './apiGetConsultingType';

export const apiGetAgencyById = async (
	agencyId: number,
	fetchConsultingTypeDetails?: boolean
): Promise<AgencyDataInterface> => {
	const url = endpoints.agencyServiceBase + '/' + agencyId;

	try {
		const response = await fetchData({
			url: url,
			method: FETCH_METHODS.GET,
			skipAuth: true,
			responseHandling: [
				FETCH_ERRORS.EMPTY,
				FETCH_ERRORS.NO_MATCH,
				FETCH_ERRORS.CATCH_ALL
			]
		});
		const agency = response?.[0];
		if (!fetchConsultingTypeDetails || !agency) {
			return agency ?? null;
		}

		return {
			...agency,
			consultingTypeRel: await apiGetConsultingType({
				consultingTypeId: agency?.consultingType
			})
		};
	} catch {
		// Agency logo/metadata is non-critical — must not redirect anonymous chats to error.500.
		return null;
	}
};
