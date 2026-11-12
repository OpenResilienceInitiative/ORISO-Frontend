import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { AddonApp, AddonSlot, AvailableAddon } from './addonTypes';
import { AddonRegistryContext, apiGetAddonRegistry } from './addonRegistryApi';
import { localizedText } from './addonLink';

export interface AddonAppInSlot {
	addon: AvailableAddon;
	app: AddonApp;
}

export interface AddonRegistryState {
	addons: AvailableAddon[];
	loaded: boolean;
}

const EMPTY: AddonRegistryState = { addons: [], loaded: false };
const GLOBAL_KEY = '';
const NO_CASE_KEY = 'no-case';
export const REGISTRY_REFRESH_DEBOUNCE_MS = 1000;

const registries = new Map<string, AddonRegistryState>();
const inFlight = new Map<string, Promise<AvailableAddon[]>>();
const listeners = new Set<() => void>();
let generation = 0;
let refreshTimer: ReturnType<typeof setTimeout> | undefined;

const notify = () => listeners.forEach((listener) => listener());

const setRegistry = (key: string, next: AddonRegistryState) => {
	registries.set(key, next);
	notify();
};

const subscribe = (listener: () => void) => {
	listeners.add(listener);
	return () => listeners.delete(listener);
};

const contextKey = ({ agencyId, sessionId }: AddonRegistryContext) =>
	`${agencyId ?? ''}/${sessionId ?? ''}`;

// Header button, side panel and profile tiles of one case share one request.
const fetchRegistry = (key: string, context?: AddonRegistryContext) => {
	const requestKey = `${key}#${generation}`;
	let request = inFlight.get(requestKey);
	if (!request) {
		request = apiGetAddonRegistry(context).finally(() =>
			inFlight.delete(requestKey)
		);
		inFlight.set(requestKey, request);
	}
	return request;
};

export const resetAddonRegistryForTests = () => {
	registries.clear();
	inFlight.clear();
	clearTimeout(refreshTimer);
	generation = 0;
	notify();
};

/** Loads every registry again, debounced: after an add-on notification and on window focus. */
export const refreshAddonRegistries = () => {
	clearTimeout(refreshTimer);
	refreshTimer = setTimeout(() => {
		generation += 1;
		notify();
	}, REGISTRY_REFRESH_DEBOUNCE_MS);
};

const useGeneration = () =>
	useSyncExternalStore(
		subscribe,
		() => generation,
		() => 0
	);

const useRegistryState = (key: string): AddonRegistryState =>
	useSyncExternalStore(
		subscribe,
		() => registries.get(key) ?? EMPTY,
		() => EMPTY
	);

/** Loads the registry for the logged-in user; mounted once, in the app shell's routing. */
export const useAddonRegistryLoader = (userId: string | undefined) => {
	const currentGeneration = useGeneration();

	useEffect(() => {
		registries.clear();
		notify();
	}, [userId]);

	useEffect(() => {
		if (!userId) {
			return undefined;
		}
		window.addEventListener('focus', refreshAddonRegistries);
		return () =>
			window.removeEventListener('focus', refreshAddonRegistries);
	}, [userId]);

	useEffect(() => {
		if (!userId) {
			return undefined;
		}
		let cancelled = false;
		fetchRegistry(GLOBAL_KEY).then((addons) => {
			if (!cancelled) {
				setRegistry(GLOBAL_KEY, { addons, loaded: true });
			}
		});
		return () => {
			cancelled = true;
		};
	}, [userId, currentGeneration]);
};

/** The registry without context: navigation and places outside a case. */
export const useAddonRegistry = (): AddonRegistryState =>
	useRegistryState(GLOBAL_KEY);

/**
 * The registry for one open case; empty until it is loaded, so nothing shows that the case
 * does not allow. Waits for the registry without context, which tells that a user is logged in.
 */
export const useCaseAddonRegistry = (
	context: AddonRegistryContext
): AddonRegistryState => {
	const currentGeneration = useGeneration();
	const { loaded: globalLoaded } = useAddonRegistry();
	const key = globalLoaded && context.sessionId ? contextKey(context) : null;
	const state = useRegistryState(key ?? NO_CASE_KEY);

	useEffect(() => {
		if (!key) {
			return undefined;
		}
		let cancelled = false;
		fetchRegistry(key, context).then((addons) => {
			if (!cancelled) {
				setRegistry(key, { addons, loaded: true });
			}
		});
		return () => {
			cancelled = true;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [key, currentGeneration]);

	return key ? state : EMPTY;
};

export const appsInSlot = (
	addons: AvailableAddon[],
	slot: AddonSlot
): AddonAppInSlot[] =>
	addons.flatMap((addon) =>
		addon.apps
			.filter((app) => app.slots.includes(slot))
			.map((app) => ({ addon, app }))
	);

export const useCaseAddonApps = (
	slot: AddonSlot,
	context: AddonRegistryContext
): AddonAppInSlot[] => {
	const { addons } = useCaseAddonRegistry(context);
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
export const appTitle = (app: AddonApp, locale: string): string =>
	localizedText(app.title, locale) ?? app.id;
