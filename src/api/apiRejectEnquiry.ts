import { endpoints } from '../resources/scripts/endpoints';
import { fetchData, FETCH_ERRORS, FETCH_METHODS } from './fetchData';

/** Ordinary registered agency enquiry only; no reason or message content is transmitted. */
export const apiRejectEnquiry = (sessionId: number): Promise<void> =>
	fetchData({
		url: `${endpoints.sessionBase}/${sessionId}/rejection`,
		method: FETCH_METHODS.POST,
		responseHandling: [
			FETCH_ERRORS.FORBIDDEN,
			FETCH_ERRORS.NO_MATCH,
			FETCH_ERRORS.CONFLICT,
			FETCH_ERRORS.CATCH_ALL
		]
	}).then((response) => {
		// fetchData resolves204 as an empty object;200/201 preserve the Response.
		// Only the documented204 confirms that downstream closure was verified.
		if (response?.status !== undefined)
			throw new Error(FETCH_ERRORS.CATCH_ALL);
	});
