import { useMemo } from 'react';
import {
	AddonAppInSlot,
	findAddonApp,
	useAddonRegistry
} from './addonRegistry';

/** `?addon=<add-on>/<app>` opens an add-on app as the side panel of the case view. */
export const ADDON_PANEL_PARAM = 'addon';

export const parseAddonPanel = (search: string) => {
	const value = new URLSearchParams(search).get(ADDON_PANEL_PARAM);
	const [addonName, appId, ...rest] = value?.split('/') ?? [];
	return addonName && appId && rest.length === 0
		? { addonName, appId }
		: null;
};

/** The search string with the add-on panel set, or removed for `null`; other panels close. */
export const withAddonPanel = (
	search: string,
	panel: { addonName: string; appId: string } | null
) => {
	const params = new URLSearchParams(search);
	params.delete('channel');
	if (panel) {
		params.set(ADDON_PANEL_PARAM, `${panel.addonName}/${panel.appId}`);
	} else {
		params.delete(ADDON_PANEL_PARAM);
	}
	const next = params.toString();
	return next ? `?${next}` : '';
};

/** The add-on app the URL opens in the case view, if it is available there. */
export const useOpenAddonPanel = (search: string): AddonAppInSlot | null => {
	const { addons } = useAddonRegistry();
	return useMemo(() => {
		const panel = parseAddonPanel(search);
		const found =
			panel && findAddonApp(addons, panel.addonName, panel.appId);
		return found && found.app.slots.includes('consultant.session')
			? found
			: null;
	}, [addons, search]);
};
