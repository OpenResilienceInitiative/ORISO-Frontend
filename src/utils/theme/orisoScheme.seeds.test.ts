/**
 * Seed behaviour of the OrisoScheme engine (THB-01):
 * optional accent/signal seeds and the "too pale" guard.
 *
 * Traces: UAT-A (part), UAT-F (Tests #7, #8 in THB — Test Logic).
 */
import { Hct, argbFromHex } from '@material/material-color-utilities';
import { describe, expect, it } from 'vitest';
import { computeOrisoPalette } from './orisoScheme';

const PRIMARY = '#A5000A';

const hueOf = (hexColour: string): number =>
	Hct.fromInt(argbFromHex(hexColour)).hue;
const chromaOf = (hexColour: string): number =>
	Hct.fromInt(argbFromHex(hexColour)).chroma;

/** Smallest angular distance between two hues (degrees). */
const hueDistance = (a: number, b: number): number => {
	const d = Math.abs(a - b) % 360;
	return d > 180 ? 360 - d : d;
};

describe('optional seeds (Test #8)', () => {
	it('primary only: signal defaults to the Oriso error tones', () => {
		const { tokens } = computeOrisoPalette({ primary: PRIMARY }, 'light');
		expect(tokens['--m3-error']).toBe('#b1005e');
		expect(tokens['--m3-on-error']).toBe('#ffffff');
		expect(tokens['--m3-error-container']).toBe('#de0077');
		expect(tokens['--m3-on-error-container']).toBe('#fff7f7');
	});

	it('primary only: secondary family falls back to the slate anchor', () => {
		const { tokens } = computeOrisoPalette({ primary: PRIMARY }, 'light');
		// Slate hue ≈ 249 — the muted blue-grey default.
		expect(hueDistance(hueOf(tokens['--m3-secondary']), 249)).toBeLessThan(
			5
		);
	});

	it('explicitly undefined accent/signal behave like omitted ones', () => {
		const omitted = computeOrisoPalette({ primary: PRIMARY }, 'light');
		const explicit = computeOrisoPalette(
			{ primary: PRIMARY, accent: undefined, signal: undefined },
			'light'
		);
		expect(explicit.tokens).toEqual(omitted.tokens);
	});
});

describe('accent seed is harmonised toward the primary (Test #8)', () => {
	const ACCENT = '#0061ff'; // a strong blue, far from the red primary

	it('accent changes the secondary family away from the slate default', () => {
		const without = computeOrisoPalette({ primary: PRIMARY }, 'light');
		const withAccent = computeOrisoPalette(
			{ primary: PRIMARY, accent: ACCENT },
			'light'
		);
		expect(withAccent.tokens['--m3-secondary']).not.toBe(
			without.tokens['--m3-secondary']
		);
		expect(withAccent.tokens['--m3-secondary-container']).not.toBe(
			without.tokens['--m3-secondary-container']
		);
	});

	it('the accent hue is pulled toward the primary hue', () => {
		const { tokens } = computeOrisoPalette(
			{ primary: PRIMARY, accent: ACCENT },
			'light'
		);
		const primaryHue = hueOf(PRIMARY);
		const rawAccentHue = hueOf(ACCENT);
		const resultHue = hueOf(tokens['--m3-secondary']);
		expect(hueDistance(resultHue, primaryHue)).toBeLessThan(
			hueDistance(rawAccentHue, primaryHue)
		);
	});

	it('the accent chroma is damped to stay calm', () => {
		const { tokens } = computeOrisoPalette(
			{ primary: PRIMARY, accent: ACCENT },
			'light'
		);
		expect(chromaOf(tokens['--m3-secondary'])).toBeLessThanOrEqual(24.5);
	});

	it('tertiary stays on the slate anchor even with an accent', () => {
		const without = computeOrisoPalette({ primary: PRIMARY }, 'light');
		const withAccent = computeOrisoPalette(
			{ primary: PRIMARY, accent: ACCENT },
			'light'
		);
		expect(withAccent.tokens['--m3-tertiary']).toBe(
			without.tokens['--m3-tertiary']
		);
	});
});

describe('signal seed drives the error family (Test #8)', () => {
	const SIGNAL = '#c75300'; // a custom warning orange

	it('the signal seed becomes the error role (brand-fidelity recipe)', () => {
		const { tokens } = computeOrisoPalette(
			{ primary: PRIMARY, signal: SIGNAL },
			'light'
		);
		expect(tokens['--m3-error']).toBe('#c75300');
		expect(tokens['--m3-error']).not.toBe('#b1005e');
	});

	it('error container and on-colours follow the generic container recipe', () => {
		const { tokens } = computeOrisoPalette(
			{ primary: PRIMARY, signal: SIGNAL },
			'light'
		);
		// Same hue family as the signal, lighter container, readable on-colours.
		expect(
			hueDistance(hueOf(tokens['--m3-error-container']), hueOf(SIGNAL))
		).toBeLessThan(8);
		expect(tokens['--m3-on-error']).toMatch(/^#[0-9a-f]{6}$/);
		expect(tokens['--m3-on-error-container']).toMatch(/^#[0-9a-f]{6}$/);
	});
});

describe('too-pale warning (Test #7, UAT-F)', () => {
	it('a near-grey primary seed sets the flag and still returns a palette', () => {
		const result = computeOrisoPalette({ primary: '#7f7f7f' }, 'light');
		expect(result.tooPale).toBe(true);
		expect(Object.keys(result.tokens).length).toBeGreaterThan(20);
	});

	it('a saturated primary seed does not warn', () => {
		const result = computeOrisoPalette({ primary: PRIMARY }, 'light');
		expect(result.tooPale).toBe(false);
	});

	it('never throws for a pale seed', () => {
		expect(() =>
			computeOrisoPalette({ primary: '#eeeeee' }, 'light')
		).not.toThrow();
		expect(
			computeOrisoPalette({ primary: '#eeeeee' }, 'light').tooPale
		).toBe(true);
	});
});

describe('invalid seeds throw (consumers catch and fall back)', () => {
	it('rejects a non-hex primary', () => {
		expect(() =>
			computeOrisoPalette({ primary: 'not-a-hex' }, 'light')
		).toThrow(/not a valid hex/);
	});

	it('rejects an invalid accent', () => {
		expect(() =>
			computeOrisoPalette(
				{ primary: PRIMARY, accent: '#12345' },
				'light'
			)
		).toThrow(/not a valid hex/);
	});
});
