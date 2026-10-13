import { endpoints } from '../resources/scripts/endpoints';
import { fetchData, FETCH_ERRORS, FETCH_METHODS } from './fetchData';

export const apiRequestContactSheetEmail = (sessionId: number): Promise<void> =>
	fetchData({
		url: endpoints.contactSheetEmail(sessionId),
		method: FETCH_METHODS.POST,
		responseHandling: [
			FETCH_ERRORS.CONFLICT,
			FETCH_ERRORS.FORBIDDEN,
			FETCH_ERRORS.CATCH_ALL
		]
	});
