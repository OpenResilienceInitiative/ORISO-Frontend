import { endpoints } from '../resources/scripts/endpoints';
import { fetchData, FETCH_METHODS, FETCH_ERRORS } from './fetchData';

export interface ConsultantAvailability {
	available: boolean;
	numAvailableConsultants: number;
}

/**
 * Real-time, topic-based check of whether any consultant is currently available
 * for an anonymous live chat. Mirrors the backend routing logic (topic-assigned,
 * not absent, intersected with online presence when known), so the result
 * matches what would actually happen if the enquiry were created.
 *
 * Public/anonymous (skipAuth) — called on the pre-registration screen before any
 * account exists. Degrades silently: callers should treat a rejection as
 * "unknown" and not block the user.
 */
export const apiGetConsultantAvailability = (
	topicId: number,
	consultingTypeId?: number,
	signal?: AbortSignal
): Promise<ConsultantAvailability> => {
	const params = new URLSearchParams({ topicId: topicId.toString() });
	if (typeof consultingTypeId === 'number') {
		params.set('consultingTypeId', consultingTypeId.toString());
	}

	return fetchData({
		url: `${endpoints.anonymousConsultantAvailability}?${params.toString()}`,
		method: FETCH_METHODS.GET,
		skipAuth: true,
		responseHandling: [FETCH_ERRORS.CATCH_ALL],
		...(signal && { signal })
	});
};
