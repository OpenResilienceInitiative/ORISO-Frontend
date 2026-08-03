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
import { describe, expect, it } from 'vitest';
import {
	buildCallThemeCss,
	CALL_THEME_ARTEFACT_PATH,
	CALL_TOKEN_MAP
} from './callTheme';
import { computeOrisoPalette } from './orisoScheme';

const SEED = '#A5000A';

/** Pulls one declaration out of a `.cpd-theme-*` block. */
const readToken = (css: string, scheme: string, token: string): string => {
	const block = new RegExp(
		`\\.cpd-theme-${scheme}[^{]*\\{([\\s\\S]*?)\\n\\}`,
		'm'
	).exec(css);
	if (!block) throw new Error(`no .cpd-theme-${scheme} block in output`);
	const decl = new RegExp(`${token}:\\s*([^;]+);`).exec(block[1]);
	return decl ? decl[1].trim() : '';
};

describe('buildCallThemeCss', () => {
	const css = buildCallThemeCss(SEED);
	const dark = computeOrisoPalette({ primary: SEED }, 'dark').tokens;
	const light = computeOrisoPalette({ primary: SEED }, 'light').tokens;

	it('emits a block for both Compound theme classes', () => {
		expect(css).toContain('.cpd-theme-dark');
		expect(css).toContain('.cpd-theme-light');
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
			[...Object.values(dark), ...Object.values(light)].map((v) =>
				v.toLowerCase()
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
const relativeLuminance = (hex: string): number => {
	const channel = (c: number): number =>
		c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	const [r, g, b] = [1, 3, 5].map((i) =>
		channel(parseInt(hex.slice(i, i + 2), 16) / 255)
	);
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrast = (a: string, b: string): number => {
	const [x, y] = [relativeLuminance(a), relativeLuminance(b)].sort(
		(m, n) => n - m
	);
	return (x + 0.05) / (y + 0.05);
};

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

describe.each(['dark', 'light'])('contrast in %s', (scheme) => {
	const css = buildCallThemeCss(SEED);
	const at = (token: string): string => readToken(css, scheme, token);

	it.each(TEXT_PAIRS)('%s on %s reaches AA (4.5)', (fg, bg) => {
		expect(contrast(at(fg), at(bg))).toBeGreaterThanOrEqual(4.5);
	});

	it.each(UI_PAIRS)('%s on %s reaches 3.0', (fg, bg) => {
		expect(contrast(at(fg), at(bg))).toBeGreaterThanOrEqual(3);
	});
});
