import { useEffect, useState } from 'react';
import { endpoints } from '../resources/scripts/endpoints';
import { apiGetTenantTheming } from '../api/apiGetTenantTheming';
import { getLinkAgencyId } from '../utils/linkAgencyId';
import {
	ADDON_CONTRACT,
	AddonApp,
	AddonRegistrationResult,
	AvailableAddon,
	RegistrationAddonResponse
} from './addonTypes';

/** The add-on and app that replace the agency selection of the registration. */
export interface RegistrationAddon {
	addon: AvailableAddon;
	app: AddonApp;
}

export type RegistrationAddonState =
	| { status: 'loading' }
	| { status: 'none' }
	| { status: 'ready'; addon: AvailableAddon; app: AddonApp };

/** Without an answer in this time the registration keeps its own agency selection. */
export const REGISTRATION_ADDON_TIMEOUT_MS = 4000;
/** An app not mounted in this time gives the step back to the core agency selection. */
export const REGISTRATION_ADDON_MOUNT_TIMEOUT_MS = 10000;

const REGISTRATION_REF = /^[A-Za-z0-9_-]{1,64}$/;
const ADDON_PATH = /^\/service\/addons\/[A-Za-z0-9._-]+\//;

export const isRegistrationRef = (value: unknown): value is string =>
	typeof value === 'string' && REGISTRATION_REF.test(value);

const isText = (value: unknown): value is string =>
	typeof value === 'string' && value.length > 0;

export const toRegistrationAddon = (
	answer: Partial<RegistrationAddonResponse> | null | undefined
): RegistrationAddon | null => {
	if (
		answer?.contract !== ADDON_CONTRACT ||
		!isText(answer.name) ||
		!isText(answer.appId) ||
		!isText(answer.entry) ||
		!isText(answer.apiBase) ||
		!ADDON_PATH.test(answer.entry) ||
		!ADDON_PATH.test(answer.apiBase)
	) {
		return null;
	}
	const app: AddonApp = {
		id: answer.appId,
		title: answer.title ?? {},
		slots: ['registration.agency-finder'],
		...(answer.icon ? { icon: answer.icon } : {})
	};
	return {
		addon: {
			name: answer.name,
			version: answer.version ?? '',
			react: answer.react,
			entry: answer.entry,
			apiBase: answer.apiBase,
			apps: [app]
		},
		app
	};
};

/**
 * Asks the AddonService which add-on takes over the agency selection for a Träger; `null` for
 * none (204), for any error and after the timeout, so the registration never waits on it.
 */
export const apiGetRegistrationAddon = async (
	tenantId: number,
	timeoutMs: number = REGISTRATION_ADDON_TIMEOUT_MS
): Promise<RegistrationAddon | null> => {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	try {
		const response = await fetch(
			`${endpoints.addonRegistration}?${new URLSearchParams({
				tenantId: String(tenantId)
			})}`,
			{
				credentials: 'omit',
				headers: { Accept: 'application/json' },
				signal: controller.signal
			}
		);
		if (response.status !== 200) {
			return null;
		}
		return toRegistrationAddon(await response.json());
	} catch {
		return null;
	} finally {
		clearTimeout(timer);
	}
};

const lookups = new Map<number, Promise<RegistrationAddon | null>>();

/** One lookup per Träger and page load: every registration step asks the same question. */
const lookupRegistrationAddon = (tenantId: number) => {
	let lookup = lookups.get(tenantId);
	if (!lookup) {
		lookup = apiGetRegistrationAddon(tenantId);
		lookups.set(tenantId, lookup);
	}
	return lookup;
};

const tenantIdLookups = new Map<number | null, Promise<number | null>>();

const lookupTenantId = (linkAgencyId: number | null) => {
	let lookup = tenantIdLookups.get(linkAgencyId);
	if (!lookup) {
		lookup = apiGetTenantTheming(linkAgencyId)
			.then((tenant) => tenant?.id ?? null)
			.catch(() => null);
		tenantIdLookups.set(linkAgencyId, lookup);
	}
	return lookup;
};

export const resetRegistrationAddonForTests = () => {
	lookups.clear();
	tenantIdLookups.clear();
};

/**
 * The Träger the registration belongs to: the tenant context's, or, where that has no id
 * (single-domain hosts), the one the tenant service resolves for this visitor. `undefined`
 * while that is looked up, `null` for none.
 */
export const useRegistrationTenantId = (
	contextTenantId: number | null | undefined,
	lookup: boolean
): number | null | undefined => {
	const needsLookup = contextTenantId == null && lookup;
	const [found, setFound] = useState<{ value: number | null }>();

	useEffect(() => {
		if (!needsLookup) {
			return undefined;
		}
		let active = true;
		lookupTenantId(getLinkAgencyId(window.location.search)).then(
			(value) => {
				if (active) {
					setFound({ value });
				}
			}
		);
		return () => {
			active = false;
		};
	}, [needsLookup]);

	if (contextTenantId != null) {
		return contextTenantId;
	}
	if (!lookup) {
		return null;
	}
	return found ? found.value : undefined;
};

/**
 * The add-on that replaces the agency selection for this Träger, if any. Also for registrations
 * that replace the core one (an extension's own flow): show `RegistrationAddonStep` on `ready`,
 * the own agency selection on `none`.
 */
export const useRegistrationAddon = (
	tenantId: number | null | undefined
): RegistrationAddonState => {
	const [state, setState] = useState<{
		tenantId?: number | null;
		value: RegistrationAddon | null;
	}>();

	useEffect(() => {
		if (tenantId == null) {
			return undefined;
		}
		let active = true;
		lookupRegistrationAddon(tenantId).then((value) => {
			if (active) {
				setState({ tenantId, value });
			}
		});
		return () => {
			active = false;
		};
	}, [tenantId]);

	if (tenantId == null) {
		return { status: 'none' };
	}
	if (!state || state.tenantId !== tenantId) {
		return { status: 'loading' };
	}
	return state.value
		? { status: 'ready', ...state.value }
		: { status: 'none' };
};

const integerFrom = (value: unknown, min: number): number | undefined => {
	const number =
		typeof value === 'string' && value.trim() !== ''
			? Number(value)
			: value;
	return typeof number === 'number' &&
		Number.isInteger(number) &&
		number >= min
		? number
		: undefined;
};

/** What the app handed back, checked; `null` without a usable agency. */
export const toRegistrationResult = (
	result: unknown
): AddonRegistrationResult | null => {
	const candidate = (result ?? {}) as Record<string, unknown>;
	const agencyId = integerFrom(candidate.agencyId, 1);
	if (agencyId === undefined) {
		return null;
	}
	const topicId = integerFrom(candidate.topicId, 1);
	const consultingType = integerFrom(candidate.consultingType, 0);
	const postcode =
		typeof candidate.postcode === 'string' &&
		/^\d{5}$/.test(candidate.postcode)
			? candidate.postcode
			: undefined;
	return {
		agencyId,
		...(topicId !== undefined ? { topicId } : {}),
		...(postcode ? { postcode } : {}),
		...(consultingType !== undefined ? { consultingType } : {}),
		...(isRegistrationRef(candidate.registrationRef)
			? { registrationRef: candidate.registrationRef }
			: {})
	};
};
