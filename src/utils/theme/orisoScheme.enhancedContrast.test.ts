import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vite-plus/test';
import { computeOrisoPalette, type OrisoSeeds } from './orisoScheme';
import { wcagContrast } from './wcagContrast';

const seeds: Record<string, OrisoSeeds> = {
	'platform': { primary: '#a5000a' },
	'blue': { primary: '#0b66c3' },
	'pale blue': { primary: '#9ed2ee' },
	'yellow primary': { primary: '#f2c200' },
	'green': { primary: '#2e7d32' },
	'yellow accent and custom signal': {
		primary: '#a5000a',
		accent: '#ffd700',
		signal: '#db005b'
	},
	'blue accent': { primary: '#a5000a', accent: '#8abcdd' },
	'near neutral': { primary: '#1a1a1a' }
};
const schemes = ['light', 'dark'] as const;
const neutralFills = [
	'--m3-surface',
	'--m3-surface-dim',
	'--m3-surface-bright',
	'--m3-surface-container-lowest',
	'--m3-surface-container-low',
	'--m3-surface-container',
	'--m3-surface-container-high',
	'--m3-surface-container-highest'
];
const primaryFixed = ['--m3-primary-fixed', '--m3-primary-fixed-dim'];
const secondaryFixed = ['--m3-secondary-fixed', '--m3-secondary-fixed-dim'];

describe('enhanced contrast scheme', () => {
	it('preserves the existing standard palette roles for the eight reference seeds', () => {
		const standards = Object.values(seeds).flatMap((seed) =>
			[...schemes, 'inverted' as const].map((scheme) => {
				const implicit = computeOrisoPalette(seed, scheme);
				expect(computeOrisoPalette(seed, scheme, 'standard')).toEqual(
					implicit
				);
				if (scheme === 'inverted') {
					for (const level of ['medium', 'high'] as const) {
						expect(
							computeOrisoPalette(seed, scheme, level)
						).toEqual(implicit);
					}
				}
				return {
					...implicit,
					tokens: Object.fromEntries(
						Object.entries(implicit.tokens)
							.filter(
								([role]) =>
									!role.startsWith('--oriso-stage-brand')
							)
							.map(([role, value]) => [
								role,
								role === '--oriso-lottie-secondary-color'
									? implicit.tokens[
											'--m3-secondary-container'
										]
									: value
							])
					)
				};
			})
		);
		// The added brand roles and updated illustration stroke have separate tests.
		// SHA-256 of the ordered maps. FE#1134 changed only the dark roles: calm
		// dark accent (computed counterpart, #59302b for ORISO red), lifted dark surfaces (tone 11–12
		// instead of 4–6) and the new --oriso-card-divider, --oriso-outline-rest
		// --oriso-rail-badge-surface, --oriso-(on-)live-surface and
		// --oriso-stage-hero(-on), --oriso-fixed-accent-ink, --oriso-fixed-quiet-ink, --oriso-deep-brand-ink.
		// Passage highlight roles apply in every scheme. Dark Lottie accents
		// follow the resting outline.
		expect(
			createHash('sha256').update(JSON.stringify(standards)).digest('hex')
		).toBe(
			'ec8247a22060ad2f2766a89c464d7a8bc104f1b0416bfc7ddfd95f8314e72dd9'
		);
	});

	it.each(Object.entries(seeds))(
		'%s has the expected text and focus contrast in both schemes',
		(_name, seed) => {
			for (const scheme of schemes) {
				const standard = computeOrisoPalette(seed, scheme).tokens;
				for (const [level, threshold] of [
					['medium', 5.5],
					['high', 7]
				] as const) {
					const { tokens } = computeOrisoPalette(seed, scheme, level);
					const check = (
						ink: string,
						fills: string[],
						minimum: number = threshold
					) => {
						for (const fill of fills) {
							expect(
								wcagContrast(tokens[ink], tokens[fill]),
								`${scheme} ${level} ${ink} on ${fill}`
							).toBeGreaterThanOrEqual(minimum);
						}
					};

					// Dark + high keeps the deep surface ladder (FE#1134); the
					// standard dark surfaces were lifted off near-black.
					const deepDark = scheme === 'dark' && level === 'high';
					if (deepDark) {
						expect(tokens['--m3-surface']).toBe('#131314');
						expect(tokens['--m3-surface-container-lowest']).toBe(
							'#0e0e0f'
						);
					}
					for (const fill of [
						...(deepDark ? [] : neutralFills),
						'--m3-surface-variant',
						'--m3-inverse-surface',
						...primaryFixed,
						...secondaryFixed
					]) {
						expect(tokens[fill], fill).toBe(standard[fill]);
					}
					check('--m3-on-surface', neutralFills);
					check('--m3-on-surface-variant', [
						...neutralFills,
						'--m3-surface-variant'
					]);
					check('--m3-inverse-on-surface', ['--m3-inverse-surface']);
					check('--m3-inverse-primary', ['--m3-inverse-surface']);
					check('--oriso-primary-text', neutralFills);
					check('--oriso-error-text', neutralFills);
					check('--oriso-primary-text-hover', neutralFills);
					check('--oriso-primary-text-on-fixed', primaryFixed);
					for (const family of ['primary', 'secondary']) {
						const fixed =
							family === 'primary'
								? primaryFixed
								: secondaryFixed;
						check(`--m3-on-${family}-fixed`, fixed);
						check(`--m3-on-${family}-fixed-variant`, fixed);
					}
					for (const family of [
						'primary',
						'secondary',
						'tertiary',
						'error'
					]) {
						check(`--m3-on-${family}`, [`--m3-${family}`]);
						check(`--m3-on-${family}-container`, [
							`--m3-${family}-container`
						]);
					}
					check('--m3-on-primary', ['--m3-primary-hover']);
					check('--m3-outline', neutralFills, 3);
					check('--m3-primary-outline', primaryFixed, 3);
					check('--oriso-topic-tag-fg', ['--oriso-topic-tag-bg']);
					check('--oriso-topic-tag-active-fg', [
						'--oriso-topic-tag-active-bg'
					]);
					expect(tokens['--oriso-topic-tag-bg']).toBe(
						tokens['--m3-primary-fixed']
					);
					expect(tokens['--oriso-topic-tag-active-bg']).toBe(
						tokens['--m3-primary-container']
					);
					expect(tokens['--oriso-topic-tag-active-fg']).toBe(
						tokens['--m3-on-primary-container']
					);
					expect(tokens['--oriso-on-primary-fixed']).toBe(
						tokens['--m3-on-primary-fixed']
					);
					expect(tokens['--oriso-on-primary-fixed-variant']).toBe(
						tokens['--m3-on-primary-fixed-variant']
					);
					expect(tokens['--m3-on-background']).toBe(
						tokens['--m3-on-surface']
					);
					expect(tokens['--skin-color-primary-contrast-safe']).toBe(
						tokens['--oriso-primary-text']
					);
					expect(tokens['--primary']).toBe(tokens['--m3-primary']);
					expect(tokens['--hover-primary']).toBe(
						tokens['--m3-primary-hover']
					);
					expect(tokens['--oriso-lottie-secondary-color']).toBe(
						tokens[
							scheme === 'dark'
								? '--m3-outline'
								: '--m3-secondary-container'
						]
					);
				}
			}
		}
	);
});
