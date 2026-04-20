import { endpoints } from '../resources/scripts/endpoints';
import { fetchData, FETCH_ERRORS, FETCH_METHODS } from './fetchData';

export interface AnonymousEnquiryDetails {
	numAvailableConsultants: number;
	peopleAhead?: number;
	status: 'INITIAL' | 'NEW' | 'IN_PROGRESS' | 'DONE' | 'IN_ARCHIVE';
}

/**
 * Fetch live details about an anonymous enquiry: currently available
 * consultants for its consulting type, the session status, and how many
 * other anonymous enquiries are queued ahead of this one.
 *
 * Callable only by the session's own advice seeker (ANONYMOUS auth role).
 *
 * CATCH_ALL is passed so transient failures (backend restart, role timing)
 * reject the promise locally instead of redirecting the whole app to the
 * global error page — the waiting-queue UI is allowed to silently degrade.
 */
export const apiGetAnonymousEnquiryDetails = (
	sessionId: number | string
): Promise<AnonymousEnquiryDetails> =>
	fetchData({
		url: endpoints.anonymousEnquiryDetails(sessionId),
		rcValidation: false,
		responseHandling: [
			FETCH_ERRORS.CATCH_ALL,
			FETCH_ERRORS.FORBIDDEN,
			FETCH_ERRORS.NO_MATCH,
			FETCH_ERRORS.BAD_REQUEST
		],
		method: FETCH_METHODS.GET
	});
