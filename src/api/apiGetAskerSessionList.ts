import { endpoints } from '../resources/scripts/endpoints';
import { fetchData, FETCH_ERRORS, FETCH_METHODS } from './fetchData';

let previousProm = null;

export const apiGetAskerSessionList = async (): Promise<any> => {
	const url = endpoints.askerSessions;

	// ToDo: We are calling this endpoint on multiple places at the same time which makes the tests flaky
	// This is a quick fix to prevent multiple calls to the same endpoint and should better be refactored
	if (previousProm) {
		return previousProm;
	}

	// CATCH_ALL so a backend error never triggers a full-page redirect to
	// error.500.html; on failure resolve to an empty list so the chat still loads.
	previousProm = fetchData({
		url: url,
		method: FETCH_METHODS.GET,
		rcValidation: false,
		responseHandling: [FETCH_ERRORS.EMPTY, FETCH_ERRORS.CATCH_ALL]
	})
		.catch(() => ({ sessions: [] }))
		.finally(() => {
			previousProm = null;
		});
	return previousProm;
};
