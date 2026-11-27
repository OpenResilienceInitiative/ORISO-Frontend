import { describe, expect, it } from 'vite-plus/test';
import { computeOrisoPalette, type OrisoSeeds } from './orisoScheme';
import { wcagContrast } from './wcagContrast';

// FE#1134: dark mode uses the calm stage tone (#281715, Figma
// M3/sys/light/on-background, the Admin sidebar) as its accent fill, lifts the
// surfaces off near-black and gives outlines their own quiet roles. Dark + high
// contrast keeps the deep ladder on purpose.
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
	it('uses the Admin stage tone as the platform accent fill', () => {
		const { tokens } = computeOrisoPalette(seeds.platform, 'dark');
		expect(tokens['--m3-primary-fixed']).toBe('#281715');
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
	});
});
