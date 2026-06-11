/**
 * OrisoScheme — the tuned Material 3 colour engine (THB-01).
 *
 * Turns up to three admin-chosen seed colours into the full M3 role
 * palette, keyed by the `--m3-*` CSS custom property names that the
 * ORISO app layer consumes. The tuning reproduces the hand-crafted
 * benchmark `Light.tokens.json` (seed #A5000A): a calm, slightly greyed
 * look — stable cool neutrals instead of stock-M3 seed-tinted pastels.
 *
 * Pure module: same input → same output. No DOM, no network.
 */
import {
	Blend,
	Contrast,
	DynamicColor,
	Hct,
	TonalPalette,
	argbFromHex,
	hexFromArgb
} from '@material/material-color-utilities';

import {
	ACCENT_MAX_CHROMA,
	CONTAINER_CHROMA_FACTOR,
	CONTAINER_TONE_SHIFT,
	CONTRAST_AA,
	HOVER_TONE_SHIFT,
	DARK_BRAND_TONES,
	DARK_NEUTRAL_TONES,
	DEFAULT_SIGNAL,
	INVERTED_NEUTRAL_TONES,
	LIGHT_NEUTRAL_TONES,
	NEUTRAL,
	NEUTRAL_VARIANT,
	SECONDARY_TONES,
	SLATE,
	SUCCESS_ANCHOR,
	TERTIARY_TONES,
	TOO_PALE_CHROMA
} from './orisoTuning';

export type OrisoSchemeName = 'light' | 'dark' | 'inverted';

export interface OrisoSeeds {
	/** Required Träger brand colour; drives the whole palette. */
	primary: string;
	/** Optional accent; harmonised toward the primary seed. */
	accent?: string;
	/** Optional signal/error colour; Oriso default tones when unset. */
	signal?: string;
}

export interface OrisoPaletteResult {
	/** Role map keyed by `--m3-*` token name, values `#rrggbb`. */
	tokens: Record<string, string>;
	/** True when the primary seed is too grey to carry a brand palette. */
	tooPale: boolean;
}

const HEX_PATTERN = /^#[0-9a-f]{6}$/;

const normalizeHex = (value: string, label: string): string => {
	const hex = value.trim().toLowerCase();
	const withHash = hex.startsWith('#') ? hex : `#${hex}`;
	// Expand #rgb shorthand for robustness.
	const expanded =
		withHash.length === 4
			? `#${withHash[1]}${withHash[1]}${withHash[2]}${withHash[2]}${withHash[3]}${withHash[3]}`
			: withHash;
	if (!HEX_PATTERN.test(expanded)) {
		throw new Error(
			`OrisoScheme: ${label} seed is not a valid hex colour: "${value}"`
		);
	}
	return expanded;
};

const hex = (argb: number): string => hexFromArgb(argb).toLowerCase();

const clampTone = (tone: number): number => Math.min(100, Math.max(0, tone));

interface BrandFamily {
	role: string;
	onRole: string;
	container: string;
	onContainer: string;
	inverse: string;
	tint: string;
	hover: string;
	fixed: string;
	onFixed: string;
	onFixedVariant: string;
}

/**
 * The Oriso brand recipe (light): the seed itself is the role colour —
 * brand fidelity over stock-M3 tone snapping — and the container sits
 * just above it. Contrast of the on-colours is guaranteed by
 * construction (white only when it reaches AA, dark text otherwise).
 */
const lightBrandFamily = (seedHex: string): BrandFamily => {
	const argb = argbFromHex(seedHex);
	const hct = Hct.fromInt(argb);
	const palette = TonalPalette.fromInt(argb);
	const boosted = TonalPalette.fromHueAndChroma(
		hct.hue,
		hct.chroma * CONTAINER_CHROMA_FACTOR
	);

	const onRole =
		Contrast.ratioOfTones(100, hct.tone) >= CONTRAST_AA
			? '#ffffff'
			: hex(palette.tone(10));

	const containerTone = clampTone(
		Math.round(hct.tone) + CONTAINER_TONE_SHIFT
	);
	const onContainerTone = Math.round(
		DynamicColor.foregroundTone(containerTone, CONTRAST_AA)
	);

	return {
		role: seedHex,
		onRole,
		container: hex(boosted.tone(containerTone)),
		onContainer: hex(palette.tone(onContainerTone)),
		inverse: hex(palette.tone(80)),
		tint: hex(boosted.tone(40)),
		hover: hex(palette.tone(clampTone(Math.round(hct.tone) + HOVER_TONE_SHIFT))),
		// Fixed roles keep the same tones in every scheme (M3 spec).
		fixed: hex(palette.tone(90)),
		onFixed: hex(palette.tone(10)),
		onFixedVariant: hex(palette.tone(30))
	};
};

const darkBrandFamily = (seedHex: string): BrandFamily => {
	const argb = argbFromHex(seedHex);
	const palette = TonalPalette.fromInt(argb);
	return {
		role: hex(palette.tone(DARK_BRAND_TONES.role)),
		onRole: hex(palette.tone(DARK_BRAND_TONES.onRole)),
		container: hex(palette.tone(DARK_BRAND_TONES.container)),
		onContainer: hex(palette.tone(DARK_BRAND_TONES.onContainer)),
		inverse: hex(palette.tone(40)),
		tint: hex(palette.tone(80)),
		hover: hex(palette.tone(clampTone(DARK_BRAND_TONES.role - HOVER_TONE_SHIFT))),
		fixed: hex(palette.tone(90)),
		onFixed: hex(palette.tone(10)),
		onFixedVariant: hex(palette.tone(30))
	};
};

interface AccentFamily {
	role: string;
	onRole: string;
	container: string;
	onContainer: string;
}

const accentFamilyFromPalette = (
	palette: TonalPalette,
	tones: { role: number; container: number; onContainer: number },
	scheme: OrisoSchemeName
): AccentFamily => {
	if (scheme === 'light') {
		const onRole =
			Contrast.ratioOfTones(100, tones.role) >= CONTRAST_AA
				? '#ffffff'
				: hex(palette.tone(10));
		return {
			role: hex(palette.tone(tones.role)),
			onRole,
			container: hex(palette.tone(tones.container)),
			onContainer: hex(palette.tone(tones.onContainer))
		};
	}
	return {
		role: hex(palette.tone(DARK_BRAND_TONES.role)),
		onRole: hex(palette.tone(DARK_BRAND_TONES.onRole)),
		container: hex(palette.tone(DARK_BRAND_TONES.container)),
		onContainer: hex(palette.tone(DARK_BRAND_TONES.onContainer))
	};
};

/**
 * Error family: a custom signal seed goes through the same
 * brand-fidelity recipe as the primary; without one, the benchmark-
 * anchored Oriso defaults apply.
 */
const signalFamily = (
	scheme: OrisoSchemeName,
	signalSeed?: string
): {
	error: string;
	onError: string;
	errorContainer: string;
	onErrorContainer: string;
} => {
	if (signalSeed) {
		const family =
			scheme === 'light'
				? lightBrandFamily(signalSeed)
				: darkBrandFamily(signalSeed);
		return {
			error: family.role,
			onError: family.onRole,
			errorContainer: family.container,
			onErrorContainer: family.onContainer
		};
	}
	if (scheme === 'light') {
		return DEFAULT_SIGNAL.light;
	}
	const palette = TonalPalette.fromInt(
		argbFromHex(DEFAULT_SIGNAL.anchorSeed)
	);
	return {
		error: hex(palette.tone(DARK_BRAND_TONES.role)),
		onError: hex(palette.tone(DARK_BRAND_TONES.onRole)),
		errorContainer: hex(palette.tone(DARK_BRAND_TONES.container)),
		onErrorContainer: hex(palette.tone(DARK_BRAND_TONES.onContainer))
	};
};

/**
 * Accent palette: hue pulled toward the primary (Blend.harmonize),
 * chroma capped to keep the calm look.
 */
const harmonizedAccentPalette = (
	accentSeed: string,
	primarySeed: string
): TonalPalette => {
	const harmonized = Blend.harmonize(
		argbFromHex(accentSeed),
		argbFromHex(primarySeed)
	);
	const hct = Hct.fromInt(harmonized);
	return TonalPalette.fromHueAndChroma(
		hct.hue,
		Math.min(hct.chroma, ACCENT_MAX_CHROMA)
	);
};

/**
 * Computes the full Oriso role palette for the given seeds and scheme.
 *
 * Throws on syntactically invalid seeds — callers (admin preview,
 * runtime theming) catch and fall back; the engine itself stays pure.
 */
export const computeOrisoPalette = (
	seeds: OrisoSeeds,
	scheme: OrisoSchemeName
): OrisoPaletteResult => {
	const primarySeed = normalizeHex(seeds.primary, 'primary');
	const accentSeed =
		seeds.accent === undefined
			? undefined
			: normalizeHex(seeds.accent, 'accent');
	const signalSeed =
		seeds.signal === undefined
			? undefined
			: normalizeHex(seeds.signal, 'signal');

	const neutral = TonalPalette.fromHueAndChroma(NEUTRAL.hue, NEUTRAL.chroma);
	const variant = TonalPalette.fromHueAndChroma(
		NEUTRAL_VARIANT.hue,
		NEUTRAL_VARIANT.chroma
	);
	const slate = TonalPalette.fromHueAndChroma(SLATE.hue, SLATE.chroma);

	const brand =
		scheme === 'light'
			? lightBrandFamily(primarySeed)
			: darkBrandFamily(primarySeed);

	const secondaryPalette = accentSeed
		? harmonizedAccentPalette(accentSeed, primarySeed)
		: slate;
	const secondary = accentFamilyFromPalette(
		secondaryPalette,
		SECONDARY_TONES,
		scheme
	);
	const tertiary = accentFamilyFromPalette(slate, TERTIARY_TONES, scheme);
	const signal = signalFamily(scheme, signalSeed);

	const neutralTones =
		scheme === 'light'
			? LIGHT_NEUTRAL_TONES
			: scheme === 'dark'
				? DARK_NEUTRAL_TONES
				: INVERTED_NEUTRAL_TONES;

	const tokens: Record<string, string> = {
		'--m3-primary': brand.role,
		'--m3-on-primary': brand.onRole,
		'--m3-primary-container': brand.container,
		'--m3-on-primary-container': brand.onContainer,
		'--m3-primary-hover': brand.hover,
		'--m3-primary-fixed': brand.fixed,
		'--m3-on-primary-fixed': brand.onFixed,
		'--m3-on-primary-fixed-variant': brand.onFixedVariant,
		'--m3-inverse-primary': brand.inverse,
		'--m3-surface-tint': brand.tint,
		'--m3-success':
			scheme === 'light'
				? SUCCESS_ANCHOR
				: hex(
						TonalPalette.fromInt(argbFromHex(SUCCESS_ANCHOR)).tone(
							DARK_BRAND_TONES.role
						)
					),

		'--m3-secondary': secondary.role,
		'--m3-on-secondary': secondary.onRole,
		'--m3-secondary-container': secondary.container,
		'--m3-on-secondary-container': secondary.onContainer,

		'--m3-tertiary': tertiary.role,
		'--m3-on-tertiary': tertiary.onRole,
		'--m3-tertiary-container': tertiary.container,
		'--m3-on-tertiary-container': tertiary.onContainer,

		'--m3-error': signal.error,
		'--m3-on-error': signal.onError,
		'--m3-error-container': signal.errorContainer,
		'--m3-on-error-container': signal.onErrorContainer,

		'--m3-surface': hex(neutral.tone(neutralTones.surface)),
		'--m3-on-surface': hex(neutral.tone(neutralTones.onSurface)),
		'--m3-surface-container-lowest': hex(
			neutral.tone(neutralTones.surfaceContainerLowest)
		),
		'--m3-surface-container-low': hex(
			neutral.tone(neutralTones.surfaceContainerLow)
		),
		'--m3-surface-container': hex(
			neutral.tone(neutralTones.surfaceContainer)
		),
		'--m3-surface-container-high': hex(
			neutral.tone(neutralTones.surfaceContainerHigh)
		),
		'--m3-surface-container-highest': hex(
			neutral.tone(neutralTones.surfaceContainerHighest)
		),
		'--m3-surface-dim': hex(neutral.tone(neutralTones.surfaceDim)),
		'--m3-surface-bright': hex(neutral.tone(neutralTones.surfaceBright)),
		'--m3-background': hex(neutral.tone(neutralTones.surface)),
		'--m3-on-background': hex(neutral.tone(neutralTones.onSurface)),
		'--m3-inverse-surface': hex(neutral.tone(neutralTones.inverseSurface)),
		'--m3-inverse-on-surface': hex(
			neutral.tone(neutralTones.inverseOnSurface)
		),

		'--m3-surface-variant': hex(variant.tone(neutralTones.surfaceVariant)),
		'--m3-on-surface-variant': hex(
			variant.tone(neutralTones.onSurfaceVariant)
		),
		'--m3-outline': hex(variant.tone(neutralTones.outline)),
		'--m3-outline-variant': hex(variant.tone(neutralTones.outlineVariant)),

		'--m3-shadow': '#000000',
		'--m3-scrim': '#000000'
	};

	const tooPale =
		Hct.fromInt(argbFromHex(primarySeed)).chroma < TOO_PALE_CHROMA;

	return { tokens, tooPale };
};
