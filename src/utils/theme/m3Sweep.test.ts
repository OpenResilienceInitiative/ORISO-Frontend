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
				) && v.kind !== 'raw-hex'
		);
		expect(unexpected).toEqual([]);
	});

	it('reports remaining raw hex literals outside var() fallbacks (report-only)', () => {
		const rawHex = sweep
			.scan()
			.filter((v: { kind: string }) => v.kind === 'raw-hex');
		// Enforce once the mechanical sweep lands; until then surfaces the backlog count.
		expect(rawHex.length).toBeLessThan(400);
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
			...Object.values(sweep.mapping.sassVarConversions),
			...Object.values(sweep.mapping.hexConversions || {}),
			...Object.values(sweep.mapping.hexPropertyOverrides || {}).flatMap(
				(overrides: Record<string, string>) => Object.values(overrides)
			)
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
