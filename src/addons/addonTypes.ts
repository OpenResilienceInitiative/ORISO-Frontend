/** Types of the add-on contract `oriso-addon/v1` (ADR-032) as the web app sees it. */

export const ADDON_CONTRACT = 'oriso-addon/v1';

export const AGENCY_HEADER = 'X-Oriso-Agency-Id';
export const SESSION_HEADER = 'X-Oriso-Session-Id';

export type AddonSlot =
	| 'asker.navigation'
	| 'consultant.navigation'
	| 'consultant.session'
	| 'consultant.asker-profile'
	| 'admin.page';

export interface AddonApp {
	id: string;
	title: Record<string, string>;
	slots: AddonSlot[];
	/** Reported by dynamic apps (contract section 4); 0 or absent means none. */
	badge?: number;
}

/** One entry of `GET /service/addons/registry`, already filtered for the caller. */
export interface AvailableAddon {
	name: string;
	version: string;
	react?: string;
	/** Path of the ES module bundle, relative to the API origin. */
	entry: string;
	/** Path the add-on's API is reachable under, relative to the API origin. */
	apiBase: string;
	apps: AddonApp[];
}

export interface AddonRegistryResponse {
	contract: string;
	addons: AvailableAddon[];
}

/**
 * A short on-screen message for the person using the add-on, shown with the host's own
 * notifications. Plain text only; the add-on translates it (it knows `locale` and `informal`).
 */
export interface AddonNotice {
	type: 'success' | 'info' | 'warning' | 'error';
	text: string;
	title?: string;
}

/** What every lifecycle function of an add-on bundle receives. */
export interface AddonHostProps {
	contract: typeof ADDON_CONTRACT;
	domElement: HTMLElement;
	addon: { name: string; version: string };
	app: { id: string };
	slot: AddonSlot;
	user: { id: string; username: string; roles: string[] };
	tenant: { id?: number; name?: string };
	/** Active language, e.g. `de`; `informal` tells du from Sie. */
	locale: string;
	informal: boolean;
	/** The tenant's colour tokens (`--m3-*` custom properties). */
	theme: Record<string, string>;
	agencyId?: number;
	sessionId?: number;
	askerId?: string;
	/** Calls the add-on's own API with the user's login. */
	api: (path: string, init?: RequestInit) => Promise<Response>;
	navigate: (to: string) => void;
	/** Shows a short message through the host's notifications. */
	notify: (notice: AddonNotice) => void;
}

/**
 * The module an add-on bundle exports. Same shape as a single-spa parcel, so existing
 * framework adapters can produce it.
 */
export interface AddonModule {
	bootstrap?: (props: AddonHostProps) => void | Promise<void>;
	mount: (props: AddonHostProps) => void | Promise<void>;
	unmount: (props: AddonHostProps) => void | Promise<void>;
	update?: (props: AddonHostProps) => void | Promise<void>;
}
