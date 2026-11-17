import { endpoints } from '../resources/scripts/endpoints';
import { FETCH_ERRORS, FETCH_METHODS, fetchData } from '../api/fetchData';
import {
	ADDON_CONTRACT,
	AGENCY_HEADER,
	AddonApp,
	AddonRegistryResponse,
	AvailableAddon,
	SESSION_HEADER
} from './addonTypes';

/** Where an add-on's bundle and API live: below the AddonService's own route, never elsewhere. */
export const isAddonPath = (value: unknown): value is string =>
	typeof value === 'string' &&
	/^\/service\/addons\/[A-Za-z0-9._-]+\//.test(value) &&
	!value.includes('..');

const isText = (value: unknown): value is string =>
	typeof value === 'string' && value.length > 0;

const isApp = (app: Partial<AddonApp> | null | undefined): app is AddonApp =>
	isText(app?.id) && Array.isArray(app.slots);

/**
 * One registry entry, checked before its bundle is imported and its API gets the user's token:
 * `null` for an entry whose paths leave the add-on route, apps without id or slots are left out.
 */
export const toAvailableAddon = (
	entry: Partial<AvailableAddon> | null | undefined
): AvailableAddon | null => {
	if (
		!isText(entry?.name) ||
		!isAddonPath(entry.entry) ||
		!isAddonPath(entry.apiBase)
	) {
		return null;
	}
	return {
		...entry,
		name: entry.name,
		version: entry.version ?? '',
		entry: entry.entry,
		apiBase: entry.apiBase,
		apps: (Array.isArray(entry.apps) ? entry.apps : [])
			.filter(isApp)
			.map((app) => ({ ...app, title: app.title ?? {} }))
	};
};

export interface AddonRegistryContext {
	agencyId?: number;
	sessionId?: number;
}

/**
 * Loads the add-ons enabled for the logged-in user; `null` on instances without an AddonService,
 * or with an incompatible one: nothing here may break the app. With a context, the AddonService
 * decides for that case's agency and session.
 */
export const apiGetAddonRegistry = async (
	context: AddonRegistryContext = {}
): Promise<AvailableAddon[] | null> => {
	try {
		const response: AddonRegistryResponse = await fetchData({
			url: endpoints.addonRegistry,
			method: FETCH_METHODS.GET,
			// fetchData parses a GET with headers as JSON only when they name the content type.
			headersData: {
				'Content-Type': 'application/json',
				[AGENCY_HEADER]: context.agencyId?.toString(),
				[SESSION_HEADER]: context.sessionId?.toString()
			},
			responseHandling: [FETCH_ERRORS.CATCH_ALL_EXCEPT_UNAUTHORIZED]
		});
		if (
			response?.contract !== ADDON_CONTRACT ||
			!Array.isArray(response.addons)
		) {
			return null;
		}
		return response.addons.flatMap(
			(entry) => toAvailableAddon(entry) ?? []
		);
	} catch {
		return null;
	}
};
