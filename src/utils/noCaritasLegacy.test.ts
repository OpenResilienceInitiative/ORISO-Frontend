import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';
import { describe, expect, it } from 'vitest';

/**
 * FE-H05 (#178). Caritas is a third party. A Caritas legal URL served as this
 * platform's imprint or privacy policy is a wrong mandatory provider
 * disclosure under KDG/GDPR, and a Caritas storage key in shipped code is the
 * same class of legacy leak.
 *
 * This guard scans the code that actually ships. Story files, tests and the
 * translation catalogues are excluded: they carry Caritas as sample tenant
 * content, which is a separate (product-owned) clean-up.
 *
 * ## The logo assertion was deliberately dropped
 *
 * The original guard also forbade `02_caritas.svg`, because the login stage
 * rendered seven partner marks unconditionally and every tenant got them
 * whether they belonged to that family or not.
 *
 * The marks are back as the trigger for the stage lamp map, but as an
 * **opt-out set**: `StageCarrierLogos` renders only what
 * `theming.associationLogos` allows, so a tenant can switch off any mark that
 * is not theirs. Blocking the asset by filename would only push the same
 * exposure somewhere the guard cannot see.
 *
 * This narrows FE-H05, it does not close it. Until the admin panel ships the
 * multi-select that writes `theming.associationLogos`, the field is absent
 * everywhere and every tenant shows all seven marks — i.e. the original
 * finding still stands in production. #178 must stay open until then.
 */

const SRC = join(__dirname, '..');

const EXCLUDED_DIRS = new Set([
	'generated', // vendored OpenAPI output
	'i18n', // translation catalogues — product-owned copy
	'img', // binary/vector assets, checked via their import sites
	'__storybook__',
	'test'
]);

const isScannedFile = (path: string): boolean =>
	/\.(ts|tsx|js|jsx|scss)$/.test(path) &&
	!/\.(test|stories)\.[^.]+$/.test(path) &&
	!/StoryHelpers|storyDecorator/i.test(path);

const collectFiles = (dir: string, acc: string[] = []): string[] => {
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) {
			if (!EXCLUDED_DIRS.has(entry)) {
				collectFiles(full, acc);
			}
		} else if (isScannedFile(full)) {
			acc.push(full);
		}
	}
	return acc;
};

const findMatches = (pattern: RegExp): string[] =>
	collectFiles(SRC).flatMap((file) => {
		const lines = readFileSync(file, 'utf8').split('\n');
		return lines
			.map((line, index) => {
				if (!pattern.test(line)) {
					return null;
				}
				// The `LEGACY_*` constants are the documented migration path
				// off the old keys, not a leak. Prettier puts the value on
				// its own line, so look at the declaration above it too.
				const declaration = `${lines[index - 1] ?? ''}${line}`;
				if (declaration.includes('LEGACY_')) {
					return null;
				}
				return `${relative(SRC, file)}:${index + 1}: ${line.trim()}`;
			})
			.filter(Boolean) as string[];
	});

describe('no Caritas legacy in shipped frontend code', () => {
	it('never points a legal link at a Caritas domain', () => {
		expect(findMatches(/caritas[\w-]*\.(de|org|com)/i)).toEqual([]);
	});

	it('renders the partner marks only through the tenant-controlled list', () => {
		// The marks may be imported in exactly one place, the component that
		// applies `theming.associationLogos`. Anywhere else they would bypass
		// the tenant's opt-out.
		const importSites = findMatches(/img\/logos\/0\d_/i).map(
			(match) => match.split(':')[0]
		);
		expect(Array.from(new Set(importSites))).toEqual([
			'components/stage/StageCarrierLogos.tsx'
		]);
	});

	it('does not namespace browser storage or events under Caritas', () => {
		expect(findMatches(/['"`]caritas[_:]/i)).toEqual([]);
	});
});
