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
	computeOrisoPalette,
	normalizeHex
} from './orisoScheme';
import { THEME_APPLIED_EVENT } from './themeEvents';

export { THEME_APPLIED_EVENT } from './themeEvents';

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

export interface TenantThemingSeedFields {
	primaryColor?: string | null;
	secondaryColor?: string | null;
	accent?: string | null;
	signal?: string | null;
}

/**
 * Blank (empty or whitespace) is absent — the same as a missing field.
 * Nullish coalescing is not enough: `"" ?? undefined` is still `""`.
 */
const absentIfBlank = (value?: string | null): string | undefined => {
	if (value == null) {
		return undefined;
	}
	const trimmed = value.trim();
	return trimmed === '' ? undefined : trimmed;
};

/**
 * Reads the seed set from the tenant theming. Legacy records carry only
 * `primaryColor` (plus a historically mirrored `secondaryColor`, which
 * is computed-not-stored and ignored here) — that value is the primary
 * seed. Returns null when no seed is stored.
 *
 * Every seed field is normalised independently: empty string and
 * whitespace are treated as absent (#1256). Invalid hex is left for
 * `applyTenantPalette` so that field can fall back without discarding
 * the others.
 */
export const readTenantSeeds = (
	theming?: TenantThemingSeedFields | null
): OrisoSeeds | null => {
	const primary = absentIfBlank(theming?.primaryColor);
	if (!primary) {
		return null;
	}
	return {
		primary,
		accent: absentIfBlank(theming?.accent),
		signal: absentIfBlank(theming?.signal)
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
 * Custom properties a tenant palette put on a root, so they can be taken off
 * again. Theme Builder preview tokens are deliberately not tracked: the
 * preview is independent of tenant resolution and must survive a reset (#1788).
 */
const appliedTokens = new WeakMap<HTMLElement, Set<string>>();

const setPaletteTokens = (
	root: HTMLElement,
	tokens: Record<string, string>,
	track: boolean
) => {
	Object.entries(tokens).forEach(([name, value]) =>
		root.style.setProperty(name, value)
	);
	if (!track) {
		return;
	}
	const names = appliedTokens.get(root) ?? new Set<string>();
	Object.keys(tokens).forEach((name) => names.add(name));
	appliedTokens.set(root, names);
};

/**
 * Takes back what `applyTenantPalette` set, so the compiled default palette
 * applies again (#1788). A Theme Builder preview palette stays.
 */
export const resetTenantPalette = (
	root: HTMLElement = document.documentElement
): void => {
	const names = appliedTokens.get(root);
	if (!names?.size) {
		return;
	}
	names.forEach((name) => root.style.removeProperty(name));
	appliedTokens.delete(root);
	window.dispatchEvent(new CustomEvent(THEME_APPLIED_EVENT));
};

const tryComputePalette = (
	seeds: OrisoSeeds,
	onError: (error: unknown) => void
): ReturnType<typeof computeOrisoPalette> | null => {
	try {
		return computeOrisoPalette(seeds, 'light');
	} catch (error) {
		onError(error);
		return null;
	}
};

/** Reports why a stored seed was not used; the call asks without logging. */
type SeedWarning = (...args: unknown[]) => void;

interface ResolvedTenantPalette {
	/** The seeds that actually went into the palette, normalised `#rrggbb`. */
	seeds: OrisoSeeds;
	tokens: Record<string, string>;
}

/**
 * The one place that decides which stored seeds the app paints with, so
 * `applyTenantPalette` and everything that has to look the same (the video
 * call, #2188) cannot disagree.
 *
 * Each seed is validated independently (#1256). An empty or invalid
 * accent/signal falls back for that field only; a valid sibling is
 * still applied. Only a missing or invalid primary discards the
 * tenant palette entirely.
 */
const resolveTenantPalette = (
	theming: TenantThemingSeedFields | null | undefined,
	warn: SeedWarning
): ResolvedTenantPalette | null => {
	const seeds = readTenantSeeds(theming);
	if (!seeds) {
		return null;
	}

	const primaryResult = tryComputePalette(
		{ primary: seeds.primary },
		(error) => {
			warn(
				'Tenant theming: stored seed is invalid, keeping the default palette.',
				error
			);
		}
	);
	if (!primaryResult) {
		return null;
	}
	if (primaryResult.tooPale) {
		// #143: a near-achromatic seed (chroma < TOO_PALE_CHROMA, e.g.
		// black or grey) cannot yield distinguishable role colours —
		// hover/container/shadow tints all collapse into one family.
		// Keep the compiled default palette instead of injecting it.
		warn(
			`Tenant theming: seed ${seeds.primary} is too pale (chroma < 12), keeping the default palette.`
		);
		return null;
	}

	const resolved: OrisoSeeds = { primary: seeds.primary };

	if (seeds.accent !== undefined) {
		const accentResult = tryComputePalette(
			{ primary: seeds.primary, accent: seeds.accent },
			(error) => {
				warn(
					'Tenant theming: accent seed is invalid, falling back.',
					error
				);
			}
		);
		if (accentResult) {
			resolved.accent = seeds.accent;
		}
	}

	if (seeds.signal !== undefined) {
		const signalResult = tryComputePalette(
			{ primary: seeds.primary, signal: seeds.signal },
			(error) => {
				warn(
					'Tenant theming: signal seed is invalid, falling back.',
					error
				);
			}
		);
		if (signalResult) {
			resolved.signal = seeds.signal;
		}
	}

	const { tokens } =
		resolved.accent === undefined && resolved.signal === undefined
			? primaryResult
			: computeOrisoPalette(resolved, 'light');

	// Every seed above already went through the engine, so none of these throw.
	return {
		seeds: {
			primary: normalizeHex(resolved.primary, 'primary'),
			...(resolved.accent !== undefined && {
				accent: normalizeHex(resolved.accent, 'accent')
			}),
			...(resolved.signal !== undefined && {
				signal: normalizeHex(resolved.signal, 'signal')
			})
		},
		tokens
	};
};

/**
 * The seeds the app applies for this theming, normalised to `#rrggbb`, or
 * null when it keeps the compiled default palette (no or invalid or too pale
 * primary). An invalid accent or signal is left out on its own.
 *
 * Silent: the app already logged the reason when it applied the palette.
 * For the video call, which has to hand the Träger's brand to a separate
 * origin and must never send what the app itself would not paint (#2188).
 */
export const resolveTenantSeeds = (
	theming: TenantThemingSeedFields | null | undefined
): OrisoSeeds | null => resolveTenantPalette(theming, () => {})?.seeds ?? null;

/**
 * Computes the palette from the stored seeds and injects it on the
 * given root element. Returns true when a palette was applied; false
 * keeps the prior static behaviour (no seed, or an invalid stored
 * value — logged, never thrown).
 *
 * Which seeds count is decided by `resolveTenantPalette`: each is validated
 * independently (#1256), and only a missing or invalid primary discards the
 * tenant palette entirely.
 */
export const applyTenantPalette = (
	theming: TenantThemingSeedFields | null | undefined,
	root: HTMLElement = document.documentElement
): boolean => {
	const palette = resolveTenantPalette(theming, (...args) => {
		// eslint-disable-next-line no-console
		console.warn(...args);
	});
	if (!palette) {
		return false;
	}

	setPaletteTokens(root, palette.tokens, true);
	window.dispatchEvent(new CustomEvent(THEME_APPLIED_EVENT));
	return true;
};

const PREVIEW_PARAMS = {
	primary: 'themePreviewPrimary',
	accent: 'themePreviewAccent',
	signal: 'themePreviewSignal'
} as const;

export const THEME_PREVIEW_PATH = '/theme-demo';

/**
 * Preview seeds are only meaningful on the auth-free demo route the admin's
 * Theme Builder iframe loads (ORISO-Admin#907). Reading them anywhere else
 * lets a shared link repaint the real app — including with the pale palettes
 * `applyTenantPalette` refuses for stored tenant seeds (#143).
 */
export const isThemePreviewRoute = (pathname: string): boolean =>
	pathname.replace(/\/+$/, '') === THEME_PREVIEW_PATH;

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
		const { tokens, tooPale } = computeOrisoPalette(seeds, 'light');
		if (tooPale) {
			// Preview (Theme Builder sandbox) deliberately still applies:
			// an admin evaluating a pale seed must see the degenerate
			// result the guard protects real tenants from.
			// eslint-disable-next-line no-console
			console.warn(
				`Theme preview: seed ${seeds.primary} is too pale (chroma < 12); a stored tenant seed like this would be ignored.`
			);
		}
		setPaletteTokens(root, tokens, false);
		window.dispatchEvent(new CustomEvent(THEME_APPLIED_EVENT));
		return true;
	} catch (error) {
		// eslint-disable-next-line no-console
		console.warn('Theme preview: invalid seeds ignored.', error);
		return false;
	}
};
