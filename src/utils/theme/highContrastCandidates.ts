/**
 * High-contrast candidate palettes (Frontend#1134) — PROPOSAL, not wired.
 *
 * The standard palette stays the default (product decision 18.08.2026). This
 * module only computes what an optional personal high-contrast appearance
 * could look like, so the three candidates can be compared in Storybook
 * ("Foundations/High contrast candidates") before one is built.
 *
 * Each candidate returns a COMPLETE token map: the standard light palette
 * for the tenant seed, with the roles that carry contrast replaced. It uses
 * the `--m3-*` / `--oriso-*` names the app already consumes, so a surface can
 * be previewed by setting the map on any element. Nothing here reads or
 * writes the DOM, and nothing imports it from the app.
 *
 * Tenant branding: the brand hue always comes from the tenant seed. A seed
 * that already reaches the target keeps its exact colour; a lighter seed is
 * stepped down its own tonal palette (never replaced by a neutral) until it
 * does — the same way the engine already derives `--oriso-primary-text`.
 *
 * Pure module: same input, same output.
 */
import {
	Hct,
	TonalPalette,
	argbFromHex,
	hexFromArgb
} from '@material/material-color-utilities';

import {
	type ContrastKind,
	type ContrastRating,
	rateContrast
} from './contrastRating';
import { NEUTRAL, NEUTRAL_VARIANT } from './orisoTuning';
import { type OrisoSeeds, computeOrisoPalette } from './orisoScheme';
import { wcagContrast } from './wcagContrast';

export type HighContrastCandidateId = 'tinted-aaa' | 'graphite' | 'maximum';

export interface HighContrastCandidate {
	id: HighContrastCandidateId;
	name: string;
	summary: string;
	/** Minimum text contrast every enforced text pair reaches (WCAG AAA is 7). */
	textTarget: number;
}

/** What differs between the candidates, as data (compare orisoTuning.ts). */
interface CandidateRecipe extends HighContrastCandidate {
	tones: {
		surface: number;
		containerLowest: number;
		containerLow: number;
		container: number;
		/** The incoming bubble, and the session card / list background. */
		containerHigh: number;
		containerHighest: number;
		onSurface: number;
		/** Where the search for the subtle ink (metadata, outline) starts. */
		onSurfaceVariant: number;
		outline: number;
	};
	/** The own (outgoing) bubble: brand tint, or a neutral grey. */
	ownBubble: { source: 'brand' | 'neutral'; tone: number };
}

const RECIPES: Record<HighContrastCandidateId, CandidateRecipe> = {
	'tinted-aaa': {
		id: 'tinted-aaa',
		name: 'A · Tinted AAA',
		summary:
			'Today’s look — tinted own bubble, calm greys — with every text pair lifted to 7:1 or more and the brand colour darkened only where it has to be.',
		textTarget: 7,
		tones: {
			surface: 98,
			containerLowest: 100,
			containerLow: 96,
			container: 94,
			containerHigh: 92,
			containerHighest: 90,
			onSurface: 5,
			onSurfaceVariant: 30,
			outline: 40
		},
		ownBubble: { source: 'brand', tone: 90 }
	},
	'graphite': {
		id: 'graphite',
		name: 'B · Graphite',
		summary:
			'Neutral chat: black ink, both bubbles grey and told apart by lightness alone. The brand colour only marks what you can press. Safest for any tenant colour and for colour-blind users.',
		textTarget: 7,
		tones: {
			surface: 100,
			containerLowest: 100,
			containerLow: 98,
			container: 96,
			containerHigh: 94,
			containerHighest: 92,
			onSurface: 0,
			onSurfaceVariant: 25,
			outline: 35
		},
		ownBubble: { source: 'neutral', tone: 82 }
	},
	'maximum': {
		id: 'maximum',
		name: 'C · Maximum',
		summary:
			'Strongest separation: white page, a deeper brand tint for the own bubble, black ink and a 10:1 floor on all text. Little visual hierarchy is left in the greys.',
		textTarget: 10,
		tones: {
			surface: 100,
			containerLowest: 100,
			containerLow: 97,
			container: 95,
			containerHigh: 90,
			containerHighest: 87,
			onSurface: 0,
			onSurfaceVariant: 20,
			outline: 25
		},
		ownBubble: { source: 'brand', tone: 80 }
	}
};

export const HIGH_CONTRAST_CANDIDATES: readonly HighContrastCandidate[] =
	Object.values(RECIPES).map(({ id, name, summary, textTarget }) => ({
		id,
		name,
		summary,
		textTarget
	}));

const WHITE = '#ffffff';

const hex = (argb: number): string => hexFromArgb(argb).toLowerCase();

/**
 * Walks down a tonal palette from `startTone` and returns the first (so the
 * lightest) tone that satisfies `accept`; the darkest tone when none does.
 * Checked on the rounded hex, so gamut mapping cannot sneak under a target.
 */
const lightestTone = (
	palette: TonalPalette,
	startTone: number,
	accept: (candidate: string) => boolean
): string => {
	for (let tone = Math.floor(startTone); tone >= 0; tone -= 1) {
		const candidate = hex(palette.tone(tone));
		if (accept(candidate)) {
			return candidate;
		}
	}
	return hex(palette.tone(0));
};

const reaches = (
	colour: string,
	backgrounds: string[],
	target: number
): boolean => backgrounds.every((bg) => wcagContrast(colour, bg) >= target);

const toneOf = (colour: string): number =>
	Hct.fromInt(argbFromHex(colour)).tone;

/** Replace `--m3-*` roles that other tokens mirror under another name. */
const mirror = (
	tokens: Record<string, string>,
	names: string[],
	value: string
): void => {
	for (const name of names) {
		tokens[name] = value;
	}
};

/**
 * The full token map of one candidate for one tenant seed.
 *
 * Throws on an invalid seed like `computeOrisoPalette`, which it builds on.
 */
export const computeHighContrastTokens = (
	candidateId: HighContrastCandidateId,
	seeds: OrisoSeeds
): Record<string, string> => {
	const recipe = RECIPES[candidateId];
	const { tones, textTarget: target } = recipe;
	const tokens = { ...computeOrisoPalette(seeds, 'light').tokens };

	const neutral = TonalPalette.fromHueAndChroma(NEUTRAL.hue, NEUTRAL.chroma);
	const variant = TonalPalette.fromHueAndChroma(
		NEUTRAL_VARIANT.hue,
		NEUTRAL_VARIANT.chroma
	);
	const seedHex = tokens['--m3-primary'];
	const brand = TonalPalette.fromInt(argbFromHex(seedHex));
	const seedTone = toneOf(seedHex);

	// Surfaces. The incoming bubble is surface-container-high; the own
	// bubble is primary-fixed (both as in settings.scss).
	const surface = hex(neutral.tone(tones.surface));
	const lowest = hex(neutral.tone(tones.containerLowest));
	const low = hex(neutral.tone(tones.containerLow));
	const container = hex(neutral.tone(tones.container));
	const incoming = hex(neutral.tone(tones.containerHigh));
	const highest = hex(neutral.tone(tones.containerHighest));
	const own =
		recipe.ownBubble.source === 'brand'
			? hex(brand.tone(recipe.ownBubble.tone))
			: hex(neutral.tone(recipe.ownBubble.tone));
	const ownDim =
		recipe.ownBubble.source === 'brand'
			? hex(brand.tone(Math.max(0, recipe.ownBubble.tone - 6)))
			: hex(neutral.tone(Math.max(0, recipe.ownBubble.tone - 6)));
	const bubbles = [surface, lowest, low, incoming, highest, own];

	// Ink.
	const onSurface = hex(neutral.tone(tones.onSurface));
	const onSurfaceVariant = lightestTone(
		variant,
		tones.onSurfaceVariant,
		(c) => reaches(c, bubbles, target)
	);
	const outline = lightestTone(variant, tones.outline, (c) =>
		reaches(c, [surface, lowest, incoming], target)
	);

	// Brand. A fill keeps the exact seed when white already reads on it.
	const fill = reaches(WHITE, [seedHex], target)
		? seedHex
		: lightestTone(brand, seedTone, (c) => reaches(WHITE, [c], target));
	const fillHover = hex(brand.tone(Math.max(0, toneOf(fill) - 8)));
	// Brand-coloured text and glyphs on every light surface and bubble.
	const brandText = reaches(seedHex, bubbles, target)
		? seedHex
		: lightestTone(brand, seedTone, (c) => reaches(c, bubbles, target));
	const brandTextHover = hex(brand.tone(Math.max(0, toneOf(brandText) - 8)));
	const focusRing = lightestTone(brand, seedTone, (c) =>
		reaches(c, [surface, lowest, incoming, own], target)
	);

	// Neutral surfaces.
	mirror(tokens, ['--m3-surface', '--m3-background'], surface);
	tokens['--m3-surface-container-lowest'] = lowest;
	tokens['--m3-surface-container-low'] = low;
	tokens['--m3-surface-container'] = container;
	tokens['--m3-surface-container-high'] = incoming;
	tokens['--m3-surface-container-highest'] = highest;
	mirror(tokens, ['--m3-on-surface', '--m3-on-background'], onSurface);
	tokens['--m3-on-surface-variant'] = onSurfaceVariant;
	tokens['--m3-outline'] = outline;

	// Own bubble and the roles that are the same tint under another name.
	mirror(tokens, ['--m3-primary-fixed', '--oriso-primary-fixed'], own);
	mirror(
		tokens,
		['--m3-primary-fixed-dim', '--oriso-primary-fixed-dim'],
		ownDim
	);
	mirror(
		tokens,
		['--m3-on-primary-fixed', '--oriso-on-primary-fixed'],
		onSurface
	);
	mirror(
		tokens,
		['--m3-on-primary-fixed-variant', '--oriso-on-primary-fixed-variant'],
		onSurfaceVariant
	);

	// Brand fill (buttons, selected-card edge, unread chips) and its text.
	mirror(
		tokens,
		[
			'--m3-primary',
			'--m3-primary-container',
			'--primary',
			'--skin-color-primary',
			'--oriso-app-action'
		],
		fill
	);
	mirror(tokens, ['--m3-on-primary', '--m3-on-primary-container'], WHITE);
	mirror(
		tokens,
		[
			'--m3-primary-hover',
			'--primary-3',
			'--hover-primary',
			'--skin-color-primary-hover'
		],
		fillHover
	);
	mirror(
		tokens,
		[
			'--oriso-primary-text',
			'--oriso-primary-text-on-fixed',
			'--skin-color-primary-contrast-safe'
		],
		brandText
	);
	tokens['--oriso-primary-text-hover'] = brandTextHover;
	tokens['--m3-primary-outline'] = focusRing;

	// Topic tag: resting = own-bubble tint with ink, emphasised = brand fill.
	tokens['--oriso-topic-tag-bg'] = own;
	tokens['--oriso-topic-tag-fg'] = onSurface;
	tokens['--oriso-topic-tag-active-bg'] = fill;
	tokens['--oriso-topic-tag-active-fg'] = WHITE;

	// Session-list previews and sender lines read --m3-secondary and
	// --m3-secondary-container as TEXT (it also fills the secondary chip, so
	// the chip's own text role is moved with it).
	const secondaryInk = lightestTone(variant, tones.onSurfaceVariant, (c) =>
		reaches(c, [incoming, highest, own, ownDim, surface], target)
	);
	mirror(
		tokens,
		['--m3-secondary', '--m3-secondary-container'],
		secondaryInk
	);
	mirror(tokens, ['--m3-on-secondary', '--m3-on-secondary-container'], WHITE);

	return tokens;
};

export type ContrastPairGroup =
	| 'Chat'
	| 'Buttons'
	| 'Focus'
	| 'Session list'
	| 'Input';

export interface ContrastPair {
	id: string;
	group: ContrastPairGroup;
	label: string;
	kind: ContrastKind;
	foreground: string;
	background: string;
	/**
	 * False when no palette can change the outcome — the colour is hard-coded
	 * in CSS, or WCAG exempts the element. These rows are still shown, because
	 * they are findings for the production wiring.
	 */
	enforced: boolean;
	note?: string;
}

export interface EvaluatedPair {
	pair: ContrastPair;
	rating: ContrastRating;
}

/** `foreground` over `background` at `alpha`, as `#rrggbb`. */
const over = (
	foreground: string,
	alpha: number,
	background: string
): string => {
	const channels = (colour: string): number[] => [
		parseInt(colour.slice(1, 3), 16),
		parseInt(colour.slice(3, 5), 16),
		parseInt(colour.slice(5, 7), 16)
	];
	const [f, b] = [channels(foreground), channels(background)];
	return `#${f
		.map((value, i) =>
			Math.round(value * alpha + b[i] * (1 - alpha))
				.toString(16)
				.padStart(2, '0')
		)
		.join('')}`;
};

/** sessionsListItem.styles.scss: `.sessionsListItem__username` / `__subject`. */
const ROW_NAME_INK = '#4f5864';
const ROW_PREVIEW_INK = '#1e1e1e';

/** Button.scss `$focus-blue`, used by `.button__item:focus`. */
const BUTTON_FOCUS_BLUE = '#199fff';

/**
 * The foreground/background pairs that meet on screen in the surfaces the
 * comparison page shows. The token on each side is the one the component's
 * stylesheet actually reads (file named in the note where it is not obvious).
 */
export const evaluateContrastPairs = (
	tokens: Record<string, string>
): EvaluatedPair[] => {
	const t = (name: string): string => tokens[name];
	const surface = t('--m3-surface');
	const incoming = t('--m3-surface-container-high');
	const own = t('--m3-primary-fixed');
	const card = t('--m3-surface-container-low');
	const disabledFill = over('#000000', 0.05, surface);

	const pairs: ContrastPair[] = [
		{
			id: 'bubble-other-text',
			group: 'Chat',
			label: 'Message text, received',
			kind: 'text',
			foreground: t('--m3-on-surface'),
			background: incoming,
			enforced: true
		},
		{
			id: 'bubble-own-text',
			group: 'Chat',
			label: 'Message text, own',
			kind: 'text',
			foreground: t('--m3-on-surface'),
			background: own,
			enforced: true
		},
		{
			id: 'meta-other',
			group: 'Chat',
			label: 'Time, received',
			kind: 'text',
			foreground: t('--m3-on-surface-variant'),
			background: incoming,
			enforced: true
		},
		{
			id: 'meta-own',
			group: 'Chat',
			label: 'Time, own',
			kind: 'text',
			foreground: t('--m3-on-surface-variant'),
			background: own,
			enforced: true
		},
		{
			id: 'date-divider',
			group: 'Chat',
			label: 'Date divider pill',
			kind: 'text',
			foreground: t('--m3-secondary'),
			background: t('--m3-primary-fixed-dim'),
			enforced: true
		},
		{
			id: 'status-delivery',
			group: 'Chat',
			label: 'Delivery tick / cross',
			kind: 'ui',
			foreground: t('--oriso-primary-text'),
			background: own,
			enforced: true
		},
		{
			id: 'link-own',
			group: 'Chat',
			label: 'Link, own bubble',
			kind: 'text',
			foreground: t('--oriso-primary-text'),
			background: own,
			enforced: true
		},
		{
			id: 'link-other',
			group: 'Chat',
			label: 'Link, received bubble',
			kind: 'text',
			foreground: t('--oriso-primary-text'),
			background: incoming,
			enforced: true
		},
		{
			id: 'button-primary',
			group: 'Buttons',
			label: 'Primary: label on fill',
			kind: 'text',
			foreground: t('--m3-on-primary'),
			background: t('--m3-primary'),
			enforced: true
		},
		{
			id: 'button-primary-edge',
			group: 'Buttons',
			label: 'Primary: fill against page',
			kind: 'ui',
			foreground: t('--m3-primary'),
			background: surface,
			enforced: true
		},
		{
			id: 'button-secondary',
			group: 'Buttons',
			label: 'Secondary: label on page',
			kind: 'text',
			foreground: t('--oriso-primary-text'),
			background: surface,
			enforced: true
		},
		{
			id: 'button-secondary-edge',
			group: 'Buttons',
			label: 'Secondary: outline against page',
			kind: 'ui',
			foreground: t('--m3-primary'),
			background: surface,
			enforced: true
		},
		{
			id: 'button-disabled',
			group: 'Buttons',
			label: 'Disabled: label on fill',
			kind: 'text',
			foreground: over('#000000', 0.4, disabledFill),
			background: disabledFill,
			enforced: false,
			note: 'Exempt under WCAG 1.4.3 (inactive component). Hard-coded rgba in button.styles.scss, so no palette changes it.'
		},
		{
			id: 'focus-ring',
			group: 'Focus',
			label: 'Focus ring (--m3-primary-outline)',
			kind: 'ui',
			foreground: t('--m3-primary-outline'),
			background: surface,
			enforced: true
		},
		{
			id: 'focus-ring-button',
			group: 'Focus',
			label: 'Button focus ring (hard-coded)',
			kind: 'ui',
			foreground: BUTTON_FOCUS_BLUE,
			background: surface,
			enforced: false,
			note: 'button.styles.scss draws .button__item:focus with $focus-blue #199fff, not a token. Same in every column until Button is wired to --m3-primary-outline.'
		},
		{
			id: 'row-name',
			group: 'Session list',
			label: 'Session name (hard-coded)',
			kind: 'text',
			foreground: ROW_NAME_INK,
			background: card,
			enforced: false,
			note: 'sessionsListItem.styles.scss sets .sessionsListItem__username to #4f5864, not a token. Same in every column.'
		},
		{
			id: 'row-preview',
			group: 'Session list',
			label: 'Last-message preview (hard-coded)',
			kind: 'text',
			foreground: ROW_PREVIEW_INK,
			background: card,
			enforced: false,
			note: 'sessionsListItem.styles.scss sets .sessionsListItem__subject to #1e1e1e, not a token. Same in every column.'
		},
		{
			id: 'row-date',
			group: 'Session list',
			label: 'Date',
			kind: 'text',
			foreground: t('--m3-on-surface-variant'),
			background: card,
			enforced: true
		},
		{
			id: 'row-subtitle',
			group: 'Session list',
			label: 'Agency subtitle (not in this row)',
			kind: 'text',
			foreground: t('--m3-secondary-container'),
			background: incoming,
			enforced: true,
			note: '12px text on rows and message headers with an agency line. --m3-secondary-container is read as a text colour here and as a chip fill elsewhere; production wiring should give the text its own role.'
		},
		{
			id: 'row-tag',
			group: 'Session list',
			label: 'Topic tag, selected row',
			kind: 'text',
			foreground: t('--m3-on-primary-container'),
			background: t('--m3-primary-container'),
			enforced: true
		},
		{
			id: 'row-tag-resting',
			group: 'Session list',
			label: 'Topic tag, resting',
			kind: 'text',
			foreground: t('--oriso-topic-tag-fg'),
			background: t('--oriso-topic-tag-bg'),
			enforced: true
		},
		{
			id: 'row-selected-edge',
			group: 'Session list',
			label: 'Selected-row edge',
			kind: 'ui',
			foreground: t('--m3-primary'),
			background: incoming,
			enforced: true
		},
		{
			id: 'input-text',
			group: 'Input',
			label: 'Typed text',
			kind: 'text',
			foreground: t('--m3-on-surface'),
			background: t('--m3-surface-container-lowest'),
			enforced: true
		},
		{
			id: 'input-label',
			group: 'Input',
			label: 'Label / placeholder',
			kind: 'text',
			foreground: t('--m3-on-surface-variant'),
			background: t('--m3-surface-container-lowest'),
			enforced: true
		},
		{
			id: 'input-border',
			group: 'Input',
			label: 'Field border',
			kind: 'ui',
			foreground: t('--m3-outline'),
			background: t('--m3-surface-container-lowest'),
			enforced: true
		},
		{
			id: 'input-border-focus',
			group: 'Input',
			label: 'Field border, focused',
			kind: 'ui',
			foreground: t('--m3-primary'),
			background: t('--m3-surface-container-lowest'),
			enforced: true
		}
	];

	return pairs.map((pair) => ({
		pair,
		rating: rateContrast(pair.foreground, pair.background, pair.kind)
	}));
};
