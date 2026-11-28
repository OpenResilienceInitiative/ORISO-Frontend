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

/** Hover sits slightly below the role colour (darker in light scheme). */
export const HOVER_TONE_SHIFT = -8;

/**
 * Success is not a Material 3 role; ORISO needs one for form states.
 * Seed-independent anchor — the legacy light value, dark from its palette.
 */
export const SUCCESS_ANCHOR = '#0a882f';

/** WCAG-AA body-text contrast; drives every on-colour decision. */
export const CONTRAST_AA = 4.5;

/**
 * The darkest light surface brand-coloured text sits on
 * (surface-container-highest). `--oriso-primary-text` must reach
 * CONTRAST_AA on it (#1499: a light-blue Träger seed gave 1.2:1).
 */
export const PRIMARY_TEXT_SURFACE_TONE = 90;

/** Tone recipes for the secondary/tertiary families (light scheme). */
export const SECONDARY_TONES = { role: 36, container: 46, onContainer: 95 };
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

/**
 * Dark scheme surfaces (FE#1134, Frank 28 Nov 2026): no near-black. The chat
 * sat on tone 4 (#0e0e0f) because the light scheme puts it on white, the
 * lowest container; in dark that read like a high-contrast mode. The ladder
 * starts at tone 11 and keeps the M3 order lowest <= surface <= low <= ... .
 * High contrast keeps the deep ladder below.
 */
export const DARK_NEUTRAL_TONES: NeutralToneLadder = {
	surface: 12,
	onSurface: 90,
	surfaceContainerLowest: 11,
	surfaceContainerLow: 14,
	surfaceContainer: 16,
	surfaceContainerHigh: 19,
	surfaceContainerHighest: 23,
	surfaceDim: 11,
	surfaceBright: 26,
	surfaceVariant: 30,
	onSurfaceVariant: 80,
	outline: 60,
	outlineVariant: 30,
	inverseSurface: 90,
	inverseOnSurface: 20
};

/** The previous deep-black dark ladder, kept for dark + high contrast. */
export const DARK_DEEP_NEUTRAL_TONES: NeutralToneLadder = {
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

/**
 * Ink tones for the personal "high" contrast level. Fills stay the scheme's
 * own (product decision: the look keeps its surfaces); only text, icons and
 * borders move toward black (light) or white (dark), so the choice is
 * visible even where the standard palette already passes 7:1.
 */
export const HIGH_CONTRAST_INK_TONES: Record<
	'light' | 'dark',
	Pick<
		NeutralToneLadder,
		'onSurface' | 'onSurfaceVariant' | 'outline' | 'outlineVariant'
	>
> = {
	light: {
		onSurface: 0,
		onSurfaceVariant: 20,
		outline: 30,
		outlineVariant: 50
	},
	dark: {
		onSurface: 100,
		onSurfaceVariant: 92,
		outline: 80,
		outlineVariant: 60
	}
};

/**
 * The calm accent of the dark scheme (FE#1134). In light, the brand's pale
 * rose (`primary-fixed`, tone 90) is a soft fill on white. M3 keeps fixed
 * roles identical in every scheme, so on black the same rose turned into the
 * loudest thing on screen and read like an active state.
 *
 * Token logic (Frank, 2026-11-28): the dark counterpart is computed from the
 * brand colour, `fill` on the brand hue (ORISO red gives the muted wine-red
 * #59302b), unless the Träger sets `primaryDark`, or the person chooses the
 * original brand colour. The Admin stage tone #281715 (Figma
 * `M3/sys/light/on-background`) is the darker alternative at chroma 11.4,
 * tone 10. `dimStep` places `primary-fixed-dim` one step further from the
 * ink; `mid` is the calm accent for resting outlines and handles (at least
 * 3:1 on every dark surface); `ink` is the text tone on fills.
 */
export const DARK_CALM_ACCENT = {
	fill: { chroma: 24, tone: 25 },
	/** Tone step from the fill to `fixed-dim`, away from the ink. */
	dimStep: 7,
	/** Tone step of the stage gradient (container above, edge below). */
	stageStep: 10,
	mid: { chroma: 20, tone: 55 },
	ink: 90
};

/** Brand family tones for the dark and inverted schemes. */
export const DARK_BRAND_TONES = {
	role: 80,
	onRole: 20,
	container: 30,
	onContainer: 90
};
