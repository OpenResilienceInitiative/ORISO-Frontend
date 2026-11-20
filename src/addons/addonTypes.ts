/** Types of the add-on contract `oriso-addon/v1` (ADR-034) as the web app sees it. */

export const ADDON_CONTRACT = 'oriso-addon/v1';

export const AGENCY_HEADER = 'X-Oriso-Agency-Id';
export const SESSION_HEADER = 'X-Oriso-Session-Id';
export const TENANT_HEADER = 'X-Oriso-Tenant-Id';

export type AddonSlot =
	| 'asker.navigation'
	| 'consultant.navigation'
	| 'asker.session-menu'
	| 'consultant.session'
	| 'consultant.session-menu'
	| 'consultant.asker-profile'
	| 'registration.agency-finder'
	| 'admin.page';

export interface AddonApp {
	id: string;
	title: Record<string, string>;
	slots: AddonSlot[];
	/** Reported by dynamic apps (contract section 4); 0 or absent means none. */
	badge?: number;
	/** Same-origin path of a monochrome SVG, e.g. `/service/addons/<name>/ui/icons/goals.svg`. */
	icon?: string;
	description?: Record<string, string>;
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

/** What the `registration.agency-finder` app hands back to the registration. */
export interface AddonRegistrationResult {
	agencyId: number;
	topicId?: number;
	postcode?: string;
	consultingType?: number;
	/** Opaque id of what the add-on stored, `[A-Za-z0-9_-]{1,64}`; sent with the registration. */
	registrationRef?: string;
}

/** `GET /service/addons/public/registration?tenantId=`: the app replacing the agency selection. */
export interface RegistrationAddonResponse {
	contract: string;
	name: string;
	version: string;
	react?: string;
	appId: string;
	title: Record<string, string>;
	icon?: string;
	entry: string;
	apiBase: string;
}

/** What the registration passes to its `registration.agency-finder` app. */
export interface AddonRegistrationProps {
	/** The topic chosen so far, if any. */
	topicId?: number;
	/** The postcode entered so far, if any. */
	postcode?: string;
	complete: (result: AddonRegistrationResult) => void;
	back: () => void;
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
	/** Only in slot `registration.agency-finder`: topic and postcode chosen so far. */
	topicId?: number;
	postcode?: string;
	/** Only in slot `registration.agency-finder`: hands the chosen agency to the registration. */
	complete?: (result: AddonRegistrationResult) => void;
	/** Only in slot `registration.agency-finder`: back to the previous registration step. */
	back?: () => void;
	/**
	 * Calls the add-on's own API with the user's login; in `registration.agency-finder` its
	 * public API, with the Träger in `X-Oriso-Tenant-Id` and without a login.
	 */
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
