import { endpoints } from '../resources/scripts/endpoints';
import { FETCH_ERRORS, FETCH_METHODS, fetchData } from '../api/fetchData';
import {
	ADDON_CONTRACT,
	AGENCY_HEADER,
	AddonRegistryResponse,
	AvailableAddon,
	SESSION_HEADER
} from './addonTypes';

export interface AddonRegistryContext {
	agencyId?: number;
	sessionId?: number;
}

/**
 * Loads the add-ons enabled for the logged-in user. Instances without an AddonService, or
 * with an incompatible one, simply have no add-ons: nothing here may break the app. With a
 * context, the AddonService decides for that case's agency and session.
 */
export const apiGetAddonRegistry = async (
	context: AddonRegistryContext = {}
): Promise<AvailableAddon[]> => {
	try {
		const response: AddonRegistryResponse = await fetchData({
			url: endpoints.addonRegistry,
			method: FETCH_METHODS.GET,
			headersData: {
				[AGENCY_HEADER]: context.agencyId?.toString(),
				[SESSION_HEADER]: context.sessionId?.toString()
			},
			responseHandling: [FETCH_ERRORS.CATCH_ALL_EXCEPT_UNAUTHORIZED]
		});
		if (
			response?.contract !== ADDON_CONTRACT ||
			!Array.isArray(response.addons)
		) {
			return [];
		}
		return response.addons;
	} catch {
		return [];
	}
};
