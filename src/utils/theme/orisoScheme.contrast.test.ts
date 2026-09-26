/**
 * #1499: Träger 2 on Dev uses the light-blue seed #b4ddee. Text buttons,
 * links and icons drawn in the brand colour read at ~1.2:1. Frank's
 * decision: filled areas keep the Träger's colour (pastel stays pastel,
 * with a dark on-primary on top); only text/icons IN the brand colour get
 * a legible tone, `--oriso-primary-text`.
 */
import { Hct, argbFromHex } from '@material/material-color-utilities';
import { describe, expect, it } from 'vitest';
import { computeOrisoPalette } from './orisoScheme';
import { wcagContrast } from './wcagContrast';

const TRAEGER_2_SEED = '#b4ddee';
const LIGHT_SEEDS = [TRAEGER_2_SEED, '#ffd700', '#4eb3a0', '#f7c6d9'];

/** The light surfaces brand-coloured text sits on. */
const TEXT_SURFACES = [
	'--m3-surface',
	'--m3-surface-container-lowest',
	'--m3-surface-container-low',
	'--m3-surface-container',
	'--m3-surface-container-high',
	'--m3-surface-container-highest'
];

const hueOf = (colour: string) => Hct.fromInt(argbFromHex(colour)).hue;

describe('brand text stays legible for light Träger seeds (#1499)', () => {
	it.each(LIGHT_SEEDS)(
		'%s: brand text reaches 4.5:1 on white and every light surface',
		(seed) => {
			const { tokens } = computeOrisoPalette({ primary: seed }, 'light');
			const text = tokens['--oriso-primary-text'];
			expect(text).toBeDefined();
			for (const surface of ['#ffffff', ...TEXT_SURFACES]) {
				const background = surface.startsWith('#')
					? surface
					: tokens[surface];
				expect(wcagContrast(text, background)).toBeGreaterThanOrEqual(
					4.5
				);
			}
			// The legacy alias finally is what its name says.
			expect(tokens['--skin-color-primary-contrast-safe']).toBe(text);
		}
	);

	it.each(LIGHT_SEEDS)(
		'%s: the filled-area colour stays the Träger seed',
		(seed) => {
			const { tokens } = computeOrisoPalette({ primary: seed }, 'light');
			expect(tokens['--m3-primary']).toBe(seed);
			expect(tokens['--oriso-app-action']).toBe(seed);
		}
	);

	it.each(LIGHT_SEEDS)(
		'%s: on-primary is dark and readable on the filled brand colour',
		(seed) => {
			const { tokens } = computeOrisoPalette({ primary: seed }, 'light');
			expect(
				wcagContrast(tokens['--m3-on-primary'], tokens['--m3-primary'])
			).toBeGreaterThanOrEqual(4.5);
			expect(tokens['--m3-on-primary']).not.toBe('#ffffff');
		}
	);

	it('keeps the Träger hue in the text tone', () => {
		const { tokens } = computeOrisoPalette(
			{ primary: TRAEGER_2_SEED },
			'light'
		);
		expect(tokens['--oriso-primary-text']).not.toBe(TRAEGER_2_SEED);
		expect(
			Math.abs(
				hueOf(tokens['--oriso-primary-text']) - hueOf(TRAEGER_2_SEED)
			)
		).toBeLessThan(5);
	});

	it('a seed that is already legible is its own text colour', () => {
		for (const seed of ['#a5000a', '#a50202', '#0b5394']) {
			const { tokens } = computeOrisoPalette({ primary: seed }, 'light');
			expect(tokens['--m3-primary']).toBe(seed);
			expect(tokens['--oriso-primary-text']).toBe(seed);
		}
	});
});
