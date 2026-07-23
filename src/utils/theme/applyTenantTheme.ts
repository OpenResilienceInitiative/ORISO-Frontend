/**
 * Runtime palette application (THB-05, frontend-specific — not part of
 * the vendored engine): stored tenant seeds → OrisoScheme engine →
 * `--m3-*` custom properties on the document root.
 *
 * The inline style on the root element wins over the static
 * mui-variables-mapping.scss definitions, so with no stored seed the
 * compiled legacy palette keeps applying unchanged (UAT-E).
 */
import {
	OrisoSchemeName,
	OrisoSeeds,
	computeOrisoPalette
} from './orisoScheme';

/** Dispatched on window after a palette landed at :root. */
export const THEME_APPLIED_EVENT = 'oriso:theme-applied';

/**
 * Scheme activation flags: dark stays off until the dark end-user
 * scheme ships; inverted is the admin-panel variant (THB-06). Adding a
 * scheme later means flipping a flag — no consumer change (UAT-I).
 */
export const ACTIVE_SCHEMES: Record<OrisoSchemeName, boolean> = {
	light: true,
	dark: false,
	inverted: false
};

interface TenantThemingSeedFields {
	primaryColor?: string | null;
	secondaryColor?: string | null;
	accent?: string | null;
	signal?: string | null;
}

/**
 * Reads the seed set from the tenant theming. Legacy records carry only
 * `primaryColor` (plus a historically mirrored `secondaryColor`, which
 * is computed-not-stored and ignored here) — that value is the primary
 * seed. Returns null when no seed is stored.
 */
export const readTenantSeeds = (
	theming?: TenantThemingSeedFields | null
): OrisoSeeds | null => {
	if (!theming?.primaryColor) {
		return null;
	}
	return {
		primary: theming.primaryColor,
		accent: theming.accent ?? undefined,
		signal: theming.signal ?? undefined
	};
};

/** The full scheme-keyed variable map from one seed set (UAT-I). */
export const computeOrisoSchemes = (
	seeds: OrisoSeeds
): Record<OrisoSchemeName, Record<string, string>> => ({
	light: computeOrisoPalette(seeds, 'light').tokens,
	dark: computeOrisoPalette(seeds, 'dark').tokens,
	inverted: computeOrisoPalette(seeds, 'inverted').tokens
});

/**
 * Computes the palette from the stored seeds and injects it on the
 * given root element. Returns true when a palette was applied; false
 * keeps the prior static behaviour (no seed, or an invalid stored
 * value — logged, never thrown).
 */
export const applyTenantPalette = (
	theming: TenantThemingSeedFields | null | undefined,
	root: HTMLElement = document.documentElement
): boolean => {
	const seeds = readTenantSeeds(theming);
	if (!seeds) {
		return false;
	}
	try {
		const { tokens } = computeOrisoPalette(seeds, 'light');
		Object.entries(tokens).forEach(([name, value]) => {
			root.style.setProperty(name, value);
		});
		window.dispatchEvent(new CustomEvent(THEME_APPLIED_EVENT));
		return true;
	} catch (error) {
		// eslint-disable-next-line no-console
		console.warn(
			'Tenant theming: stored seed is invalid, keeping the default palette.',
			error
		);
		return false;
	}
};

const PREVIEW_PARAMS = {
	primary: 'themePreviewPrimary',
	accent: 'themePreviewAccent',
	signal: 'themePreviewSignal'
} as const;

/** Bare 6-digit hex only — anything else is ignored (no injection surface). */
const BARE_HEX = /^[0-9a-fA-F]{6}$/;

/**
 * Theme Builder preview mode (decided 2026-06-11): the admin embeds the
 * real app in a sandboxed iframe and passes draft seeds via query
 * params. Strictly validated colour values, applied client-side as CSS
 * custom properties only — no persistence, no behavioural change.
 */
export const readPreviewSeeds = (search: string): OrisoSeeds | null => {
	const params = new URLSearchParams(search);
	const read = (name: string): string | undefined => {
		const value = params.get(name);
		return value && BARE_HEX.test(value)
			? `#${value.toLowerCase()}`
			: undefined;
	};
	const primary = read(PREVIEW_PARAMS.primary);
	if (!primary) {
		return null;
	}
	return {
		primary,
		accent: read(PREVIEW_PARAMS.accent),
		signal: read(PREVIEW_PARAMS.signal)
	};
};

/**
 * Applies the preview seeds from the given query string. Returns true
 * when a preview palette landed — callers skip the tenant palette then
 * (the preview wins).
 */
export const applyPreviewFromLocation = (
	search: string,
	root: HTMLElement = document.documentElement
): boolean => {
	const seeds = readPreviewSeeds(search);
	if (!seeds) {
		return false;
	}
	try {
		const { tokens } = computeOrisoPalette(seeds, 'light');
		Object.entries(tokens).forEach(([name, value]) => {
			root.style.setProperty(name, value);
		});
		window.dispatchEvent(new CustomEvent(THEME_APPLIED_EVENT));
		return true;
	} catch (error) {
		// eslint-disable-next-line no-console
		console.warn('Theme preview: invalid seeds ignored.', error);
		return false;
	}
};
