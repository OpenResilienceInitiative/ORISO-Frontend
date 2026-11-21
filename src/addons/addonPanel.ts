import { useMemo } from 'react';
import {
	AddonAppInSlot,
	findAddonApp,
	useCaseAddonRegistry
} from './addonRegistry';
import { AddonRegistryContext } from './addonRegistryApi';
import { AddonApp, AddonSlot } from './addonTypes';
import { ADDON_PANEL_PARAM, withChannel } from '../utils/channelRoute';

export type AddonPanelSlot = Extract<
	AddonSlot,
	'consultant.session' | 'consultant.session-menu' | 'asker.session-menu'
>;

const PANEL_SLOTS: Record<'consultant' | 'asker', AddonPanelSlot[]> = {
	consultant: ['consultant.session', 'consultant.session-menu'],
	asker: ['asker.session-menu']
};

const isPanelSlot = (value: string): value is AddonPanelSlot =>
	Object.values(PANEL_SLOTS).some((slots) =>
		slots.includes(value as AddonPanelSlot)
	);

export interface AddonPanelRequest {
	addonName: string;
	appId: string;
	slot?: AddonPanelSlot;
}

export const parseAddonPanel = (search: string): AddonPanelRequest | null => {
	const value = new URLSearchParams(search).get(ADDON_PANEL_PARAM);
	const [addonName, appId, slot, ...rest] = value?.split('/') ?? [];
	if (!addonName || !appId || rest.length > 0) {
		return null;
	}
	if (slot === undefined) {
		return { addonName, appId };
	}
	return isPanelSlot(slot) ? { addonName, appId, slot } : null;
};

export const addonPanelValue = ({
	addonName,
	appId,
	slot
}: AddonPanelRequest) => [addonName, appId, ...(slot ? [slot] : [])].join('/');

/** Marks the header button of an app, so focus can return to it when its panel closes. */
export const addonActionId = (addonName: string, appId: string) =>
	`${addonName}/${appId}`;

/** The search string with the add-on panel set, or removed for `null`; other panels close. */
export const withAddonPanel = (
	search: string,
	panel: AddonPanelRequest | null
) => {
	const params = new URLSearchParams(withChannel(search, null));
	if (panel) {
		params.set(ADDON_PANEL_PARAM, addonPanelValue(panel));
	} else {
		params.delete(ADDON_PANEL_PARAM);
	}
	const next = params.toString();
	return next ? `?${next}` : '';
};

/** The slot an app opens in beside the chat for a role: the requested one if the app has it. */
export const addonPanelSlot = (
	app: Pick<AddonApp, 'slots'>,
	role: 'consultant' | 'asker',
	requested?: AddonPanelSlot
): AddonPanelSlot | undefined =>
	requested &&
	PANEL_SLOTS[role].includes(requested) &&
	app.slots.includes(requested)
		? requested
		: PANEL_SLOTS[role].find((candidate) => app.slots.includes(candidate));

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
		const slot = found
			? addonPanelSlot(found.app, role, panel.slot)
			: undefined;
		return found && slot ? { ...found, slot } : null;
	}, [addons, search, role]);
};
