import { endpoints } from '../resources/scripts/endpoints';
import { fetchData, FETCH_ERRORS, FETCH_METHODS } from './fetchData';
import {
	AccountOperationIntent,
	accountOperationHeaders
} from '../utils/accountOperationIntent';

export const apiPutTwoFactorAuthApp = async (
	body: {
		secret: string;
		otp: string;
	},
	operationIntent?: AccountOperationIntent
): Promise<any> => {
	const url = endpoints.twoFactorAuthApp;
	const bodyData = JSON.stringify(body);

	return fetchData({
		url: url,
		method: FETCH_METHODS.PUT,
		bodyData,
		headersData: accountOperationHeaders(
			operationIntent,
			FETCH_METHODS.PUT,
			url,
			bodyData
		),
		responseHandling: [FETCH_ERRORS.BAD_REQUEST, FETCH_ERRORS.CONFLICT]
	});
};

export const apiPutTwoFactorAuthEmail = async (
	email: string,
	operationIntent?: AccountOperationIntent
): Promise<any> => {
	const url = endpoints.twoFactorAuthEmail;
	const bodyData = JSON.stringify({ email });

	return fetchData({
		url: url,
		method: FETCH_METHODS.PUT,
		bodyData,
		headersData: accountOperationHeaders(
			operationIntent,
			FETCH_METHODS.PUT,
			url,
			bodyData
		),
		responseHandling: [
			FETCH_ERRORS.BAD_REQUEST,
			FETCH_ERRORS.CONFLICT,
			FETCH_ERRORS.PRECONDITION_FAILED
		]
	});
};

export const apiPatchTwoFactorAuthEncourage = async (
	isToEncourage: boolean
): Promise<any> => {
	const url = endpoints.userData;

	return fetchData({
		url: url,
		method: FETCH_METHODS.PATCH,
		bodyData: JSON.stringify({ encourage2fa: isToEncourage }),
		responseHandling: [FETCH_ERRORS.BAD_REQUEST]
	});
};

export const apiPostTwoFactorAuthEmailWithCode = async (
	code: string,
	operationIntent?: AccountOperationIntent
): Promise<any> => {
	const url = endpoints.twoFactorAuthEmail + '/validate/' + code;

	return fetchData({
		url: url,
		method: FETCH_METHODS.POST,
		headersData: accountOperationHeaders(
			operationIntent,
			FETCH_METHODS.POST,
			url
		),
		responseHandling: [
			FETCH_ERRORS.BAD_REQUEST,
			FETCH_ERRORS.PRECONDITION_FAILED,
			FETCH_ERRORS.TOO_MANY_REQUESTS
		]
	});
};

export const apiDeleteTwoFactorAuth = async (
	operationIntent?: AccountOperationIntent
): Promise<any> => {
	const url = endpoints.twoFactorAuth;

	return fetchData({
		url: url,
		method: FETCH_METHODS.DELETE,
		headersData: accountOperationHeaders(
			operationIntent,
			FETCH_METHODS.DELETE,
			url
		)
	});
};
