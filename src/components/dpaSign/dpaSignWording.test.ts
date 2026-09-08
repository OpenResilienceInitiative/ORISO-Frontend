import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import de from '../../resources/i18n/de/common.json';
import deInformal from '../../resources/i18n/de@informal/common.json';
import en from '../../resources/i18n/en/common.json';

/**
 * Owner terminology rule (pre-dev review 2026-08-31): user-facing copy speaks
 * of "Vertragsunterlagen", never of "AVV" — the register the Admin panel's
 * forward dialog (`dpaForward.*` in ORISO-Admin) already uses. This pins the
 * public signing page to it, catalogue values and inline fallbacks alike, so
 * a later edit cannot quietly reintroduce the abbreviation.
 */

const flatten = (node: unknown, prefix = ''): Record<string, string> =>
	Object.entries(node as Record<string, unknown>).reduce(
		(acc, [key, value]) => {
			const path = prefix ? `${prefix}.${key}` : key;
			if (typeof value === 'string') {
				acc[path] = value;
			} else if (value && typeof value === 'object') {
				Object.assign(acc, flatten(value, path));
			}
			return acc;
		},
		{} as Record<string, string>
	);

const catalogues: [string, Record<string, string>][] = [
	['de', flatten((de as any).dpaSign)],
	['de@informal', flatten((deInformal as any).dpaSign)],
	['en', flatten((en as any).dpaSign)]
];

describe('dpaSign wording', () => {
	it.each(catalogues)(
		'%s: the page title says Vertragsunterlagen unterzeichnen',
		(locale, values) => {
			expect(values.title).toBe(
				locale === 'en'
					? 'Sign contract documents'
					: 'Vertragsunterlagen unterzeichnen'
			);
		}
	);

	it.each(catalogues)(
		'%s: no dpaSign value says "AVV" or falls back to the Vereinbarung register',
		(_locale, values) => {
			for (const [key, value] of Object.entries(values)) {
				expect(value, `dpaSign.${key}`).not.toMatch(/\bAVV\b/);
				expect(value, `dpaSign.${key}`).not.toMatch(/Vereinbarung/);
			}
		}
	);

	it('the inline fallbacks in DpaSign.tsx follow the same register', () => {
		// Fallbacks render whenever a catalogue misses a key, so they must
		// not carry the old register either. Comments are stripped first —
		// they may explain history in whatever words they need; everything
		// left is code, and the only German words in code are the fallbacks.
		const source = readFileSync(join(__dirname, 'DpaSign.tsx'), 'utf8')
			.replace(/\/\*[\s\S]*?\*\//g, '')
			.replace(/^\s*\/\/.*$/gm, '');
		expect(source).not.toMatch(/\bAVV\b/);
		expect(source).not.toMatch(/Vereinbarung/);
	});
});
