import { endpoints } from '../resources/scripts/endpoints';
import { fetchData, FETCH_METHODS, FETCH_ERRORS } from './fetchData';

/**
 * Tells the backend whether the current consultant is available for live chat.
 *
 * Driven by the Live Chat toggle and by logout so the anonymous availability count
 * updates immediately. Best-effort: failures are swallowed (the backend heartbeat
 * window will reconcile state) so this never blocks the toggle or logout flow.
 */
export const apiSetLiveChatAvailability = (available: boolean): Promise<void> =>
	fetchData({
		url: endpoints.consultantLiveChatAvailability,
		method: FETCH_METHODS.PUT,
		bodyData: JSON.stringify({ available }),
		responseHandling: [FETCH_ERRORS.CATCH_ALL]
	})
		.then(() => undefined)
		.catch(() => undefined);
