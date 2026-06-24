/**
 * THB-07 sweep guards: completeness grep (#25), fallback check (#26)
 * and the role-misuse lint (#27 / #3) for the frontend styles.
 *
 * The scan logic lives in scripts/theme-migration/sweep.js — the same
 * code that applied the rename — so "swept" is defined in one place.
 *
 * Traces: UAT-D (enabler), UAT-H usage guard.
 */
import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';
// CJS module; vite interops module.exports as the default export.
import sweep from '../../../scripts/theme-migration/sweep.js';
import { computeOrisoPalette } from './orisoScheme';

const engineTokens = Object.keys(
	computeOrisoPalette({ primary: '#A5000A' }, 'light').tokens
);

describe('completeness grep (Test #25)', () => {
	it('no legacy colour usage remains outside the pinned exceptions', () => {
		const violations = sweep.scan();
		const unexpected = violations.filter(
			(v: { kind: string; file: string; text: string }) =>
				!(
					v.kind === 'function-wrapped' &&
					sweep.mapping.knownFunctionWrappedExceptions.some(
						(known: string) => known.startsWith(v.file)
					)
				)
		);
		expect(unexpected).toEqual([]);
	});

	it('the pinned function-wrapped exceptions still exist (else unpin them)', () => {
		const wrapped = sweep
			.scan()
			.filter((v: { kind: string }) => v.kind === 'function-wrapped');
		expect(wrapped.length).toBe(
			sweep.mapping.knownFunctionWrappedExceptions.length
		);
	});
});

const styleFiles: string[] = sweep.listStyleFiles();

const readDeclarations = (
	content: string
): Array<{ property: string; value: string }> => {
	const declarations: Array<{ property: string; value: string }> = [];
	const pattern = /(?<![\w$-])([a-zA-Z-]+)\s*:\s*([^;{}]*)/g;
	for (const match of content.matchAll(pattern)) {
		declarations.push({
			property: match[1].toLowerCase(),
			value: match[2]
		});
	}
	return declarations;
};

describe('fallback check (Test #26)', () => {
	it('every var(--m3-*) usage in styles carries an explicit fallback', () => {
		const missing: string[] = [];
		for (const file of styleFiles) {
			const content = fs.readFileSync(file, 'utf8');
			for (const match of content.matchAll(
				/var\(\s*(--m3-[a-z0-9-]+)\s*([,)])/g
			)) {
				if (match[2] !== ',') {
					missing.push(
						`${path.relative(process.cwd(), file)}: ${match[1]} without fallback`
					);
				}
			}
		}
		expect(missing).toEqual([]);
	});

	it('every mapped role is emitted by the engine (contract stays closed)', () => {
		const mappedRoles = [
			...Object.values(sweep.mapping.cssVarRenames),
			...Object.values(sweep.mapping.sassVarConversions)
		] as string[];
		const unknown = mappedRoles.filter(
			(role) => !engineTokens.includes(role)
		);
		expect(unknown).toEqual([]);
	});
});

describe('role-misuse lint (Test #27 / #3)', () => {
	const COLOUR_PROPERTIES =
		/^(color|fill|stroke|caret-color|text-decoration-color|column-rule-color|border(-(top|right|bottom|left))?(-color)?|outline(-color)?|text-emphasis-color)$/;
	const BACKGROUND_PROPERTIES = /^(background|background-color)$/;

	it('on-* roles appear only in colour-like properties', () => {
		const violations: string[] = [];
		for (const file of styleFiles) {
			const content = fs.readFileSync(file, 'utf8');
			for (const { property, value } of readDeclarations(content)) {
				for (const match of value.matchAll(
					/var\(\s*(--m3-on-[a-z0-9-]+)/g
				)) {
					if (BACKGROUND_PROPERTIES.test(property)) {
						violations.push(
							`${path.relative(process.cwd(), file)}: ${match[1]} used in ${property}`
						);
					}
				}
			}
		}
		expect(violations).toEqual([]);
	});

	it('surface/container/background roles appear only in background-like properties', () => {
		const violations: string[] = [];
		const surfaceToken =
			/var\(\s*(--m3-(surface(-[a-z0-9-]+)?|background))\s*[,)]/g;
		for (const file of styleFiles) {
			const content = fs.readFileSync(file, 'utf8');
			for (const { property, value } of readDeclarations(content)) {
				for (const match of value.matchAll(surfaceToken)) {
					if (
						!BACKGROUND_PROPERTIES.test(property) &&
						COLOUR_PROPERTIES.test(property)
					) {
						violations.push(
							`${path.relative(process.cwd(), file)}: ${match[1]} used in ${property}`
						);
					}
				}
			}
		}
		expect(violations).toEqual([]);
	});
});

/**
 * Hex layer zero-drift guard (#143).
 *
 * The hex sweep is value-matched: every `var(--m3-<role>, #legacy)` must
 * render <=JND of #legacy on dev TODAY — either the role is still undefined
 * at :root (the #legacy fallback wins) or the role's resolved :root value is
 * within a just-noticeable-difference of #legacy. This reads the real
 * mui-variables-mapping.scss / settings.scss, so it fails the moment a
 * mapping (or a token redefinition) would shift a colour on merge.
 */
describe('hex layer zero-drift (#143)', () => {
	const repoFile = (rel: string): string =>
		fs.readFileSync(path.join(process.cwd(), rel), 'utf8');

	const sassVars: Record<string, string> = {};
	for (const m of repoFile('src/resources/styles/settings.scss').matchAll(
		/^\$([\w-]+):\s*(#[0-9a-fA-F]{3,8})\s*(?:;|\/)/gm
	)) {
		sassVars[m[1]] = m[2];
	}

	// Resolved dev :root values for the colour --m3-* tokens. Roles absent
	// here are undefined on dev, so their fallback renders verbatim.
	const devTokens: Record<string, string> = {};
	for (const m of repoFile(
		'src/resources/styles/mui-variables-mapping.scss'
	).matchAll(/(--m3-[a-z0-9-]+):\s*([^;]+);/g)) {
		const value = m[2].trim();
		const ref = value.match(/^#\{\$([\w-]+)\}$/);
		if (/^#[0-9a-fA-F]{3,8}$/.test(value)) devTokens[m[1]] = value;
		else if (ref && sassVars[ref[1]]) devTokens[m[1]] = sassVars[ref[1]];
	}

	const channels = (hex: string): number[] => {
		let h = hex.toLowerCase().replace('#', '');
		if (h.length === 3 || h.length === 4)
			h = h
				.slice(0, 3)
				.split('')
				.map((c) => c + c)
				.join('');
		if (h.length === 8) h = h.slice(0, 6);
		return [0, 2, 4].map((i) => {
			const c = parseInt(h.slice(i, i + 2), 16) / 255;
			return c <= 0.04045
				? c / 12.92
				: Math.pow((c + 0.055) / 1.055, 2.4);
		});
	};
	const toLab = (hex: string): number[] => {
		const [r, g, b] = channels(hex);
		let x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
		let y = r * 0.2126 + g * 0.7152 + b * 0.0722;
		let z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
		const f = (t: number): number =>
			t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
		[x, y, z] = [f(x), f(y), f(z)];
		return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
	};
	const deltaE = (a: string, b: string): number => {
		const [l1, a1, b1] = toLab(a);
		const [l2, a2, b2] = toLab(b);
		return Math.sqrt((l1 - l2) ** 2 + (a1 - a2) ** 2 + (b1 - b2) ** 2);
	};
	const JND = 2.5;
	const hexConversions = sweep.mapping.hexConversions as Record<
		string,
		string
	>;

	it('every hex maps to a token that renders within JND on dev (or stays undefined → fallback wins)', () => {
		const drift: string[] = [];
		for (const [hex, role] of Object.entries(hexConversions)) {
			const value = devTokens[role];
			if (value && deltaE(hex, value) > JND) {
				drift.push(
					`${hex} → ${role} renders ${value} (ΔE ${deltaE(hex, value).toFixed(1)})`
				);
			}
		}
		expect(drift).toEqual([]);
	});

	it('every hex role is emitted by the engine (contract stays closed)', () => {
		const unknown = [...new Set(Object.values(hexConversions))].filter(
			(role) => !engineTokens.includes(role)
		);
		expect(unknown).toEqual([]);
	});

	it('hex targets must be statically defined at :root (not runtime-only tokens)', () => {
		const staticRoles = new Set<string>();
		for (const m of repoFile(
			'src/resources/styles/mui-variables-mapping.scss'
		).matchAll(/(--m3-[a-z0-9-]+):/g)) {
			staticRoles.add(m[1]);
		}
		const runtimeOnly = Object.entries(hexConversions)
			.filter(([, role]) => !staticRoles.has(role))
			.map(([hex, role]) => `${hex} → ${role}`);
		expect(runtimeOnly).toEqual([]);
	});
});
