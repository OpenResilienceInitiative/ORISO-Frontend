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
	DARK_CALM_ACCENT,
	DARK_DEEP_NEUTRAL_TONES,
	DARK_NEUTRAL_TONES,
	DEFAULT_SIGNAL,
	HIGH_CONTRAST_INK_TONES,
	INVERTED_NEUTRAL_TONES,
	LIGHT_NEUTRAL_TONES,
	NEUTRAL,
	NEUTRAL_VARIANT,
	PRIMARY_TEXT_SURFACE_TONE,
	SECONDARY_TONES,
	SLATE,
	SUCCESS_ANCHOR,
	TERTIARY_TONES,
	TOO_PALE_CHROMA
} from './orisoTuning';
import { wcagContrast } from './wcagContrast';
import { enhanceOrisoContrast } from './enhanceOrisoContrast';

export type OrisoSchemeName = 'light' | 'dark' | 'inverted';
export type ContrastLevel = 'standard' | 'medium' | 'high';

export interface OrisoSeeds {
	/** Required Träger brand colour; drives the whole palette. */
	primary: string;
	/** Optional accent; harmonised toward the primary seed. */
	accent?: string;
	/** Optional signal/error colour; Oriso default tones when unset. */
	signal?: string;
	/**
	 * Optional Träger override for the dark accent fill (FE#1134). Unset, the
	 * engine computes the calm dark counterpart from `primary`. An override
	 * that cannot carry readable ink is ignored like a too-pale seed.
	 */
	primaryDark?: string;
}

/**
 * How the dark scheme paints brand fills (FE#1134): `counterpart` is the calm
 * dark counterpart of the brand colour (computed, or the Träger override);
 * `original` keeps the brand colour itself, e.g. ORISO red.
 */
export type DarkBrandMode = 'counterpart' | 'original';

export interface OrisoPaletteOptions {
	darkBrand?: DarkBrandMode;
}

export interface OrisoPaletteResult {
	/** Role map keyed by `--m3-*` token name, values `#rrggbb`. */
	tokens: Record<string, string>;
	/** True when the primary seed is too grey to carry a brand palette. */
	tooPale: boolean;
}

const HEX_PATTERN = /^#[0-9a-f]{6}$/;

/** Trimmed, lower-case `#rrggbb`; `#rgb` is expanded. Throws on anything else. */
export const normalizeHex = (value: string, label: string): string => {
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
	/** The role as a text/icon colour on light surfaces; always AA. */
	text: string;
	/** Hover of `text`: a step darker than it, so hover never fades. */
	textHover: string;
	container: string;
	onContainer: string;
	inverse: string;
	tint: string;
	hover: string;
	fixed: string;
	fixedDim: string;
	onFixed: string;
	onFixedVariant: string;
}

/**
 * Lightest tone brand-coloured text may have: AA on the darkest light
 * surface that carries it. Floored so hex rounding cannot dip below.
 */
const MAX_LEGIBLE_TEXT_TONE = Math.floor(
	Contrast.darker(PRIMARY_TEXT_SURFACE_TONE, CONTRAST_AA)
);

/**
 * The Oriso brand recipe (light): the seed itself is the role colour —
 * brand fidelity over stock-M3 tone snapping — and the container sits
 * just above it. Contrast of the on-colours is guaranteed by
 * construction (white only when it reaches AA, dark text otherwise).
 */
const containerPalette = (palette: TonalPalette): TonalPalette =>
	TonalPalette.fromHueAndChroma(
		palette.hue,
		palette.chroma * CONTAINER_CHROMA_FACTOR
	);

const lightBrandFamily = (
	seedHex: string,
	palette: TonalPalette,
	boosted: TonalPalette
): BrandFamily => {
	const hct = Hct.fromInt(argbFromHex(seedHex));

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
		// Fills keep the seed; text drawn IN the brand colour steps down the
		// seed's own palette when the seed is too light to read (#1499).
		text:
			hct.tone <= MAX_LEGIBLE_TEXT_TONE
				? seedHex
				: hex(palette.tone(MAX_LEGIBLE_TEXT_TONE)),
		textHover: hex(
			palette.tone(
				clampTone(
					Math.min(Math.round(hct.tone), MAX_LEGIBLE_TEXT_TONE) +
						HOVER_TONE_SHIFT
				)
			)
		),
		container: hex(boosted.tone(containerTone)),
		onContainer: hex(palette.tone(onContainerTone)),
		inverse: hex(palette.tone(80)),
		tint: hex(boosted.tone(40)),
		hover: hex(
			palette.tone(clampTone(Math.round(hct.tone) + HOVER_TONE_SHIFT))
		),
		// Fixed roles keep the same tones in every scheme (M3 spec).
		fixed: hex(palette.tone(90)),
		fixedDim: hex(palette.tone(80)),
		onFixed: hex(palette.tone(10)),
		onFixedVariant: hex(palette.tone(30))
	};
};

/**
 * The global topic tag ("Themenberatung", e.g. "Familienberatung") is one
 * pill everywhere: the session list, the session header, the group views.
 * Resting: the brand's light "fixed" tone with its tone-30 ink (about 7:1,
 * same hue as the Träger). Emphasised (selected or hovered card): the
 * brand container with its own on-container ink. The ink falls back to the
 * darkest tone when a recipe change ever drops the pair below AA, so the
 * guard lives with the tokens, not in each consumer.
 */
/**
 * Brand-coloured ink for the light `primary-fixed` fill (member-count chip,
 * unread arrow, count badges). The text tone is the Träger look in the
 * light scheme; in dark and inverted it is a light tone (1.3:1 on the
 * fixed fill), so the darkest-hue ink takes over when AA is missed.
 */
const textOnFixed = (brand: BrandFamily): string =>
	wcagContrast(brand.text, brand.fixed) >= CONTRAST_AA
		? brand.text
		: brand.onFixedVariant;

const topicTagTokens = (brand: BrandFamily): Record<string, string> => {
	const ink = (fill: string, preferred: string, fallback: string): string =>
		wcagContrast(preferred, fill) >= CONTRAST_AA ? preferred : fallback;
	return {
		'--oriso-topic-tag-bg': brand.fixed,
		'--oriso-topic-tag-fg': ink(
			brand.fixed,
			brand.onFixedVariant,
			brand.onFixed
		),
		'--oriso-topic-tag-active-bg': brand.container,
		'--oriso-topic-tag-active-fg': ink(
			brand.container,
			brand.onContainer,
			wcagContrast('#ffffff', brand.container) >=
				wcagContrast('#000000', brand.container)
				? '#ffffff'
				: '#000000'
		)
	};
};

const darkBrandFamily = (palette: TonalPalette): BrandFamily => {
	return {
		role: hex(palette.tone(DARK_BRAND_TONES.role)),
		onRole: hex(palette.tone(DARK_BRAND_TONES.onRole)),
		text: hex(palette.tone(DARK_BRAND_TONES.role)),
		textHover: hex(
			palette.tone(clampTone(DARK_BRAND_TONES.role - HOVER_TONE_SHIFT))
		),
		container: hex(palette.tone(DARK_BRAND_TONES.container)),
		onContainer: hex(palette.tone(DARK_BRAND_TONES.onContainer)),
		inverse: hex(palette.tone(40)),
		tint: hex(palette.tone(80)),
		hover: hex(
			palette.tone(clampTone(DARK_BRAND_TONES.role - HOVER_TONE_SHIFT))
		),
		fixed: hex(palette.tone(90)),
		fixedDim: hex(palette.tone(80)),
		onFixed: hex(palette.tone(10)),
		onFixedVariant: hex(palette.tone(30))
	};
};

/** Light or dark ink for a fill, whichever reads better (brand hue). */
const inkOnFill = (palette: TonalPalette, fill: string): string => {
	const best = (a: string, b: string) =>
		wcagContrast(a, fill) >= wcagContrast(b, fill) ? a : b;
	const tinted = best(
		hex(palette.tone(DARK_CALM_ACCENT.ink)),
		hex(palette.tone(10))
	);
	// Mid-tone brands (e.g. a medium blue) need plain white or black.
	return wcagContrast(tinted, fill) >= CONTRAST_AA
		? tinted
		: best('#ffffff', '#000000');
};

/**
 * The dark accent fill as token logic (FE#1134): the computed calm
 * counterpart of the brand colour (`DARK_CALM_ACCENT.fill` on the brand hue),
 * the Träger's `primaryDark` override, or with `original` the brand colour
 * itself. A candidate that cannot carry AA ink falls back to the computed
 * counterpart, so a bad override never makes text unreadable.
 */
export const darkAccentFill = (
	primarySeed: string,
	palette: TonalPalette,
	mode: DarkBrandMode = 'counterpart',
	override?: string
): string => {
	const computed = hex(
		Hct.from(
			palette.hue,
			Math.min(DARK_CALM_ACCENT.fill.chroma, palette.chroma),
			DARK_CALM_ACCENT.fill.tone
		).toInt()
	);
	const candidate = mode === 'original' ? primarySeed : override;
	if (!candidate) return computed;
	const fill = candidate.toLowerCase();
	return wcagContrast(inkOnFill(palette, fill), fill) >= CONTRAST_AA
		? fill
		: computed;
};

/**
 * The dark scheme's brand family around one accent fill (FE#1134): the soft
 * fills take that fill instead of the pale rose, the ink follows the fill,
 * and `fixed-dim` is one step away from the ink so text on it stays legible.
 * Outlines get their own muted rose (`--oriso-outline-rest`).
 */
const calmDarkBrandFamily = (
	palette: TonalPalette,
	fill: string
): BrandFamily => {
	const ink = inkOnFill(palette, fill);
	const fillHct = Hct.fromInt(argbFromHex(fill));
	const awayFromInk =
		wcagContrast(ink, '#000000') > wcagContrast(ink, '#ffffff') ? -1 : 1;
	return {
		...darkBrandFamily(palette),
		fixed: fill,
		fixedDim: hex(
			Hct.from(
				fillHct.hue,
				fillHct.chroma,
				Math.min(
					96,
					Math.max(
						4,
						fillHct.tone + awayFromInk * DARK_CALM_ACCENT.dimStep
					)
				)
			).toInt()
		),
		onFixed: ink,
		onFixedVariant: ink
	};
};

/** Stage gradient around a dark fill: lighter top, darker edge. */
const calmStage = (fill: string, ink: string) => {
	const h = Hct.fromInt(argbFromHex(fill));
	const at = (tone: number) =>
		hex(Hct.from(h.hue, h.chroma, Math.min(96, Math.max(4, tone))).toInt());
	return {
		role: fill,
		onRole: ink,
		container: at(h.tone + DARK_CALM_ACCENT.stageStep),
		edge: at(h.tone - DARK_CALM_ACCENT.stageStep)
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
	signalSeed: string | undefined,
	palette: TonalPalette,
	container: TonalPalette
): {
	error: string;
	onError: string;
	errorContainer: string;
	onErrorContainer: string;
} => {
	if (signalSeed) {
		const family =
			scheme === 'light'
				? lightBrandFamily(signalSeed, palette, container)
				: darkBrandFamily(palette);
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
	scheme: OrisoSchemeName,
	contrast: ContrastLevel = 'standard',
	options: OrisoPaletteOptions = {}
): OrisoPaletteResult => {
	const primarySeed = normalizeHex(seeds.primary, 'primary');
	const primaryDarkSeed =
		seeds.primaryDark === undefined
			? undefined
			: normalizeHex(seeds.primaryDark, 'primaryDark');
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

	const primaryPalette = TonalPalette.fromInt(argbFromHex(primarySeed));
	const brandContainer = containerPalette(primaryPalette);
	const stageBrand = lightBrandFamily(
		primarySeed,
		primaryPalette,
		brandContainer
	);
	const darkFill = darkAccentFill(
		primarySeed,
		primaryPalette,
		options.darkBrand,
		primaryDarkSeed
	);
	const brand =
		scheme === 'light'
			? stageBrand
			: scheme === 'dark'
				? calmDarkBrandFamily(primaryPalette, darkFill)
				: darkBrandFamily(primaryPalette);
	// The sign-in and entry stages follow the dark choice too (FE#1134): the
	// calm counterpart as a gradient around the fill, or the original brand.
	const stage =
		scheme === 'dark' && options.darkBrand !== 'original'
			? calmStage(darkFill, brand.onFixed)
			: {
					role: stageBrand.role,
					onRole: stageBrand.onRole,
					container: stageBrand.container,
					edge: stageBrand.hover
				};

	const secondaryPalette = accentSeed
		? harmonizedAccentPalette(accentSeed, primarySeed)
		: slate;
	const secondary = accentFamilyFromPalette(
		secondaryPalette,
		SECONDARY_TONES,
		scheme
	);
	const tertiary = accentFamilyFromPalette(slate, TERTIARY_TONES, scheme);
	const signalPalette = TonalPalette.fromInt(
		argbFromHex(signalSeed ?? DEFAULT_SIGNAL.anchorSeed)
	);
	const signalContainer =
		scheme !== 'light'
			? signalPalette
			: signalSeed
				? containerPalette(signalPalette)
				: TonalPalette.fromInt(
						argbFromHex(DEFAULT_SIGNAL.light.errorContainer)
					);
	const signal = signalFamily(
		scheme,
		signalSeed,
		signalPalette,
		signalContainer
	);

	const schemeTones =
		scheme === 'light'
			? LIGHT_NEUTRAL_TONES
			: scheme === 'dark'
				? contrast === 'high'
					? DARK_DEEP_NEUTRAL_TONES
					: DARK_NEUTRAL_TONES
				: INVERTED_NEUTRAL_TONES;
	const neutralTones =
		contrast === 'high' && scheme !== 'inverted'
			? { ...schemeTones, ...HIGH_CONTRAST_INK_TONES[scheme] }
			: schemeTones;

	const tokens: Record<string, string> = {
		'--m3-primary': brand.role,
		'--m3-on-primary': brand.onRole,
		'--m3-primary-container': brand.container,
		'--m3-on-primary-container': brand.onContainer,
		'--m3-primary-hover': brand.hover,
		// The entry artwork keeps the tenant's brand across display modes.
		'--oriso-stage-brand': stage.role,
		'--oriso-stage-brand-on': stage.onRole,
		'--oriso-stage-brand-container': stage.container,
		'--oriso-stage-brand-edge': stage.edge,
		'--oriso-primary-text': brand.text,
		'--oriso-primary-text-hover': brand.textHover,
		'--oriso-primary-text-on-fixed': textOnFixed(brand),
		'--m3-hover-layer': scheme === 'light' ? '#f9eff0' : '#331f21',
		'--m3-selected-layer': scheme === 'light' ? '#f5e6e7' : '#4a292c',
		'--m3-primary-fixed': brand.fixed,
		// Dedicated focus/outline accent: keep it dark enough to stay visible
		// on the light brand surfaces that use it for keyboard focus.
		// Dark keeps its own deep tone here: the calm family's ink is light.
		'--m3-primary-outline':
			scheme === 'dark'
				? hex(primaryPalette.tone(30))
				: brand.onFixedVariant,
		'--m3-primary-fixed-dim': brand.fixedDim,
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
		// Fixed roles keep the same tones in every scheme (M3 spec) — the
		// secondary pair is the menu organism's hover/selected surface (T27).
		'--m3-secondary-fixed': hex(secondaryPalette.tone(90)),
		'--m3-secondary-fixed-dim': hex(secondaryPalette.tone(80)),
		'--m3-on-secondary-fixed': hex(secondaryPalette.tone(10)),
		'--m3-on-secondary-fixed-variant': hex(secondaryPalette.tone(30)),

		'--m3-tertiary': tertiary.role,
		'--m3-on-tertiary': tertiary.onRole,
		'--m3-tertiary-container': tertiary.container,
		'--m3-on-tertiary-container': tertiary.onContainer,
		// Figma timeline selected-card body, fixed across schemes.
		'--m3-on-tertiary-fixed': hex(slate.tone(10)),

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

	const enhanced = contrast !== 'standard' && scheme !== 'inverted';
	if (enhanced) {
		enhanceOrisoContrast(
			tokens,
			{
				neutral,
				variant,
				primary: primaryPalette,
				primaryContainer:
					scheme === 'light' ? brandContainer : primaryPalette,
				secondary: secondaryPalette,
				tertiary: slate,
				error: signalPalette,
				errorContainer: signalContainer
			},
			contrast === 'high' ? 7 : 5.5
		);
	}

	Object.assign(tokens, {
		'--oriso-primary-fixed': tokens['--m3-primary-fixed'],
		'--oriso-primary-fixed-dim': tokens['--m3-primary-fixed-dim'],
		'--oriso-on-primary-fixed': tokens['--m3-on-primary-fixed'],
		'--oriso-on-primary-fixed-variant':
			tokens['--m3-on-primary-fixed-variant'],
		...(enhanced
			? {
					'--oriso-topic-tag-bg': tokens['--m3-primary-fixed'],
					'--oriso-topic-tag-fg':
						tokens['--m3-on-primary-fixed-variant'],
					'--oriso-topic-tag-active-bg':
						tokens['--m3-primary-container'],
					'--oriso-topic-tag-active-fg':
						tokens['--m3-on-primary-container']
				}
			: topicTagTokens(brand)),
		// Resting card dividers: white hairlines on the light grey page; in dark
		// a quiet neutral instead of a white line (FE#1134).
		'--oriso-card-divider':
			scheme === 'light' ? '#ffffff' : tokens['--m3-outline-variant'],
		// Resting accent outlines and handles: the pale rose in light; in dark
		// a muted rose that still keeps 3:1 on every surface (FE#1134).
		'--oriso-outline-rest':
			scheme === 'dark'
				? hex(
						Hct.from(
							primaryPalette.hue,
							Math.min(
								DARK_CALM_ACCENT.mid.chroma,
								primaryPalette.chroma
							),
							DARK_CALM_ACCENT.mid.tone
						).toInt()
					)
				: tokens['--m3-primary-fixed-dim'],
		// Counter dots on the desktop rail: white with brand digits in light;
		// in dark the calm accent fill, so the light digits stay readable.
		'--oriso-rail-badge-surface':
			scheme === 'dark' ? tokens['--m3-primary-fixed'] : '#ffffff',
		// Active Live-Chat tile on the rail: a deep brand tile with light ink.
		// In dark it must not follow on-primary-fixed, which is light ink there.
		'--oriso-live-surface':
			scheme === 'dark'
				? hex(primaryPalette.tone(10))
				: tokens['--m3-on-primary-fixed'],
		'--oriso-on-live-surface':
			scheme === 'dark'
				? hex(primaryPalette.tone(90))
				: tokens['--m3-surface'],
		'--oriso-app-action': tokens['--m3-primary'],
		'--oriso-lottie-accent-color': tokens['--m3-primary-fixed-dim'],
		'--oriso-lottie-secondary-color':
			tokens[
				scheme === 'dark' ? '--m3-outline' : '--m3-secondary-container'
			],

		'--primary': tokens['--m3-primary'],
		'--primary-3': tokens['--m3-primary-hover'],
		'--hover-primary': tokens['--m3-primary-hover'],
		'--skin-color-primary': tokens['--m3-primary'],
		'--skin-color-primary-hover': tokens['--m3-primary-hover'],
		'--skin-color-primary-contrast-safe': tokens['--oriso-primary-text'],
		'--skin-color-secondary': tokens['--m3-secondary'],
		'--skin-color-secondary-contrast-safe': tokens['--m3-secondary'],
		'--skin-color-default': tokens['--m3-secondary']
	});

	const tooPale =
		Hct.fromInt(argbFromHex(primarySeed)).chroma < TOO_PALE_CHROMA;

	return { tokens, tooPale };
};
