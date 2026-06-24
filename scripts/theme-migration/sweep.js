/**
 * THB-07 rename sweep: applies the legacy→M3 role mapping (mapping.json)
 * to every style file and scans for leftovers.
 *
 * Usage:
 *   node scripts/theme-migration/sweep.js --apply   rewrite files
 *   node scripts/theme-migration/sweep.js --check   list violations
 *
 * The same scan powers the completeness test (#25) and the fallback
 * check (#26) in src/utils/theme/m3Sweep.test.ts, so "done" is defined
 * in exactly one place.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const mapping = JSON.parse(
	fs.readFileSync(path.join(__dirname, 'mapping.json'), 'utf8')
);

const STYLE_EXTENSIONS = ['.scss', '.css'];

const listStyleFiles = () => {
	const files = [];
	const visit = (dir) => {
		for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
			const full = path.join(dir, entry.name);
			if (entry.isDirectory()) {
				if (entry.name === 'node_modules' || entry.name.startsWith('.'))
					continue;
				visit(full);
				continue;
			}
			if (STYLE_EXTENSIONS.includes(path.extname(entry.name))) {
				files.push(full);
			}
		}
	};
	visit(path.join(ROOT, 'src'));
	return files;
};

const relative = (file) => path.relative(ROOT, file).split(path.sep).join('/');

const isExcluded = (file) => mapping.excludedFiles.includes(relative(file));

/** Longest first so prefixed names never shadow each other. */
const cssRenames = Object.entries(mapping.cssVarRenames).sort(
	(a, b) => b[0].length - a[0].length
);

const renameCssVars = (content) => {
	let result = content;
	for (const [from, to] of cssRenames) {
		result = result.split(from).join(to);
	}
	return result;
};

const sassVars = Object.keys(mapping.sassVarConversions);
const sassVarPattern = new RegExp(
	`\\$(${sassVars.map((v) => v.slice(1)).join('|')})(?![\\w-])`,
	'g'
);

/**
 * Converts bare `$legacy` value usages in CSS declarations to
 * `var(--m3-<role>, $legacy)`. Only parenthesis-depth-0 occurrences in
 * declaration values are touched: occurrences inside any function call
 * (var() fallbacks, rgba(), darken(), mixin arguments) and Sass
 * variable definitions stay as they are. Depth is tracked across lines
 * (multi-line var() calls exist in the tree).
 */
const convertSassVars = (content) => {
	const lines = content.split('\n');
	let depth = 0;
	const out = lines.map((line) => {
		const lineStart = depth;
		// A declaration value position: "prop: ..." where prop is not a Sass var.
		const declaration = /^\s*[a-z-]+\s*:/.test(line);
		let rebuilt = '';
		let cursor = 0;
		sassVarPattern.lastIndex = 0;
		let match = sassVarPattern.exec(line);
		while (match) {
			const before = line.slice(0, match.index);
			const depthHere =
				lineStart +
				(before.match(/\(/g) || []).length -
				(before.match(/\)/g) || []).length;
			const varName = `$${match[1]}`;
			const role = mapping.sassVarConversions[varName];
			if (declaration && depthHere === 0) {
				rebuilt += line.slice(cursor, match.index);
				rebuilt += `var(${role}, ${varName})`;
				cursor = match.index + match[0].length;
			}
			match = sassVarPattern.exec(line);
		}
		rebuilt += line.slice(cursor);
		depth +=
			(line.match(/\(/g) || []).length - (line.match(/\)/g) || []).length;
		return rebuilt;
	});
	return out.join('\n');
};

/** Scan one file for leftover legacy usages (post-sweep must be empty). */
const scanFile = (file) => {
	const content = fs.readFileSync(file, 'utf8');
	const violations = [];
	const lines = content.split('\n');
	let depth = 0;
	lines.forEach((line, index) => {
		const lineStart = depth;
		if (
			/--skin-color-|--text-color-contrast|--text-color-secondary-contrast/.test(
				line
			)
		) {
			violations.push({
				file: relative(file),
				line: index + 1,
				kind: 'legacy-css-var',
				text: line.trim().slice(0, 100)
			});
		}
		if (!isExcluded(file)) {
			sassVarPattern.lastIndex = 0;
			let match = sassVarPattern.exec(line);
			while (match) {
				const before = line.slice(0, match.index);
				const depthHere =
					lineStart +
					(before.match(/\(/g) || []).length -
					(before.match(/\)/g) || []).length;
				const declaration = /^\s*[a-z-]+\s*:/.test(line);
				const insideM3Fallback = new RegExp(
					`var\\(--m3-[a-z0-9-]+,\\s*\\${match[0]}\\s*\\)`
				).test(line);
				if (declaration && depthHere === 0) {
					violations.push({
						file: relative(file),
						line: index + 1,
						kind: 'bare-sass-var',
						text: line.trim().slice(0, 100)
					});
				} else if (
					declaration &&
					depthHere > 0 &&
					!insideM3Fallback &&
					!/var\(/.test(before)
				) {
					violations.push({
						file: relative(file),
						line: index + 1,
						kind: 'function-wrapped',
						text: line.trim().slice(0, 100)
					});
				}
				match = sassVarPattern.exec(line);
			}
		}
		depth +=
			(line.match(/\(/g) || []).length - (line.match(/\)/g) || []).length;
	});
	return violations;
};

const scan = () => {
	const violations = [];
	for (const file of listStyleFiles()) {
		violations.push(...scanFile(file));
	}
	return violations;
};

const apply = () => {
	let changed = 0;
	for (const file of listStyleFiles()) {
		const original = fs.readFileSync(file, 'utf8');
		let next = renameCssVars(original);
		if (!isExcluded(file)) {
			next = convertSassVars(next);
		}
		if (next !== original) {
			fs.writeFileSync(file, next);
			changed += 1;
		}
	}
	return changed;
};

module.exports = { apply, scan, listStyleFiles, mapping };

if (require.main === module) {
	const mode = process.argv[2];
	if (mode === '--apply') {
		const changed = apply();
		process.stdout.write(`rewrote ${changed} files\n`);
	} else {
		const violations = scan();
		for (const v of violations) {
			process.stdout.write(`${v.kind}  ${v.file}:${v.line}  ${v.text}\n`);
		}
		process.stdout.write(`${violations.length} violations\n`);
		process.exitCode = violations.length ? 1 : 0;
	}
}
