import { endpoints } from '../resources/scripts/endpoints';
import { fetchData, FETCH_ERRORS, FETCH_METHODS } from './fetchData';

let previousProm = null;

export interface ApiGetAskerSessionListOptions {
	/**
	 * The caller knows the list changed (a refresh signal): a request that is
	 * already running was asked before that change, so wait for it and ask
	 * again instead of sharing its answer (OBP 2.1 #3).
	 */
	fresh?: boolean;
}

export const apiGetAskerSessionList = async (
	options?: ApiGetAskerSessionListOptions
): Promise<any> => {
	const url = endpoints.askerSessions;

	// ToDo: We are calling this endpoint on multiple places at the same time which makes the tests flaky
	// This is a quick fix to prevent multiple calls to the same endpoint and should better be refactored
	if (previousProm) {
		// `previousProm` is cleared in its own `finally`, so the follow-up
		// starts a new request (or joins one started after this signal).
		return options?.fresh
			? previousProm.then(() => apiGetAskerSessionList())
			: previousProm;
	}

	// CATCH_ALL so a backend error never triggers a full-page redirect to
	// error.500.html; on failure resolve to an empty list so the chat still loads.
	previousProm = fetchData({
		url: url,
		method: FETCH_METHODS.GET,
		responseHandling: [FETCH_ERRORS.EMPTY, FETCH_ERRORS.CATCH_ALL]
	})
		.catch(() => ({ sessions: [] }))
		.finally(() => {
			previousProm = null;
		});
	return previousProm;
};
