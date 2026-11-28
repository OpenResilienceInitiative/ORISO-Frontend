import { describe, expect, it } from 'vite-plus/test';
import { computeOrisoPalette, type OrisoSeeds } from './orisoScheme';
import { wcagContrast } from './wcagContrast';
import { resolveTenantSeeds } from './applyTenantTheme';

// FE#1134: dark mode computes a calm counterpart of the brand colour as its
// accent fill (muted wine-red #59302b for ORISO red), unless the Träger sets
// `primaryDark` or the person keeps the original brand colour. Surfaces lift
// off near-black and outlines get their own quiet roles. Dark + high contrast
// keeps the deep ladder on purpose.
const seeds: Record<string, OrisoSeeds> = {
	platform: { primary: '#a5000a' },
	blue: { primary: '#0b66c3' },
	yellow: { primary: '#f2c200' },
	green: { primary: '#2e7d32' }
};
const surfaces = [
	'--m3-surface',
	'--m3-surface-container-lowest',
	'--m3-surface-container-low',
	'--m3-surface-container'
];

describe('calm dark mode (FE#1134)', () => {
	it('computes the muted wine-red counterpart for ORISO red', () => {
		const { tokens } = computeOrisoPalette(seeds.platform, 'dark');
		expect(tokens['--m3-primary-fixed']).toBe('#59302b');
	});

	it('lifts the chat surface off near-black, but not in high contrast', () => {
		const calm = computeOrisoPalette(seeds.platform, 'dark').tokens;
		const deep = computeOrisoPalette(seeds.platform, 'dark', 'high').tokens;
		expect(calm['--m3-surface-container-lowest']).toBe('#1d1d1e');
		expect(deep['--m3-surface-container-lowest']).toBe('#0e0e0f');
	});

	it.each(Object.entries(seeds))(
		'%s keeps readable ink, badges and 3:1 outlines in every dark level',
		(_name, seed) => {
			for (const level of ['standard', 'medium', 'high'] as const) {
				const t = computeOrisoPalette(seed, 'dark', level).tokens;
				expect(
					wcagContrast(
						t['--m3-on-primary-fixed'],
						t['--m3-primary-fixed']
					)
				).toBeGreaterThanOrEqual(7);
				expect(
					wcagContrast(
						t['--oriso-on-primary-fixed-variant'],
						t['--oriso-rail-badge-surface']
					)
				).toBeGreaterThanOrEqual(4.5);
				expect(
					wcagContrast(
						t['--oriso-on-live-surface'],
						t['--oriso-live-surface']
					)
				).toBeGreaterThanOrEqual(7);
				for (const s of surfaces) {
					expect(
						wcagContrast(t['--oriso-outline-rest'], t[s])
					).toBeGreaterThanOrEqual(3);
				}
			}
		}
	);

	it('leaves the light rail badge and outlines as they were', () => {
		const t = computeOrisoPalette(seeds.platform, 'light').tokens;
		expect(t['--oriso-rail-badge-surface']).toBe('#ffffff');
		expect(t['--oriso-card-divider']).toBe('#ffffff');
		expect(t['--oriso-outline-rest']).toBe(t['--m3-primary-fixed-dim']);
		expect(t['--oriso-live-surface']).toBe(t['--m3-on-primary-fixed']);
		expect(t['--oriso-on-live-surface']).toBe(t['--m3-surface']);
	});

	describe('dark accent token logic', () => {
		it('computes the counterpart from the accent token when nothing is set', () => {
			const t = computeOrisoPalette(seeds.blue, 'dark').tokens;
			const computed = computeOrisoPalette({ primary: '#0b66c3' }, 'dark')
				.tokens['--m3-primary-fixed'];
			expect(t['--m3-primary-fixed']).toBe(computed);
			expect(t['--m3-primary-fixed']).not.toBe(
				computeOrisoPalette(seeds.platform, 'dark').tokens[
					'--m3-primary-fixed'
				]
			);
		});

		it('uses a readable Träger override for dark only', () => {
			const withOverride = { primary: '#a5000a', primaryDark: '#3a1f4d' };
			const dark = computeOrisoPalette(withOverride, 'dark').tokens;
			expect(dark['--m3-primary-fixed']).toBe('#3a1f4d');
			expect(
				wcagContrast(dark['--m3-on-primary-fixed'], '#3a1f4d')
			).toBeGreaterThanOrEqual(7);
			expect(computeOrisoPalette(withOverride, 'light').tokens).toEqual(
				computeOrisoPalette(seeds.platform, 'light').tokens
			);
		});

		it('reads the override from the tenant theming and drops an invalid one', () => {
			expect(
				resolveTenantSeeds({
					primaryColor: '#a5000a',
					primaryDarkColor: '#3A1F4D'
				})?.primaryDark
			).toBe('#3a1f4d');
			expect(
				resolveTenantSeeds({
					primaryColor: '#a5000a',
					primaryDarkColor: 'not-a-colour'
				})
			).toEqual({ primary: '#a5000a' });
		});

		it.each(Object.entries(seeds))(
			'%s keeps the original brand colour when the person chooses it',
			(_name, seed) => {
				for (const level of ['standard', 'medium', 'high'] as const) {
					const t = computeOrisoPalette(seed, 'dark', level, {
						darkBrand: 'original'
					}).tokens;
					if (level === 'standard') {
						expect(t['--m3-primary-fixed']).toBe(
							seed.primary.toLowerCase()
						);
					}
					expect(
						wcagContrast(
							t['--m3-on-primary-fixed'],
							t['--m3-primary-fixed']
						)
					).toBeGreaterThanOrEqual(4.5);
					expect(
						wcagContrast(
							t['--oriso-primary-text-on-fixed'],
							t['--m3-primary-fixed']
						)
					).toBeGreaterThanOrEqual(4.5);
				}
			}
		);

		it('turns the sign-in stage calm in dark and keeps it red with original', () => {
			const calm = computeOrisoPalette(seeds.platform, 'dark').tokens;
			const original = computeOrisoPalette(
				seeds.platform,
				'dark',
				'standard',
				{
					darkBrand: 'original'
				}
			).tokens;
			const light = computeOrisoPalette(seeds.platform, 'light').tokens;
			expect(calm['--oriso-stage-brand']).toBe('#59302b');
			expect(
				wcagContrast(
					calm['--oriso-stage-brand-on'],
					calm['--oriso-stage-brand']
				)
			).toBeGreaterThanOrEqual(7);
			for (const role of ['', '-on', '-container', '-edge']) {
				expect(original[`--oriso-stage-brand${role}`]).toBe(
					light[`--oriso-stage-brand${role}`]
				);
			}
		});

		it('lets the original choice change nothing outside dark', () => {
			for (const scheme of ['light', 'inverted'] as const) {
				expect(
					computeOrisoPalette(seeds.platform, scheme, 'standard', {
						darkBrand: 'original'
					}).tokens
				).toEqual(computeOrisoPalette(seeds.platform, scheme).tokens);
			}
		});
	});
});
