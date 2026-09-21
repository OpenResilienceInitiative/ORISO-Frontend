import { endpoints } from '../resources/scripts/endpoints';
import {
	fetchData,
	FETCH_ERRORS,
	FETCH_METHODS,
	FETCH_SUCCESS
} from './fetchData';

/**
 * Tells the backend whether the current consultant is available for live chat.
 *
 * The promise rejects when Redis-backed availability was not acknowledged. Callers
 * must not present or persist the requested state before this resolves.
 */
export const apiSetLiveChatAvailability = (
	available: boolean,
	signal?: AbortSignal
): Promise<void> =>
	fetchData({
		url: endpoints.consultantLiveChatAvailability,
		method: FETCH_METHODS.PUT,
		bodyData: JSON.stringify({ available }),
		responseHandling: [FETCH_ERRORS.CATCH_ALL],
		...(signal && { signal })
	}).then(() => undefined);

export const apiGetLiveChatAvailability = (): Promise<boolean> =>
	fetchData({
		url: endpoints.consultantLiveChatAvailability,
		method: FETCH_METHODS.GET
	}).then((response: { available?: boolean }) =>
		Boolean(response?.available)
	);

/**
 * Refreshes an existing backend lease and can never enable availability.
 *
 * A 403 rejects with `FETCH_ERRORS.FORBIDDEN` and a 401 with
 * `FETCH_ERRORS.UNAUTHORIZED`, so the caller can tell a refusal from a
 * transient failure (#1485).
 */
export const apiHeartbeatLiveChatAvailability = (): Promise<boolean> =>
	fetchData({
		url: endpoints.consultantLiveChatAvailabilityHeartbeat,
		method: FETCH_METHODS.POST,
		responseHandling: [FETCH_SUCCESS.CONTENT, FETCH_ERRORS.FORBIDDEN]
	}).then((response: { available?: boolean }) =>
		Boolean(response?.available)
	);
