import { endpoints } from '../resources/scripts/endpoints';
import { fetchData, FETCH_ERRORS, FETCH_METHODS } from './fetchData';

/**
 * Accepts an anonymous Live Chat enquiry for the authenticated consultant.
 *
 * Live chats use a dedicated cross-tenant assignment path
 * (`assignAnonymousEnquiry`) that differs from the registered-enquiry accept
 * (`apiEnquiryAcceptance` → `assignRegisteredEnquiry`). Routing a live chat
 * through the registered endpoint mis-assigns it, so the consultant open/accept
 * flow must call this endpoint for anonymous conversations (#774).
 */
export const apiAcceptAnonymousEnquiry = async (
	sessionId: number
): Promise<any> => {
	const url = endpoints.acceptAnonymousEnquiry(sessionId);

	return fetchData({
		url,
		method: FETCH_METHODS.PUT,
		responseHandling: [FETCH_ERRORS.CONFLICT]
	});
};
