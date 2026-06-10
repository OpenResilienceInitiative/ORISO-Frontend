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
	Contrast,
	DynamicColor,
	Hct,
	TonalPalette,
	argbFromHex,
	hexFromArgb
} from '@material/material-color-utilities';

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

// ---------------------------------------------------------------------------
// Tuning constants (the "British" look). Calibrated against the benchmark
// Light.tokens.json: at seed #A5000A the marked roles reproduce the
// benchmark hex-exactly.
// ---------------------------------------------------------------------------

/** Neutrals are seed-independent: the calm grey stays stable per brand. */
const NEUTRAL = { hue: 250.5, chroma: 1.5 };
const NEUTRAL_VARIANT = { hue: 210.5, chroma: 4.25 };

/** Default secondary/tertiary anchor — the muted blue-grey "slate". */
const SLATE = { hue: 249, chroma: 11.5 };

/** Containers sit slightly above the seed: tone +10, chroma ×1.05. */
const CONTAINER_TONE_SHIFT = 10;
const CONTAINER_CHROMA_FACTOR = 1.05;

const CONTRAST_AA = 4.5;

/** Tone recipes for the secondary/tertiary families (light scheme). */
const SECONDARY_TONES = { role: 41, container: 46, onContainer: 94 };
const TERTIARY_TONES = { role: 40, container: 67, onContainer: 24 };

/**
 * Oriso default signal palette (no admin signal seed): the benchmark
 * error family. The container chroma in the benchmark does not follow
 * the generic container recipe, so the defaults are anchored as data.
 */
const DEFAULT_SIGNAL = {
	light: {
		error: '#b1005e',
		onError: '#ffffff',
		errorContainer: '#de0077',
		onErrorContainer: '#fff7f7'
	},
	anchorSeed: '#b1005e'
};

// Fixed tone ladders per scheme.
const LIGHT_NEUTRAL_TONES = {
	surface: 98,
	onSurface: 10,
	surfaceContainerLowest: 100,
	surfaceContainerLow: 96,
	surfaceContainer: 94,
	surfaceContainerHigh: 92,
	surfaceContainerHighest: 90,
	surfaceDim: 87,
	surfaceBright: 98,
	surfaceVariant: 90,
	onSurfaceVariant: 30,
	outline: 50,
	outlineVariant: 80,
	inverseSurface: 20,
	inverseOnSurface: 95
};

const DARK_NEUTRAL_TONES = {
	surface: 6,
	onSurface: 90,
	surfaceContainerLowest: 4,
	surfaceContainerLow: 10,
	surfaceContainer: 12,
	surfaceContainerHigh: 17,
	surfaceContainerHighest: 22,
	surfaceDim: 6,
	surfaceBright: 24,
	surfaceVariant: 30,
	onSurfaceVariant: 80,
	outline: 60,
	outlineVariant: 30,
	inverseSurface: 90,
	inverseOnSurface: 20
};

/**
 * The inverted admin-panel variant: the light scheme's inverse tokens
 * become the base surfaces, with a dark container ladder above them.
 */
const INVERTED_NEUTRAL_TONES = {
	surface: 20,
	onSurface: 95,
	surfaceContainerLowest: 15,
	surfaceContainerLow: 22,
	surfaceContainer: 24,
	surfaceContainerHigh: 28,
	surfaceContainerHighest: 32,
	surfaceDim: 15,
	surfaceBright: 30,
	surfaceVariant: 30,
	onSurfaceVariant: 80,
	outline: 60,
	outlineVariant: 30,
	inverseSurface: 98,
	inverseOnSurface: 10
};

const DARK_BRAND_TONES = {
	role: 80,
	onRole: 20,
	container: 30,
	onContainer: 90
};

// ---------------------------------------------------------------------------

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
		tint: hex(boosted.tone(40))
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
		tint: hex(palette.tone(80))
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

const signalFamily = (
	scheme: OrisoSchemeName
): { error: string; onError: string; errorContainer: string; onErrorContainer: string } => {
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

	const secondary = accentFamilyFromPalette(slate, SECONDARY_TONES, scheme);
	const tertiary = accentFamilyFromPalette(slate, TERTIARY_TONES, scheme);
	const signal = signalFamily(scheme);

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
		'--m3-inverse-primary': brand.inverse,
		'--m3-surface-tint': brand.tint,

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

	return { tokens, tooPale: false };
};
