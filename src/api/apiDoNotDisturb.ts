/**
 * Global Do-Not-Disturb (UserService). Authoritative cross-device store that
 * also gates notification emails; the frontend mirrors it into the notification
 * settings so announcements (toast/sound/push) are silenced while active.
 */
import { endpoints } from '../resources/scripts/endpoints';
import { fetchData, FETCH_METHODS, FETCH_SUCCESS } from './fetchData';

export interface DoNotDisturb {
	dndUntil: string | null;
}

const normalize = (response: any): DoNotDisturb => ({
	dndUntil: response?.dndUntil ?? null
});

export const apiGetDoNotDisturb = async (): Promise<DoNotDisturb> =>
	fetchData({
		url: endpoints.doNotDisturb,
		method: FETCH_METHODS.GET,
		responseHandling: [FETCH_SUCCESS.CONTENT]
	}).then(normalize);

export const apiSetDoNotDisturb = async (
	dndUntil: string | null
): Promise<DoNotDisturb> =>
	fetchData({
		url: endpoints.doNotDisturb,
		method: FETCH_METHODS.PUT,
		bodyData: JSON.stringify({ dndUntil }),
		responseHandling: [FETCH_SUCCESS.CONTENT]
	}).then(normalize);
