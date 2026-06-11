/**
 * OrisoScheme tuning constants — the entire "British" look as data
 * (Frontend#133). A central re-tune of the platform's appearance happens
 * here and nowhere else; both consumers (admin preview, live frontend)
 * pick it up through the shared engine.
 *
 * Calibrated against the benchmark `Light.tokens.json` (seed #A5000A):
 * with these values the engine reproduces the 9 Admin contract tokens
 * hex-exactly and every other locked role within HCT tone ±1 / ΔE2000 ≤ 2
 * — guarded by the golden test in orisoScheme.test.ts.
 */

/**
 * Neutrals are deliberately seed-independent: the calm grey surfaces stay
 * stable no matter which brand colour a Träger picks. Hue/chroma pairs
 * feed `TonalPalette.fromHueAndChroma`.
 */
export const NEUTRAL = { hue: 250.5, chroma: 1.5 };
export const NEUTRAL_VARIANT = { hue: 210.5, chroma: 4.25 };

/** Default secondary/tertiary anchor — the muted blue-grey "slate". */
export const SLATE = { hue: 249, chroma: 11.5 };

/** Containers sit slightly above the seed: tone +10, chroma ×1.05. */
export const CONTAINER_TONE_SHIFT = 10;
export const CONTAINER_CHROMA_FACTOR = 1.05;

/** WCAG-AA body-text contrast; drives every on-colour decision. */
export const CONTRAST_AA = 4.5;

/** Tone recipes for the secondary/tertiary families (light scheme). */
export const SECONDARY_TONES = { role: 41, container: 46, onContainer: 94 };
export const TERTIARY_TONES = { role: 40, container: 67, onContainer: 24 };

/**
 * Accent seeds are tamed: chroma capped so a neon accent cannot break
 * the calm look (slate sits at 11.5; 24 still reads clearly coloured).
 */
export const ACCENT_MAX_CHROMA = 24;

/**
 * Seeds with less chroma than this cannot carry a brand palette —
 * the admin gets a "too pale" warning (saving stays allowed, UAT-F).
 */
export const TOO_PALE_CHROMA = 12;

/**
 * Oriso default signal palette (no admin signal seed): the benchmark
 * error family. The container chroma in the benchmark does not follow
 * the generic container recipe, so the defaults are anchored as data.
 */
export const DEFAULT_SIGNAL = {
	light: {
		error: '#b1005e',
		onError: '#ffffff',
		errorContainer: '#de0077',
		onErrorContainer: '#fff7f7'
	},
	anchorSeed: '#b1005e'
};

export interface NeutralToneLadder {
	surface: number;
	onSurface: number;
	surfaceContainerLowest: number;
	surfaceContainerLow: number;
	surfaceContainer: number;
	surfaceContainerHigh: number;
	surfaceContainerHighest: number;
	surfaceDim: number;
	surfaceBright: number;
	surfaceVariant: number;
	onSurfaceVariant: number;
	outline: number;
	outlineVariant: number;
	inverseSurface: number;
	inverseOnSurface: number;
}

export const LIGHT_NEUTRAL_TONES: NeutralToneLadder = {
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

export const DARK_NEUTRAL_TONES: NeutralToneLadder = {
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
export const INVERTED_NEUTRAL_TONES: NeutralToneLadder = {
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

/** Brand family tones for the dark and inverted schemes. */
export const DARK_BRAND_TONES = {
	role: 80,
	onRole: 20,
	container: 30,
	onContainer: 90
};
