import { useMemo } from 'react';
import {
	AddonAppInSlot,
	findAddonApp,
	useCaseAddonRegistry
} from './addonRegistry';
import { AddonRegistryContext } from './addonRegistryApi';
import { AddonApp, AddonSlot } from './addonTypes';
import { ADDON_PANEL_PARAM, withChannel } from '../utils/channelRoute';

export const parseAddonPanel = (search: string) => {
	const value = new URLSearchParams(search).get(ADDON_PANEL_PARAM);
	const [addonName, appId, ...rest] = value?.split('/') ?? [];
	return addonName && appId && rest.length === 0
		? { addonName, appId }
		: null;
};

/** Marks the header button of an app, so focus can return to it when its panel closes. */
export const addonActionId = (addonName: string, appId: string) =>
	`${addonName}/${appId}`;

/** The search string with the add-on panel set, or removed for `null`; other panels close. */
export const withAddonPanel = (
	search: string,
	panel: { addonName: string; appId: string } | null
) => {
	const params = new URLSearchParams(withChannel(search, null));
	if (panel) {
		params.set(ADDON_PANEL_PARAM, `${panel.addonName}/${panel.appId}`);
	} else {
		params.delete(ADDON_PANEL_PARAM);
	}
	const next = params.toString();
	return next ? `?${next}` : '';
};

export type AddonPanelSlot = Extract<
	AddonSlot,
	'consultant.session' | 'consultant.session-menu' | 'asker.session-menu'
>;

const PANEL_SLOTS: Record<'consultant' | 'asker', AddonPanelSlot[]> = {
	consultant: ['consultant.session', 'consultant.session-menu'],
	asker: ['asker.session-menu']
};

/** The slot an app opens in beside the chat for a role, or none. */
export const addonPanelSlot = (
	app: Pick<AddonApp, 'slots'>,
	role: 'consultant' | 'asker'
): AddonPanelSlot | undefined =>
	PANEL_SLOTS[role].find((candidate) => app.slots.includes(candidate));

export interface OpenAddonPanel extends AddonAppInSlot {
	slot: AddonPanelSlot;
}

/**
 * The add-on app the URL opens beside the chat, if this session's registry has it in a slot of
 * the role: the case view's header buttons and session menu for counsellors, the session menu
 * for clients.
 */
export const useOpenAddonPanel = (
	search: string,
	context: AddonRegistryContext,
	role: 'consultant' | 'asker' = 'consultant'
): OpenAddonPanel | null => {
	const { addons } = useCaseAddonRegistry(context);
	return useMemo(() => {
		const panel = parseAddonPanel(search);
		const found =
			panel && findAddonApp(addons, panel.addonName, panel.appId);
		const slot = found ? addonPanelSlot(found.app, role) : undefined;
		return found && slot ? { ...found, slot } : null;
	}, [addons, search, role]);
};
