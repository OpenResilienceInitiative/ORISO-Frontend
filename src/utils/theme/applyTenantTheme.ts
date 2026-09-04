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

/**
 * Computes the palette from the stored seeds and injects it on the
 * given root element. Returns true when a palette was applied; false
 * keeps the prior static behaviour (no seed, or an invalid stored
 * value — logged, never thrown).
 *
 * Each seed is validated independently (#1256). An empty or invalid
 * accent/signal falls back for that field only; a valid sibling is
 * still applied. Only a missing or invalid primary discards the
 * tenant palette entirely.
 */
export const applyTenantPalette = (
	theming: TenantThemingSeedFields | null | undefined,
	root: HTMLElement = document.documentElement
): boolean => {
	const seeds = readTenantSeeds(theming);
	if (!seeds) {
		return false;
	}

	const primaryResult = tryComputePalette(
		{ primary: seeds.primary },
		(error) => {
			// eslint-disable-next-line no-console
			console.warn(
				'Tenant theming: stored seed is invalid, keeping the default palette.',
				error
			);
		}
	);
	if (!primaryResult) {
		return false;
	}
	if (primaryResult.tooPale) {
		// #143: a near-achromatic seed (chroma < TOO_PALE_CHROMA, e.g.
		// black or grey) cannot yield distinguishable role colours —
		// hover/container/shadow tints all collapse into one family.
		// Keep the compiled default palette instead of injecting it.
		// eslint-disable-next-line no-console
		console.warn(
			`Tenant theming: seed ${seeds.primary} is too pale (chroma < 12), keeping the default palette.`
		);
		return false;
	}

	const resolved: OrisoSeeds = { primary: seeds.primary };

	if (seeds.accent !== undefined) {
		const accentResult = tryComputePalette(
			{ primary: seeds.primary, accent: seeds.accent },
			(error) => {
				// eslint-disable-next-line no-console
				console.warn(
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
				// eslint-disable-next-line no-console
				console.warn(
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

	Object.entries(tokens).forEach(([name, value]) => {
		root.style.setProperty(name, value);
	});
	window.dispatchEvent(new CustomEvent(THEME_APPLIED_EVENT));
	return true;
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
