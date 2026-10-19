import { TenantDataInterface } from '../../../globalState/interfaces';

/** The designs of the closing animation (ORISO-Frontend#1737). */
export const CLOSING_VARIANTS = ['curtain', 'slideReveal'] as const;
export type ClosingVariant = (typeof CLOSING_VARIANTS)[number];

/** What a tenant that never chose gets. One place to change it. */
export const DEFAULT_CLOSING_VARIANT: ClosingVariant = 'curtain';

/** From this width on the waiting room stands beside the brand stage: "desktop". */
export const CLOSING_DESKTOP_MIN_WIDTH = 1200;

/** Contract value (TenantService `theming.closingAnimation*`) -> design. */
const BY_CONTRACT_VALUE: Record<string, ClosingVariant> = {
	CURTAIN: 'curtain',
	SLIDE_REVEAL: 'slideReveal'
};

/**
 * Which design this tenant chose for this kind of screen.
 *
 * Anything unrecognised — an older backend that does not send the fields, a
 * value from a newer Admin, a hand-edited row, the circle zoom that was taken
 * out before it was released — falls back to the platform default. A person must always be able to arrive; a setting can never be the
 * reason they cannot.
 */
export const resolveTenantClosingAnimation = (
	tenant: TenantDataInterface | null | undefined,
	desktop: boolean
): ClosingVariant => {
	const chosen = desktop
		? tenant?.theming?.closingAnimationDesktop
		: tenant?.theming?.closingAnimationMobile;
	return BY_CONTRACT_VALUE[chosen ?? ''] ?? DEFAULT_CLOSING_VARIANT;
};
