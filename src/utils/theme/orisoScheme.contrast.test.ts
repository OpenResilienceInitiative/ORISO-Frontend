/**
 * #1499: Träger 2 on Dev uses the light-blue seed #b4ddee. The engine used
 * the seed verbatim as `--m3-primary`, and every text button, link and icon
 * drawn in that role read at ~1.2:1. Any light brand colour must still give
 * a primary that meets WCAG AA as text on the light surfaces.
 */
import { Hct, argbFromHex } from '@material/material-color-utilities';
import { describe, expect, it } from 'vitest';
import { computeOrisoPalette } from './orisoScheme';
import { wcagContrast } from './wcagContrast';

const TRAEGER_2_SEED = '#b4ddee';
const LIGHT_SEEDS = [TRAEGER_2_SEED, '#ffd700', '#4eb3a0', '#f7c6d9'];

/** The light surfaces primary-coloured text sits on. */
const TEXT_SURFACES = [
	'--m3-surface',
	'--m3-surface-container-lowest',
	'--m3-surface-container-low',
	'--m3-surface-container',
	'--m3-surface-container-high',
	'--m3-surface-container-highest'
];

const hueOf = (colour: string) => Hct.fromInt(argbFromHex(colour)).hue;

describe('primary stays legible for light Träger seeds (#1499)', () => {
	it.each(LIGHT_SEEDS)(
		'%s: primary text reaches 4.5:1 on every light surface',
		(seed) => {
			const { tokens } = computeOrisoPalette({ primary: seed }, 'light');
			for (const surface of TEXT_SURFACES) {
				expect(
					wcagContrast(tokens['--m3-primary'], tokens[surface])
				).toBeGreaterThanOrEqual(4.5);
			}
			expect(
				wcagContrast(tokens['--m3-primary'], '#ffffff')
			).toBeGreaterThanOrEqual(4.5);
		}
	);

	it.each(LIGHT_SEEDS)('%s: on-primary and on-container stay AA', (seed) => {
		const { tokens } = computeOrisoPalette({ primary: seed }, 'light');
		expect(
			wcagContrast(tokens['--m3-on-primary'], tokens['--m3-primary'])
		).toBeGreaterThanOrEqual(4.5);
		expect(
			wcagContrast(
				tokens['--m3-on-primary-container'],
				tokens['--m3-primary-container']
			)
		).toBeGreaterThanOrEqual(4.5);
	});

	it('keeps the Träger hue when it darkens the role', () => {
		const { tokens } = computeOrisoPalette(
			{ primary: TRAEGER_2_SEED },
			'light'
		);
		expect(tokens['--m3-primary']).not.toBe(TRAEGER_2_SEED);
		expect(
			Math.abs(hueOf(tokens['--m3-primary']) - hueOf(TRAEGER_2_SEED))
		).toBeLessThan(5);
		// The legacy "contrast-safe" alias finally is.
		expect(tokens['--skin-color-primary-contrast-safe']).toBe(
			tokens['--m3-primary']
		);
	});

	it('leaves a seed that is already legible untouched (brand fidelity)', () => {
		for (const seed of ['#a5000a', '#a50202', '#0b5394']) {
			const { tokens } = computeOrisoPalette({ primary: seed }, 'light');
			expect(tokens['--m3-primary']).toBe(seed);
		}
	});
});
