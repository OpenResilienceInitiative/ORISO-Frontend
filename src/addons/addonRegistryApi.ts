import { endpoints } from '../resources/scripts/endpoints';
import { FETCH_ERRORS, FETCH_METHODS, fetchData } from '../api/fetchData';
import {
	ADDON_CONTRACT,
	AddonRegistryResponse,
	AvailableAddon
} from './addonTypes';

/**
 * Loads the add-ons enabled for the logged-in user. Instances without an AddonService, or
 * with an incompatible one, simply have no add-ons: nothing here may break the app.
 */
export const apiGetAddonRegistry = async (): Promise<AvailableAddon[]> => {
	try {
		const response: AddonRegistryResponse = await fetchData({
			url: endpoints.addonRegistry,
			method: FETCH_METHODS.GET,
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
