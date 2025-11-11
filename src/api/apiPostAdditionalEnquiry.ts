import { endpoints } from '../resources/scripts/endpoints';
import {
	fetchData,
	FETCH_METHODS,
	FETCH_ERRORS,
	FETCH_SUCCESS
} from './fetchData';

interface registrationResponse {
	sessionId: number;
	rcGroupId: string;
}

export const apiPostAdditionalEnquiry = async (
	consultingType: number,
	agencyId: number,
	postcode: string,
	mainTopicId: number
): Promise<registrationResponse> => {
	const url = endpoints.additionalEnquiry;
	const data = JSON.stringify({
		postcode,
		agencyId,
		consultingType,
		mainTopicId
	});

	return fetchData({
		url: url,
		method: FETCH_METHODS.POST,
		rcValidation: true,
		bodyData: data,
		responseHandling: [
			FETCH_SUCCESS.CONTENT,
			FETCH_ERRORS.CATCH_ALL,
			FETCH_ERRORS.CONFLICT_WITH_RESPONSE
		]
	});
};
