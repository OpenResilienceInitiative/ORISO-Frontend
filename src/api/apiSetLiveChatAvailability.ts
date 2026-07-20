import { endpoints } from '../resources/scripts/endpoints';
import { fetchData, FETCH_METHODS, FETCH_SUCCESS } from './fetchData';

/**
 * Tells the backend whether the current consultant is available for live chat.
 *
 * The promise rejects when Redis-backed availability was not acknowledged. Callers
 * must not present or persist the requested state before this resolves.
 */
export const apiSetLiveChatAvailability = (available: boolean): Promise<void> =>
	fetchData({
		url: endpoints.consultantLiveChatAvailability,
		method: FETCH_METHODS.PUT,
		bodyData: JSON.stringify({ available })
	}).then(() => undefined);

export const apiGetLiveChatAvailability = (): Promise<boolean> =>
	fetchData({
		url: endpoints.consultantLiveChatAvailability,
		method: FETCH_METHODS.GET
	}).then((response: { available?: boolean }) =>
		Boolean(response?.available)
	);

/** Refreshes an existing backend lease and can never enable availability. */
export const apiHeartbeatLiveChatAvailability = (): Promise<boolean> =>
	fetchData({
		url: endpoints.consultantLiveChatAvailabilityHeartbeat,
		method: FETCH_METHODS.POST,
		responseHandling: [FETCH_SUCCESS.CONTENT]
	}).then((response: { available?: boolean }) =>
		Boolean(response?.available)
	);
