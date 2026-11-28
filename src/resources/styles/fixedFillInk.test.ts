// @vitest-environment node

/**
 * Guard for text on the fixed brand fill (FE#1134). In dark the fill is the
 * calm counterpart (a deep tone), so inks that only work on the pale light
 * fill turn unreadable there (1.2:1 for the side-panel chip, 1.8:1 for
 * mentions). Text on `primary-fixed` must use an ink that follows the fill.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vite-plus/test';

const scssFiles = (dir: string): string[] =>
	readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) return scssFiles(path);
		return name.endsWith('.scss') ? [path] : [];
	});

const FIXED_FILL =
	/background(?:-color)?:\s*var\(--(?:m3|oriso)-primary-fixed[,)]/;
// Inks that stay dark in every scheme and therefore fail on the dark fill.
const FIXED_ONLY_INK =
	/^\s*color:\s*var\(--m3-(?:primary-container|on-secondary-fixed-variant)[,)]/;

/** The declarations of the innermost block around a line. */
const blockAround = (lines: string[], index: number): string[] => {
	let start = index;
	for (let depth = 0; start > 0; start -= 1) {
		depth += (lines[start].match(/}/g) ?? []).length;
		depth -= (lines[start].match(/{/g) ?? []).length;
		if (depth < 0) break;
	}
	let end = index;
	for (let depth = 0; end < lines.length - 1; end += 1) {
		depth += (lines[end].match(/{/g) ?? []).length;
		depth -= (lines[end].match(/}/g) ?? []).length;
		if (depth < 0) break;
	}
	return lines.slice(start + 1, end);
};

describe('text on the fixed brand fill', () => {
	it('uses an ink that follows the fill into dark mode', () => {
		const offenders = scssFiles('src').flatMap((file) => {
			const lines = readFileSync(file, 'utf8').split('\n');
			return lines.flatMap((line, index) =>
				FIXED_FILL.test(line) &&
				blockAround(lines, index).some((decl) =>
					FIXED_ONLY_INK.test(decl)
				)
					? [`${relative(process.cwd(), file)}:${index + 1}`]
					: []
			);
		});
		expect(offenders).toEqual([]);
	});
});
