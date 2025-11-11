import { getValueFromCookie } from '../components/sessionCookie/accessSessionCookie';
import {
	getErrorCaseForStatus,
	redirectToErrorPage
} from '../components/error/errorHandling';
import { RequestLog } from '../utils/requestCollector';

export const fetchRCData = (
	url: string,
	method: string,
	bodyData: string = null,
	ignoreErrors: boolean = false
): Promise<any> => {
	const reqLog = new RequestLog(url, method);

	const matrixToken = getValueFromCookie('rc_token');
	const matrixUid = getValueFromCookie('rc_uid');

	const req = new Request(url, {
		method: method,
		headers: {
			'Content-Type': 'application/json',
			'cache-control': 'no-cache',
			'X-Auth-Token': matrixToken,
			'X-User-Id': matrixUid
		},
		credentials: 'include',
		body: bodyData
	});

	return fetch(req)
		.then((response) => {
			reqLog.finish(response.status);
			if (response.status === 200) {
				return response.json();
			} else if (!ignoreErrors) {
				console.warn('RocketChat API call failed:', response.status, response.statusText);
				// Don't redirect to error page for RocketChat failures
				throw new Error('api call error');
			}
		})
		.catch((error) => {
			reqLog.finish(error.status);
			console.warn('RocketChat API call error:', error);
			throw error;
		});
};
