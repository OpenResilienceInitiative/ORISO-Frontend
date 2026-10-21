import { endpoints } from '../resources/scripts/endpoints';
import { fetchData, FETCH_METHODS } from './fetchData';
import {
	AccountOperationIntent,
	accountOperationHeaders
} from '../utils/accountOperationIntent';

export const apiDeleteEmail = async (
	operationIntent?: AccountOperationIntent
): Promise<any> => {
	return fetchData({
		url: endpoints.email,
		headersData: accountOperationHeaders(
			operationIntent,
			FETCH_METHODS.DELETE,
			endpoints.email
		),
		method: FETCH_METHODS.DELETE
	});
};
