import { describe, expect, it } from 'vitest';
import { Hct, argbFromHex } from '@material/material-color-utilities';
import { computeOrisoPalette } from './orisoScheme';
import {
	HIGH_CONTRAST_CANDIDATES,
	computeHighContrastTokens,
	evaluateContrastPairs
} from './highContrastCandidates';

// Tenant seeds the candidates must survive: the default red, a medium blue,
// a light yellow and a light blue (#1499: a light Traeger seed gave 1.2:1),
// and a green.
const SEEDS = {
	red: '#A5000A',
	blue: '#0B66C3',
	yellow: '#F2C200',
	lightBlue: '#9ED2EE',
	green: '#2E7D32'
};

// WCAG 2.2: UI components and icons need 3:1 (1.4.11).
const UI_MINIMUM = 3;

describe('HIGH_CONTRAST_CANDIDATES', () => {
	it('offers three distinct candidates', () => {
		expect(HIGH_CONTRAST_CANDIDATES).toHaveLength(3);
		expect(new Set(HIGH_CONTRAST_CANDIDATES.map((c) => c.id)).size).toBe(3);
		expect(new Set(HIGH_CONTRAST_CANDIDATES.map((c) => c.name)).size).toBe(
			3
		);
	});

	it('promises at least the 7:1 AAA text ratio', () => {
		for (const candidate of HIGH_CONTRAST_CANDIDATES) {
			expect(candidate.textTarget).toBeGreaterThanOrEqual(7);
		}
	});
});

describe('computeHighContrastTokens', () => {
	for (const candidate of HIGH_CONTRAST_CANDIDATES) {
		for (const [seedName, seed] of Object.entries(SEEDS)) {
			it(`${candidate.id} meets its targets with a ${seedName} tenant`, () => {
				const tokens = computeHighContrastTokens(candidate.id, {
					primary: seed
				});

				const misses = evaluateContrastPairs(tokens)
					.filter(({ pair }) => pair.enforced)
					.filter(({ pair, rating }) =>
						pair.kind === 'text'
							? rating.ratio < candidate.textTarget
							: rating.ratio < UI_MINIMUM
					)
					.map(({ pair, rating }) => `${pair.id} ${rating.ratio}`);

				expect(misses).toEqual([]);
			});
		}
	}

	it('keeps a tenant colour that is already dark enough as it is', () => {
		// #A5000A carries white at 8.06:1, above every candidate's text target
		// up to AAA, so a candidate has no reason to move the brand.
		const tokens = computeHighContrastTokens('tinted-aaa', {
			primary: SEEDS.red
		});

		expect(tokens['--m3-primary'].toLowerCase()).toBe('#a5000a');
		expect(tokens['--m3-on-primary']).toBe('#ffffff');
	});

	it('darkens a light tenant colour but stays in its hue family', () => {
		const tokens = computeHighContrastTokens('tinted-aaa', {
			primary: SEEDS.yellow
		});

		const seedHue = Hct.fromInt(argbFromHex(SEEDS.yellow)).hue;
		const resultHue = Hct.fromInt(argbFromHex(tokens['--m3-primary'])).hue;
		expect(tokens['--m3-primary'].toLowerCase()).not.toBe('#f2c200');
		expect(Math.abs(resultHue - seedHue)).toBeLessThan(12);
	});

	it('defines every token the standard palette defines', () => {
		const standard = computeOrisoPalette({ primary: SEEDS.blue }, 'light');

		for (const candidate of HIGH_CONTRAST_CANDIDATES) {
			const tokens = computeHighContrastTokens(candidate.id, {
				primary: SEEDS.blue
			});

			expect(Object.keys(tokens).sort()).toEqual(
				Object.keys(standard.tokens).sort()
			);
		}
	});
});

describe('evaluateContrastPairs', () => {
	it('flags the hard-coded button focus ring as a token bypass', () => {
		const tokens = computeOrisoPalette(
			{ primary: SEEDS.red },
			'light'
		).tokens;

		const focus = evaluateContrastPairs({
			...tokens,
			'--m3-surface': '#ffffff'
		}).find(({ pair }) => pair.id === 'focus-ring-button');

		// Button.scss draws it as $focus-blue #199fff: 2.82:1 on white.
		expect(focus?.pair.enforced).toBe(false);
		expect(focus?.rating.ratio).toBeCloseTo(2.82, 2);
		expect(focus?.rating.grade).toBe('fail');
	});

	it('flags the hard-coded session-row inks as token bypasses', () => {
		const tokens = computeOrisoPalette(
			{ primary: SEEDS.red },
			'light'
		).tokens;

		const bypasses = evaluateContrastPairs(tokens)
			.filter(({ pair }) => ['row-name', 'row-preview'].includes(pair.id))
			.map(({ pair }) => pair.enforced);

		expect(bypasses).toEqual([false, false]);
	});

	it('does not hold disabled controls to the text minimum', () => {
		const tokens = computeOrisoPalette(
			{ primary: SEEDS.red },
			'light'
		).tokens;

		const disabled = evaluateContrastPairs(tokens).find(
			({ pair }) => pair.id === 'button-disabled'
		);

		// WCAG 1.4.3 exempts inactive components.
		expect(disabled?.pair.enforced).toBe(false);
	});
});
