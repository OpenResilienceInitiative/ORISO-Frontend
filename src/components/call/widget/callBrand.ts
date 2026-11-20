/**
 * The Traeger's brand, as the parameters the app writes into the Element Call
 * address when it starts a call (ORISO-Frontend#2188, epic #2187). The call
 * (ORISO-ElementCall) reads them and paints itself the same way; this module
 * is the sending side only.
 *
 * Contract, fixed with the call side:
 * - `orisoPrimary`, `orisoAccent`, `orisoSignal`: six lower-case hex digits,
 *   no `#`. A parameter is left out when it has no valid value.
 * - `orisoLogo`: the absolute https address of the TenantService branding
 *   route `<tenantServiceBase>/public/branding/<tenantId>/logo`. Left out when
 *   the Traeger has no logo. Never the stored logo itself, never a `data:` URL.
 *
 * Pure: same input, same output. The colours come from the same resolver the
 * app paints with (`resolveTenantSeeds`), so the call can never get a colour
 * the app would not apply: a missing, invalid or too pale primary sends no
 * colour at all, an invalid accent or signal is left out on its own.
 */
import {
	type TenantThemingSeedFields,
	resolveTenantSeeds
} from '../../../utils/theme/applyTenantTheme';

/** The part of the resolved tenant (`TenantDataInterface`) the call needs. */
export interface CallBrandTenant {
	/**
	 * The tenant the theming belongs to. On a shared domain the public payload
	 * carries the main tenant's branding *and* its id, so reading both from the
	 * same tenant keeps the logo on the call the logo the app shows.
	 */
	id?: number | null;
	theming?:
		| (TenantThemingSeedFields & {
				/** Decoded by `decodeTenantAsset`; only its presence matters here. */
				logo?: string | null;
		  })
		| null;
}

const withoutHash = (hex: string): string => hex.replace(/^#/, '');

/** `https://host/service/tenant` without trailing slashes; null if not absolute https. */
const absoluteHttpsBase = (base: string): string | null => {
	try {
		return new URL(base).protocol === 'https:'
			? base.replace(/\/+$/, '')
			: null;
	} catch {
		return null;
	}
};

const brandingLogoUrl = (
	tenantId: number | null | undefined,
	tenantServiceBase: string
): string | null => {
	// No id, no route to name; a route for another tenant would be worse.
	if (!Number.isSafeInteger(tenantId) || (tenantId as number) <= 0) {
		return null;
	}
	const base = absoluteHttpsBase(tenantServiceBase);
	return base ? `${base}/public/branding/${tenantId}/logo` : null;
};

/**
 * The brand parameters for one call, in a stable order (colours, then logo).
 * Empty when the Traeger has set nothing the call may use.
 *
 * @param tenant the resolved tenant from the app's tenant context
 * @param tenantServiceBase `endpoints.tenantServiceBase`
 */
export const callBrandParams = (
	tenant: CallBrandTenant | null | undefined,
	tenantServiceBase: string
): Record<string, string> => {
	const params: Record<string, string> = {};

	const seeds = resolveTenantSeeds(tenant?.theming);
	if (seeds) {
		params.orisoPrimary = withoutHash(seeds.primary);
		if (seeds.accent) params.orisoAccent = withoutHash(seeds.accent);
		if (seeds.signal) params.orisoSignal = withoutHash(seeds.signal);
	}

	if (tenant?.theming?.logo?.trim()) {
		const logo = brandingLogoUrl(tenant.id, tenantServiceBase);
		if (logo) params.orisoLogo = logo;
	}

	return params;
};
