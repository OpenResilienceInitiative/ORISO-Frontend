import {
	hexFromArgb,
	type TonalPalette
} from '@material/material-color-utilities';
import { wcagContrast } from './wcagContrast';

const NEUTRAL_FILLS = [
	'--m3-surface',
	'--m3-surface-dim',
	'--m3-surface-bright',
	'--m3-surface-container-lowest',
	'--m3-surface-container-low',
	'--m3-surface-container',
	'--m3-surface-container-high',
	'--m3-surface-container-highest'
];
const PRIMARY_FIXED = ['--m3-primary-fixed', '--m3-primary-fixed-dim'];
const SECONDARY_FIXED = ['--m3-secondary-fixed', '--m3-secondary-fixed-dim'];

interface ContrastPalettes {
	neutral: TonalPalette;
	variant: TonalPalette;
	primary: TonalPalette;
	primaryContainer: TonalPalette;
	secondary: TonalPalette;
	tertiary: TonalPalette;
	error: TonalPalette;
	errorContainer: TonalPalette;
}

/** A passing colour is kept byte-for-byte. Otherwise search toward the
 * passing end of the original family and check the emitted sRGB values. */
const closestPassingTone = (
	colour: string,
	palette: TonalPalette,
	darker: boolean,
	passes: (candidate: string) => boolean
): string | undefined => {
	if (passes(colour)) return colour;
	let good = darker ? 0 : 100;
	let bad = darker ? 101 : -1;
	const colourAt = (tone: number) => hexFromArgb(palette.tone(tone));
	if (!passes(colourAt(good))) return undefined;
	while (Math.abs(good - bad) > 1) {
		const tone = Math.floor((good + bad) / 2);
		if (passes(colourAt(tone))) good = tone;
		else bad = tone;
	}
	return colourAt(good);
};

// Contrast against black is monotonic in luminance. Use it to preserve the
// intended light-on-dark or dark-on-light direction when repairing an ink.
const brightness = (colour: string) => wcagContrast(colour, '#000000');

/** Repairs the canonical ink and fill roles before their aliases are derived. */
export const enhanceOrisoContrast = (
	tokens: Record<string, string>,
	palettes: ContrastPalettes,
	threshold: number
): void => {
	const tuneInk = (
		role: string,
		fills: string[],
		palette: TonalPalette,
		minimum = threshold
	): boolean => {
		const darker = brightness(tokens[role]) <= brightness(tokens[fills[0]]);
		const surfaces = fills.map((fill) => ({
			colour: tokens[fill],
			brightness: brightness(tokens[fill])
		}));
		const ink = closestPassingTone(
			tokens[role],
			palette,
			darker,
			(candidate) => {
				const tone = brightness(candidate);
				return surfaces.every((surface) => {
					const darkerThanSurface = tone <= surface.brightness;
					return (
						darkerThanSurface === darker &&
						wcagContrast(candidate, surface.colour) >= minimum
					);
				});
			}
		);
		if (!ink) return false;
		tokens[role] = ink;
		return true;
	};

	const tunePair = (
		ink: string,
		fills: string[],
		inkPalette: TonalPalette,
		fillPalette = inkPalette
	) => {
		if (tuneInk(ink, fills, inkPalette)) return;
		const darkInk = brightness(tokens[ink]) <= brightness(tokens[fills[0]]);
		const extreme = darkInk ? '#000000' : '#ffffff';
		// No ink in this direction can work on all the current fills. Move
		// each fill only as far as needed to make a valid pair possible.
		for (const fill of fills) {
			tokens[fill] =
				closestPassingTone(
					tokens[fill],
					fillPalette,
					!darkInk,
					(candidate) => wcagContrast(extreme, candidate) >= threshold
				) ?? tokens[fill];
		}
		tuneInk(ink, fills, inkPalette);
	};

	tuneInk('--m3-on-surface', NEUTRAL_FILLS, palettes.neutral);
	tuneInk(
		'--m3-on-surface-variant',
		['--m3-surface-variant', ...NEUTRAL_FILLS],
		palettes.variant
	);
	tuneInk(
		'--m3-inverse-on-surface',
		['--m3-inverse-surface'],
		palettes.neutral
	);
	tuneInk('--m3-inverse-primary', ['--m3-inverse-surface'], palettes.primary);
	tokens['--oriso-error-text'] = tokens['--m3-error'];
	tuneInk('--oriso-error-text', NEUTRAL_FILLS, palettes.error);
	tuneInk('--oriso-primary-text', NEUTRAL_FILLS, palettes.primary);
	tuneInk('--oriso-primary-text-hover', NEUTRAL_FILLS, palettes.primary);
	tuneInk('--oriso-primary-text-on-fixed', PRIMARY_FIXED, palettes.primary);
	for (const [family, fills] of [
		['primary', PRIMARY_FIXED],
		['secondary', SECONDARY_FIXED]
	] as const) {
		const palette = palettes[family];
		tuneInk(`--m3-on-${family}-fixed`, fills, palette);
		tuneInk(`--m3-on-${family}-fixed-variant`, fills, palette);
	}
	for (const family of [
		'primary',
		'secondary',
		'tertiary',
		'error'
	] as const) {
		const fills = [`--m3-${family}`];
		if (family === 'primary') fills.push('--m3-primary-hover');
		tunePair(`--m3-on-${family}`, fills, palettes[family]);
		const container =
			family === 'primary' || family === 'error'
				? palettes[`${family}Container`]
				: palettes[family];
		tunePair(
			`--m3-on-${family}-container`,
			[`--m3-${family}-container`],
			palettes[family],
			container
		);
	}
	tuneInk('--m3-outline', NEUTRAL_FILLS, palettes.variant, 3);
	tuneInk('--m3-primary-outline', PRIMARY_FIXED, palettes.primary, 3);
	tokens['--m3-on-background'] = tokens['--m3-on-surface'];
};
