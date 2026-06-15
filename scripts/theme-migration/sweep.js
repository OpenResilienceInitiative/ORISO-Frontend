/**
 * THB-07 rename sweep: applies the legacy→M3 role mapping (mapping.json)
 * to every style file and scans for leftovers.
 *
 * Usage:
 *   node scripts/theme-migration/sweep.js --apply      rewrite files (css + sass + hex)
 *   node scripts/theme-migration/sweep.js --apply-hex  hex literals only
 *   node scripts/theme-migration/sweep.js --check      list violations
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

const BACKGROUND_PROPERTIES = /^(background|background-color)$/;
const ON_ROLE = /^--m3-on-/;
const SURFACE_ROLE = /^--m3-(surface|background)/;

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

const normalizeHexKey = (hex) => {
	let h = hex.toLowerCase();
	if (h.length === 4) {
		h = `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`;
	}
	return h;
};

const untouchedHex = new Set(
	(mapping.untouchedHex || []).map((h) => normalizeHexKey(h))
);

const hexConversions = mapping.hexConversions || {};
const hexPropertyOverrides = mapping.hexPropertyOverrides || {};
const hexLiteralPattern = /#([0-9a-fA-F]{3,8})\b/g;

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
 * Adjust mapped role so Test #27 role-misuse lint stays green:
 * on-* never on backgrounds; surface/background never on borders/colour props.
 */
const resolveHexRole = (baseRole, property) => {
	const prop = property.toLowerCase();
	if (BACKGROUND_PROPERTIES.test(prop)) {
		if (ON_ROLE.test(baseRole)) {
			return '--m3-secondary';
		}
		return baseRole;
	}
	if (/border|outline/.test(prop)) {
		if (SURFACE_ROLE.test(baseRole)) {
			return '--m3-outline-variant';
		}
		return baseRole;
	}
	if (/^color$|^fill$|^stroke$/.test(prop) && SURFACE_ROLE.test(baseRole)) {
		return '--m3-on-surface-variant';
	}
	return baseRole;
};

const lookupHexRole = (hexKey, property) => {
	const prop = property.toLowerCase();
	const override = hexPropertyOverrides[hexKey];
	if (override && override[prop]) {
		return override[prop];
	}
	const base = hexConversions[hexKey];
	if (!base) return null;
	return resolveHexRole(base, prop);
};

/** True when the hex at `index` is the fallback inside var(--m3-*, #hex). */
const isInsideM3Fallback = (line, index) => {
	const varStart = line.lastIndexOf('var(', index);
	if (varStart === -1) return false;
	const segment = line.slice(varStart);
	if (!/^var\(\s*--m3-/.test(segment)) return false;
	const close = segment.indexOf(')');
	if (close === -1) return false;
	const inner = segment.slice(4, close);
	const comma = inner.indexOf(',');
	return comma !== -1 && index >= varStart + 4 + comma + 1;
};

const isHighlightPaletteLine = (line) =>
	/data-color\s*=/.test(line) ||
	/\.messageItem__highlight\[data-color/.test(line);

/**
 * Converts mapped bare hex literals in CSS declaration values to
 * `var(--m3-<role>, #legacy)`.
 */
const convertHexLiterals = (content) => {
	const lines = content.split('\n');
	let depth = 0;
	const out = lines.map((line) => {
		const lineStart = depth;
		const propMatch = line.match(/^\s*([a-z-]+)\s*:/);
		const declaration = Boolean(propMatch);
		const property = propMatch ? propMatch[1] : '';
		const sassDefinition = /^\s*\$/.test(line);
		let rebuilt = '';
		let cursor = 0;
		hexLiteralPattern.lastIndex = 0;
		let match = hexLiteralPattern.exec(line);
		while (match) {
			const hex = match[0];
			const key = normalizeHexKey(hex);
			const before = line.slice(0, match.index);
			const depthHere =
				lineStart +
				(before.match(/\(/g) || []).length -
				(before.match(/\)/g) || []).length;
			const role = lookupHexRole(key, property);
			const shouldConvert =
				declaration &&
				!sassDefinition &&
				depthHere === 0 &&
				role &&
				!untouchedHex.has(key) &&
				!isInsideM3Fallback(line, match.index) &&
				!isHighlightPaletteLine(line);
			if (shouldConvert) {
				rebuilt += line.slice(cursor, match.index);
				rebuilt += `var(${role}, ${key})`;
				cursor = match.index + match[0].length;
			}
			match = hexLiteralPattern.exec(line);
		}
		rebuilt += line.slice(cursor);
		depth +=
			(line.match(/\(/g) || []).length - (line.match(/\)/g) || []).length;
		return rebuilt;
	});
	return out.join('\n');
};

/**
 * Converts bare `$legacy` value usages in CSS declarations to
 * `var(--m3-<role>, $legacy)`.
 */
const convertSassVars = (content) => {
	const lines = content.split('\n');
	let depth = 0;
	const out = lines.map((line) => {
		const lineStart = depth;
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

	if (!isExcluded(file)) {
		lines.forEach((line, index) => {
			if (/^\s*\$/.test(line) || isHighlightPaletteLine(line)) return;
			hexLiteralPattern.lastIndex = 0;
			let match = hexLiteralPattern.exec(line);
			while (match) {
				const key = normalizeHexKey(match[0]);
				if (
					untouchedHex.has(key) ||
					isInsideM3Fallback(line, match.index)
				) {
					match = hexLiteralPattern.exec(line);
					continue;
				}
				const known = (mapping.knownRawHexExceptions || []).some(
					(exc) =>
						exc.startsWith(`${relative(file)}:${index + 1}`) ||
						exc.startsWith(relative(file))
				);
				if (!known) {
					violations.push({
						file: relative(file),
						line: index + 1,
						kind: 'raw-hex',
						text: line.trim().slice(0, 100)
					});
				}
				match = hexLiteralPattern.exec(line);
			}
		});
	}

	return violations;
};

const scan = () => {
	const violations = [];
	for (const file of listStyleFiles()) {
		violations.push(...scanFile(file));
	}
	return violations;
};

const apply = (hexOnly = false) => {
	let changed = 0;
	for (const file of listStyleFiles()) {
		const original = fs.readFileSync(file, 'utf8');
		let next = original;
		if (!hexOnly) {
			next = renameCssVars(next);
		}
		if (!isExcluded(file)) {
			if (!hexOnly) {
				next = convertSassVars(next);
			}
			next = convertHexLiterals(next);
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
		const changed = apply(false);
		process.stdout.write(`rewrote ${changed} files\n`);
	} else if (mode === '--apply-hex') {
		const changed = apply(true);
		process.stdout.write(`rewrote ${changed} files (hex only)\n`);
	} else {
		const violations = scan();
		for (const v of violations) {
			process.stdout.write(`${v.kind}  ${v.file}:${v.line}  ${v.text}\n`);
		}
		process.stdout.write(`${violations.length} violations\n`);
		process.exitCode = violations.length ? 1 : 0;
	}
}
