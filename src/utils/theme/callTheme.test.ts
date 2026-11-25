/**
 * Element Call theme mapping (Frontend#897).
 *
 * The call UI runs on Compound's `--cpd-*` semantic roles; ORISO speaks
 * `--m3-*`. These tests lock the bridge between them: every value the
 * call renders must come out of the OrisoScheme engine, so a re-tune of
 * the engine can never leave the call behind.
 */
import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vite-plus/test';
import {
	buildCallThemeCss,
	CALL_THEME_ARTEFACT_PATH,
	CALL_TOKEN_MAP
} from './callTheme';
import { computeOrisoPalette } from './orisoScheme';
import { wcagContrast } from './wcagContrast';

const SEED = '#A5000A';

const selectors = {
	standard: {
		light: '.cpd-theme-light.cpd-theme-light',
		dark: '.cpd-theme-dark.cpd-theme-dark'
	},
	medium: {
		light: '.cpd-theme-light[data-oriso-contrast-level="medium"]',
		dark: '.cpd-theme-dark[data-oriso-contrast-level="medium"]'
	},
	high: {
		light: '.cpd-theme-light-hc.cpd-theme-light-hc',
		dark: '.cpd-theme-dark-hc.cpd-theme-dark-hc'
	}
} as const;

/** Pulls one declaration out of the exact selected Compound block. */
const readToken = (
	css: string,
	scheme: keyof typeof selectors.standard,
	token: string,
	level: keyof typeof selectors = 'standard'
): string => {
	const selector = selectors[level][scheme];
	const prefix = `${selector} {\n`;
	const start = css.indexOf(prefix);
	if (start < 0) throw new Error(`no ${selector} block in output`);
	const block = css.slice(start + prefix.length, css.indexOf('\n}', start));
	const decl = block
		.split('\n')
		.find((line) => line.startsWith(`\t${token}: `));
	return decl?.split(';')[0].slice(token.length + 3) ?? '';
};

describe('buildCallThemeCss', () => {
	const css = buildCallThemeCss(SEED);
	const dark = computeOrisoPalette({ primary: SEED }, 'dark').tokens;
	const light = computeOrisoPalette({ primary: SEED }, 'light').tokens;

	it('emits one block for each scheme and contrast level', () => {
		expect(css.match(/^\.cpd-theme-.* \{$/gm)).toEqual(
			Object.values(selectors).flatMap((schemes) =>
				Object.values(schemes).map((selector) => `${selector} {`)
			)
		);
	});

	it('maps body text onto the engine on-surface role', () => {
		expect(readToken(css, 'dark', '--cpd-color-text-primary')).toBe(
			dark['--m3-on-surface']
		);
		expect(readToken(css, 'light', '--cpd-color-text-primary')).toBe(
			light['--m3-on-surface']
		);
	});

	it('maps the canvas onto the engine surface role', () => {
		expect(readToken(css, 'dark', '--cpd-color-bg-canvas-default')).toBe(
			dark['--m3-surface']
		);
	});

	it.each(Object.entries(CALL_TOKEN_MAP))(
		'%s traces exactly to its engine role in both schemes',
		(cpdToken, mapping) => {
			for (const tokens of [light, dark]) {
				const scheme = tokens === light ? 'light' : 'dark';
				const expected =
					mapping.alpha === undefined
						? tokens[mapping.m3]
						: `color-mix(in srgb, ${tokens[mapping.m3]} ${mapping.alpha}%, transparent)`;
				expect(readToken(css, scheme, cpdToken)).toBe(expected);
			}
		}
	);

	it('is deterministic — same seed, byte-identical output', () => {
		expect(buildCallThemeCss(SEED)).toBe(css);
	});

	it('writes no colour of its own: every value traces to the engine', () => {
		const engineValues = new Set(
			(['light', 'dark'] as const).flatMap((scheme) =>
				(['standard', 'medium', 'high'] as const).flatMap((level) =>
					Object.values(
						computeOrisoPalette({ primary: SEED }, scheme, level)
							.tokens
					).map((value) => value.toLowerCase())
				)
			)
		);
		const hexes = css.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
		const foreign = [...new Set(hexes.map((h) => h.toLowerCase()))].filter(
			(h) => !engineValues.has(h)
		);
		expect(foreign).toEqual([]);
	});

	it('carries provenance so nobody hand-edits the artefact', () => {
		expect(css).toMatch(/GENERATED/);
		expect(css).toContain(SEED.toLowerCase());
	});
});

/**
 * The drift guard. The Element Call fork ships a copy of this artefact,
 * so the failure mode to prevent is a re-tuned engine with a stale
 * stylesheet — exactly how the Figma export drifted 11 roles out of date
 * before anyone noticed.
 */
describe('the checked-in artefact', () => {
	// Same location constant as the generator CLI — the two cannot drift.
	const artefact = path.join(
		__dirname,
		'..',
		'..',
		'..',
		CALL_THEME_ARTEFACT_PATH
	);

	it('exists', () => {
		expect(fs.existsSync(artefact)).toBe(true);
	});

	it('still matches the engine — regenerate it if this fails', () => {
		expect(fs.readFileSync(artefact, 'utf8')).toBe(buildCallThemeCss(SEED));
	});
});

/**
 * The bug this epic exists to fix was unreadable text, so readability is
 * asserted rather than eyeballed. Pairs are the ones a user actually
 * looks at: labels on their real surface, button text on the button,
 * and the focus ring against the canvas behind it.
 *
 * WCAG 2.1: 4.5 for body text, 3.0 for UI boundaries and icons.
 */
const TEXT_PAIRS: [string, string][] = [
	['--cpd-color-text-primary', '--cpd-color-bg-canvas-default'],
	// The Settings dialog sheet — the exact surface that was unreadable.
	['--cpd-color-text-primary', '--cpd-color-bg-subtle-primary'],
	['--cpd-color-text-primary', '--cpd-color-bg-subtle-secondary'],
	['--cpd-color-text-secondary', '--cpd-color-bg-canvas-default'],
	['--cpd-color-text-secondary', '--cpd-color-bg-subtle-primary'],
	['--cpd-color-text-on-solid-primary', '--cpd-color-bg-action-primary-rest'],
	['--cpd-color-text-critical-primary', '--cpd-color-bg-canvas-default']
];

const UI_PAIRS: [string, string][] = [
	['--cpd-color-icon-primary', '--cpd-color-bg-canvas-default'],
	['--cpd-color-icon-secondary', '--cpd-color-bg-canvas-default'],
	['--cpd-color-icon-on-solid-primary', '--cpd-color-bg-action-primary-rest'],
	// A focus ring nobody can see is the same as no focus ring.
	['--cpd-color-border-focused', '--cpd-color-bg-canvas-default'],
	['--cpd-color-border-focused', '--cpd-color-bg-subtle-primary'],
	// The regression that caused this epic. The fork forced
	// --cpd-color-alpha-gray-1400 to opaque #000 to get black video tiles,
	// not realising Compound derives --cpd-color-icon-primary-alpha from
	// it — and that in the dark theme it is near-WHITE (hsla(214,78%,98%,
	// .95)). Every icon on that role went black-on-black. Mapping the two
	// concerns separately is the fix; this asserts they stay separate.
	['--cpd-color-icon-primary-alpha', '--cpd-color-bg-canvas-default'],
	['--cpd-color-icon-secondary-alpha', '--cpd-color-bg-canvas-default']
];

describe.each(['dark', 'light'] as const)('contrast in %s', (scheme) => {
	const css = buildCallThemeCss(SEED);
	const at = (token: string): string => readToken(css, scheme, token);

	it.each(TEXT_PAIRS)('%s on %s reaches AA (4.5)', (fg, bg) => {
		expect(wcagContrast(at(fg), at(bg))).toBeGreaterThanOrEqual(4.5);
	});

	it.each(UI_PAIRS)('%s on %s reaches 3.0', (fg, bg) => {
		expect(wcagContrast(at(fg), at(bg))).toBeGreaterThanOrEqual(3);
	});
});

describe.each([
	{ level: 'medium', minimum: 5.5 },
	{ level: 'high', minimum: 7 }
] as const)('elevated contrast in $level', ({ level, minimum }) => {
	it.each([
		[SEED, 'light'],
		[SEED, 'dark'],
		['#ffd700', 'light'],
		['#ffd700', 'dark']
	] as const)(
		'keeps text and focus legible with %s in %s',
		(seed, scheme) => {
			const css = buildCallThemeCss(seed);
			const at = (token: string) => readToken(css, scheme, token, level);
			for (const [foreground, background] of [
				...TEXT_PAIRS,
				[
					'--cpd-color-text-critical-primary',
					'--cpd-color-bg-subtle-primary'
				],
				[
					'--cpd-color-text-placeholder',
					'--cpd-color-bg-subtle-primary'
				],
				[
					'--cpd-color-text-link-external',
					'--cpd-color-bg-subtle-primary'
				],
				[
					'--cpd-color-text-action-accent',
					'--cpd-color-bg-subtle-primary'
				]
			]) {
				expect(
					wcagContrast(at(foreground), at(background)),
					foreground
				).toBeGreaterThanOrEqual(minimum);
			}
			for (const [foreground, background] of UI_PAIRS) {
				expect(
					wcagContrast(at(foreground), at(background)),
					foreground
				).toBeGreaterThanOrEqual(3);
			}
		}
	);
});
