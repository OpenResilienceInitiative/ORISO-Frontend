import { endpoints } from '../resources/scripts/endpoints';
import { fetchData, FETCH_METHODS, FETCH_ERRORS } from './fetchData';
import {
	AccountOperationIntent,
	accountOperationHeaders
} from '../utils/accountOperationIntent';

export const apiUpdatePassword = async (
	oldPassword,
	newPassword,
	operationIntent?: AccountOperationIntent
): Promise<any> => {
	const url = endpoints.passwordReset;
	const passwords = JSON.stringify({
		oldPassword,
		newPassword
	});

	return fetchData({
		url: url,
		method: FETCH_METHODS.PUT,
		bodyData: passwords,
		headersData: accountOperationHeaders(
			operationIntent,
			FETCH_METHODS.PUT,
			url,
			passwords
		),
		responseHandling: [FETCH_ERRORS.BAD_REQUEST]
	});
};
