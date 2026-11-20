import { endpoints } from '../resources/scripts/endpoints';
import {
	fetchData,
	FETCH_METHODS,
	FETCH_ERRORS,
	FETCH_SUCCESS
} from './fetchData';

interface registrationResponse {
	sessionId: number;
	matrixRoomId: string;
}

export const apiPostAdditionalEnquiry = async (
	consultingType: number,
	agencyId: number,
	postcode: string,
	mainTopicId: number
): Promise<registrationResponse> => {
	const url = endpoints.additionalEnquiry;
	const requestBody = {
		postcode,
		agencyId,
		consultingType: consultingType.toString(),
		mainTopicId
	};
	// console.log('🔵 Additional Enquiry Request Body:', requestBody);
	const data = JSON.stringify(requestBody);

	return fetchData({
		url: url,
		method: FETCH_METHODS.POST,
		bodyData: data,
		responseHandling: [
			FETCH_SUCCESS.CONTENT,
			// The dialog explains a refusal by its status (UserService#1646).
			FETCH_ERRORS.CATCH_ALL_WITH_RESPONSE,
			FETCH_ERRORS.COUNSELLING_DPA_RESPONSE,
			FETCH_ERRORS.CONFLICT_WITH_RESPONSE
		]
	});
};
