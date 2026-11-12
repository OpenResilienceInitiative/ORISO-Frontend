import { ReactComponent as ToolsIconOutline } from '../resources/img/icons/tools_outline.svg';
import { ReactComponent as ToolsIconFilled } from '../resources/img/icons/tools_filled.svg';
import { AddonSlot, AvailableAddon } from './addonTypes';
import { appsInSlot, appTitle } from './addonRegistry';

export const addonAppPath = (addonName: string, appId: string) =>
	`/addons/${encodeURIComponent(addonName)}/${encodeURIComponent(appId)}`;

/** Navigation entries for the add-on apps of a navigation slot, in the shape RouterConfig uses. */
export const addonNavigationItems = (
	addons: AvailableAddon[],
	slot: Extract<AddonSlot, 'asker.navigation' | 'consultant.navigation'>,
	locale: string
) =>
	appsInSlot(addons, slot).map(({ addon, app }) => {
		const title = appTitle(app, locale);
		return {
			to: addonAppPath(addon.name, app.id),
			icon: ToolsIconOutline,
			iconFilled: ToolsIconFilled,
			navSlot: 'row' as const,
			title,
			titleKeys: { large: title }
		};
	});
