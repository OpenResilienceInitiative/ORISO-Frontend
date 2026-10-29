import { endpoints } from '../resources/scripts/endpoints';
import { fetchData, FETCH_ERRORS, FETCH_METHODS } from './fetchData';
import {
	AccountOperationIntent,
	accountOperationHeaders
} from '../utils/accountOperationIntent';

export const apiPatchUserData = async (
	data,
	operationIntent?: AccountOperationIntent
): Promise<any> => {
	const url = endpoints.userData;
	const bodyData = JSON.stringify({ ...data });

	return fetchData({
		url: url,
		method: FETCH_METHODS.PATCH,
		bodyData,
		headersData: accountOperationHeaders(
			operationIntent,
			FETCH_METHODS.PATCH,
			url,
			bodyData
		),
		responseHandling: [
			FETCH_ERRORS.BAD_REQUEST,
			FETCH_ERRORS.FAILED_DEPENDENCY,
			FETCH_ERRORS.GATEWAY_TIMEOUT
		]
	});
};
