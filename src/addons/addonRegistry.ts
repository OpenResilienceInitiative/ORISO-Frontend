import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { AddonApp, AddonSlot, AvailableAddon } from './addonTypes';
import { apiGetAddonRegistry } from './addonRegistryApi';

export interface AddonAppInSlot {
	addon: AvailableAddon;
	app: AddonApp;
}

export interface AddonRegistryState {
	addons: AvailableAddon[];
	loaded: boolean;
}

const EMPTY: AddonRegistryState = { addons: [], loaded: false };
let registry: AddonRegistryState = EMPTY;
const listeners = new Set<() => void>();

const setRegistry = (next: AddonRegistryState) => {
	registry = next;
	listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
	listeners.add(listener);
	return () => listeners.delete(listener);
};

export const resetAddonRegistryForTests = () => setRegistry(EMPTY);

/** Loads the registry for the logged-in user; mounted once, in the app shell's routing. */
export const useAddonRegistryLoader = (userId: string | undefined) => {
	useEffect(() => {
		setRegistry(EMPTY);
		if (!userId) {
			return undefined;
		}
		let cancelled = false;
		apiGetAddonRegistry().then((addons) => {
			if (!cancelled) {
				setRegistry({ addons, loaded: true });
			}
		});
		return () => {
			cancelled = true;
		};
	}, [userId]);
};

export const useAddonRegistry = (): AddonRegistryState =>
	useSyncExternalStore(
		subscribe,
		() => registry,
		() => EMPTY
	);

export const appsInSlot = (
	addons: AvailableAddon[],
	slot: AddonSlot
): AddonAppInSlot[] =>
	addons.flatMap((addon) =>
		addon.apps
			.filter((app) => app.slots.includes(slot))
			.map((app) => ({ addon, app }))
	);

export const useAddonApps = (slot: AddonSlot): AddonAppInSlot[] => {
	const { addons } = useAddonRegistry();
	return useMemo(() => appsInSlot(addons, slot), [addons, slot]);
};

export const findAddonApp = (
	addons: AvailableAddon[],
	addonName: string,
	appId: string
): AddonAppInSlot | undefined => {
	const addon = addons.find((candidate) => candidate.name === addonName);
	const app = addon?.apps.find((candidate) => candidate.id === appId);
	return addon && app ? { addon, app } : undefined;
};

/** The title in the user's language, falling back to German and then to any title. */
export const appTitle = (app: AddonApp, locale: string): string => {
	const language = locale.split(/[@-]/)[0];
	return (
		app.title[locale] ??
		app.title[language] ??
		app.title.de ??
		Object.values(app.title)[0] ??
		app.id
	);
};
