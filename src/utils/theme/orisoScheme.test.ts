/**
 * Golden lock for the OrisoScheme colour engine (THB-01).
 *
 * Benchmark: __fixtures__/Light.tokens.json — the hand-tuned Figma MD3
 * export for seed #A5000A. This is the look the team already ships in
 * ORISO-Admin (app.css --m3-* block is hex-identical to it).
 *
 * Tolerance (agreed 2026-06-10): the 9 token values already consumed by
 * the Admin app layer must match EXACTLY (string-equal); every other
 * locked role must match within HCT tone ±1 AND ΔE2000 ≤ 2.
 *
 * Traces: UAT-B (Tests #1, #2, #5, #6, #9 in THB — Test Logic).
 */
import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';
import { computeOrisoPalette } from './orisoScheme';
import {
	collectConsumedM3Tokens,
	deltaE2000,
	loadBenchmarkSchemes,
	toneDiff
} from './testUtils';

const BENCHMARK_SEED = '#A5000A';
const TONE_TOLERANCE = 1;
const DELTA_E_TOLERANCE = 2;

const fixturePath = path.join(__dirname, '__fixtures__', 'Light.tokens.json');
const benchmark = loadBenchmarkSchemes(fixturePath);

/**
 * The 9 tokens the ORISO-Admin app layer already consumes
 * (ORISO-Admin/src/app.css). Swapping the static block for engine output
 * is provably invisible only if these match string-exactly.
 */
const EXACT_CONTRACT_TOKENS: Record<string, string> = {
	'--m3-surface': 'Surface',
	'--m3-on-surface': 'On Surface',
	'--m3-surface-variant': 'Surface Variant',
	'--m3-on-surface-variant': 'On Surface Variant',
	'--m3-surface-container-lowest': 'Surface Container Lowest',
	'--m3-surface-container-low': 'Surface Container Low',
	'--m3-surface-container': 'Surface Container',
	'--m3-surface-container-high': 'Surface Container High',
	'--m3-surface-container-highest': 'Surface Container Highest'
};

/**
 * Every other benchmark role the engine must reproduce within tolerance.
 *
 * Deliberately excluded:
 * - 'Secondary' (#655f65): internally inconsistent in the Figma file —
 *   hue 318 while its own container family sits at hue 249. The engine
 *   derives the whole secondary family from one palette instead.
 * - 'Background' (#f3eeee): inconsistent with 'Surface' in the file;
 *   the engine maps background onto the surface role.
 * - Fixed roles beyond the primary pair: not consumed anywhere in
 *   ORISO. Primary Fixed / On Primary Fixed ARE locked — the light
 *   brand tint is the chat-bubble surface of the counselling app.
 */
const TOLERANCE_TOKENS: Record<string, string> = {
	'--m3-primary': 'Primary',
	'--m3-on-primary': 'On Primary',
	'--m3-primary-container': 'Primary Container',
	'--m3-on-primary-container': 'On Primary Container',
	'--m3-on-secondary': 'On Secondary',
	'--m3-secondary-container': 'Secondary Container',
	'--m3-on-secondary-container': 'On Secondary Container',
	'--m3-tertiary': 'Tertiary',
	'--m3-on-tertiary': 'On Tertiary',
	'--m3-tertiary-container': 'Tertiary Container',
	'--m3-on-tertiary-container': 'On Tertiary Container',
	'--m3-error': 'Error',
	'--m3-on-error': 'On Error',
	'--m3-error-container': 'Error Container',
	'--m3-on-error-container': 'On Error Container',
	'--m3-surface-dim': 'Surface Dim',
	'--m3-surface-bright': 'Surface Bright',
	'--m3-outline': 'Outline',
	'--m3-outline-variant': 'Outline Variant',
	'--m3-inverse-surface': 'Inverse Surface',
	'--m3-inverse-on-surface': 'Inverse On Surface',
	'--m3-inverse-primary': 'Inverse Primary',
	'--m3-primary-fixed': 'Primary Fixed',
	'--m3-primary-fixed-dim': 'Primary Fixed Dim',
	'--m3-on-primary-fixed': 'On Primary Fixed',
	'--m3-on-primary-fixed-variant': 'On Primary Fixed Variant',
	'--m3-surface-tint': 'Surface Tint',
	'--m3-shadow': 'Shadow',
	'--m3-scrim': 'Scrim'
};

describe('OrisoScheme golden lock (seed #A5000A, light)', () => {
	const { tokens } = computeOrisoPalette(
		{ primary: BENCHMARK_SEED },
		'light'
	);

	// Test #2 — the 9 contract tokens match the Admin app layer exactly.
	it.each(Object.entries(EXACT_CONTRACT_TOKENS))(
		'%s equals the benchmark exactly (%s)',
		(token, role) => {
			expect(benchmark[role]).toBeDefined();
			expect(tokens[token]?.toLowerCase()).toBe(benchmark[role]);
		}
	);

	// Tests #5/#6 — core roles within HCT tone ±1 and ΔE2000 ≤ 2.
	it.each(Object.entries(TOLERANCE_TOKENS))(
		'%s matches the benchmark within tolerance (%s)',
		(token, role) => {
			expect(benchmark[role]).toBeDefined();
			const got = tokens[token];
			expect(got, `engine emits ${token}`).toBeDefined();
			expect(
				toneDiff(got, benchmark[role]),
				`HCT tone of ${token}: got ${got}, want ${benchmark[role]}`
			).toBeLessThanOrEqual(TONE_TOLERANCE);
			expect(
				deltaE2000(got, benchmark[role]),
				`ΔE2000 of ${token}: got ${got}, want ${benchmark[role]}`
			).toBeLessThanOrEqual(DELTA_E_TOLERANCE);
		}
	);

	// Test #9 — pure and deterministic: identical seeds → identical map.
	it('is deterministic for identical seeds', () => {
		const again = computeOrisoPalette({ primary: BENCHMARK_SEED }, 'light');
		expect(again.tokens).toEqual(tokens);
	});

	it('emits every value as a #rrggbb hex string', () => {
		for (const [token, value] of Object.entries(tokens)) {
			expect(value, token).toMatch(/^#[0-9a-f]{6}$/);
		}
	});

	it('maps ORISO semantic aliases onto the generated M3 palette', () => {
		expect(tokens['--oriso-lottie-accent-color']).toBe(
			tokens['--m3-primary-fixed-dim']
		);
		expect(tokens['--oriso-lottie-secondary-color']).toBe(
			tokens['--m3-secondary-container']
		);
		expect(tokens['--oriso-primary-fixed']).toBe(
			tokens['--m3-primary-fixed']
		);
		expect(tokens['--oriso-app-action']).toBe(tokens['--m3-primary']);
	});
});

// Test #1 — generated token contract: every var(--m3-*) consumed in this
// repo must be emitted by the engine. The inventory is scanned, never
// hand-maintained; styling a new component with a new role token grows
// the contract automatically.
describe('--m3-* token contract (generated inventory)', () => {
	it('engine emits every consumed token', () => {
		const consumed = collectConsumedM3Tokens([
			path.join(__dirname, '..', '..')
		]);
		const { tokens } = computeOrisoPalette(
			{ primary: BENCHMARK_SEED },
			'light'
		);
		const missing = consumed.filter((name) => !(name in tokens));
		expect(missing).toEqual([]);
	});
});

/**
 * The static :root brand block (mui-variables-mapping.scss) is the default
 * Caritas palette used when no tenant seed is stored. It MUST equal the
 * engine output for the brand seed #a5000a, so the static default and any
 * seed-driven theme render the same brand — and so the #cc1e1c primary
 * regression cannot come back. (Neutrals are asserted against the golden
 * benchmark above; this guards the brand family.)
 */
describe('static :root brand mirrors the engine (#a5000a)', () => {
	const scss = fs.readFileSync(
		path.join(
			process.cwd(),
			'src/resources/styles/mui-variables-mapping.scss'
		),
		'utf8'
	);
	const staticValue = (name: string): string | undefined =>
		scss
			.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{3,8})\\s*;`))?.[1]
			?.toLowerCase();
	const engine = computeOrisoPalette({ primary: '#a5000a' }, 'light').tokens;

	it.each([
		'--m3-primary',
		'--m3-primary-hover',
		'--m3-primary-container',
		'--m3-on-primary-container',
		'--m3-primary-outline'
	])('%s static literal equals the engine value', (token) => {
		expect(staticValue(token)).toBe(engine[token].toLowerCase());
	});
});

/**
 * Dark set keeps the messenger's grayish identity (not seed-tinted/pinkish).
 * The engine already computes a dark scheme; this guards that its neutrals
 * stay near-neutral grey and the secondary stays a cool slate, so whenever
 * end-user dark mode is switched on the brand character is preserved.
 */
describe('dark scheme preserves the grayish identity', () => {
	const dark = computeOrisoPalette({ primary: '#a5000a' }, 'dark').tokens;
	const rgb = (hex: string): number[] =>
		[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
	const spread = (hex: string): number => {
		const [r, g, b] = rgb(hex);
		return Math.max(r, g, b) - Math.min(r, g, b);
	};

	it.each(['--m3-surface', '--m3-background', '--m3-on-surface'])(
		'%s is a near-neutral grey, not seed-tinted',
		(token) => {
			expect(spread(dark[token])).toBeLessThan(10);
		}
	);

	it('dark secondary is a cool slate (blue ≥ red), never a warm pink', () => {
		const [r, , b] = rgb(dark['--m3-secondary']);
		expect(b).toBeGreaterThanOrEqual(r);
	});
});
