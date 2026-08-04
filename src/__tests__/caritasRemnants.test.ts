import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, resolve } from 'path';
import { describe, expect, it } from 'vitest';

/**
 * FE-H05 regression guard.
 *
 * Scoped deliberately to the three remnant classes this ticket removes:
 * third-party legal/organisation URLs, `caritas`-namespaced persistence, and
 * the Caritas-consortium logo assets. It does NOT ban the word "Caritas" —
 * translation copy and demo agency fixtures still legitimately name real
 * organisations, and rewriting that copy is a separate content decision.
 */
const SRC_ROOT = resolve(__dirname, '..');

const SKIPPED_DIRS = new Set(['node_modules', 'generated']);

/**
 * The one-way migration off the old keys has to name them. Only a `LEGACY_`
 * identifier earns that exemption, so a genuinely new `caritas_*` key still
 * fails. Drop these exemptions once the migration window closes.
 */
const LEGACY_MIGRATION_FILES = new Set([
	'utils/liveChatAvailabilityStorage.ts',
	'utils/liveChatToggle.ts',
	'utils/liveChatStorageMigration.test.ts'
]);
const LEGACY_DECLARATION = /LEGACY_[A-Z_]*(KEY|EVENT)/;
const SCANNED_EXTENSIONS = [
	'.ts',
	'.tsx',
	'.js',
	'.jsx',
	'.scss',
	'.css',
	'.svg',
	'.html'
];

const FORBIDDEN = [
	{
		label: 'third-party Caritas URL',
		pattern: /https?:\/\/[^\s'"`]*caritas[^\s'"`]*/i
	},
	{
		label: 'caritas-namespaced storage key or DOM event',
		pattern: /['"`]caritas[_:][A-Za-z]/
	},
	{
		label: 'Caritas-consortium logo asset',
		pattern: /resources\/img\/logos\/0\d_[a-z]+\.svg/i
	}
];

const collectFiles = (dir: string): string[] =>
	readdirSync(dir).flatMap((entry) => {
		const fullPath = join(dir, entry);
		if (statSync(fullPath).isDirectory()) {
			return SKIPPED_DIRS.has(entry) ? [] : collectFiles(fullPath);
		}
		return SCANNED_EXTENSIONS.some((ext) => entry.endsWith(ext))
			? [fullPath]
			: [];
	});

describe('Caritas remnants', () => {
	const files = collectFiles(SRC_ROOT).filter(
		(file) => file !== resolve(__filename)
	);

	it.each(FORBIDDEN)('has no $label left in src/', ({ pattern }) => {
		const offenders = files.flatMap((file) => {
			const relativePath = relative(SRC_ROOT, file);
			const allowsLegacyDeclaration =
				LEGACY_MIGRATION_FILES.has(relativePath);

			return readFileSync(file, 'utf8')
				.split('\n')
				.map((line, index) => ({ line, number: index + 1 }))
				.filter(({ line }) => pattern.test(line))
				.filter(
					({ line }) =>
						!(
							allowsLegacyDeclaration &&
							LEGACY_DECLARATION.test(line)
						)
				)
				.map(
					({ line, number }) =>
						`${relativePath}:${number}: ${line.trim()}`
				);
		});

		expect(offenders).toEqual([]);
	});
});
