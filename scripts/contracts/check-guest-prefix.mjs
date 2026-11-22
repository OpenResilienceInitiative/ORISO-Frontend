#!/usr/bin/env node
// ORISO-Frontend#2347: nobody is an anonymous guest because of their name.
// Guests and registered users both get rolled animal User-IDs, and a
// registered name may start with "anon". Whether a person is a guest comes
// from the session's registrationType / conversationType or the ANONYMOUS
// authority. This check fails when non-test source under src/ looks for the
// historical `anon_` / `Anonymous-` login prefix outside the allowlist in
// scripts/contracts/guest-prefix-allowlist.txt.
//
// Usage: node scripts/contracts/check-guest-prefix.mjs [repoRoot]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PREFIX = String.raw`(?:anon_|anonymous-)`;

/** Ways of matching on the prefix: a `^anon_` regex/RegExp source, a string
 *  method called with the prefix, or the bare prefix as a literal. */
export const PREFIX_PATTERNS = [
	new RegExp(String.raw`\^\(?(?:\?:)?${PREFIX}`, 'i'),
	new RegExp(
		String.raw`\.(?:startsWith|endsWith|includes|indexOf|lastIndexOf|match|matchAll|search|replace|replaceAll|split)\(\s*['"\`]${PREFIX}`,
		'i'
	),
	new RegExp(String.raw`(['"\`])${PREFIX}\1`, 'i')
];

const SOURCE_FILE = /\.(?:[cm]?[jt]sx?)$/;
const EXCLUDED_FILE = /\.(?:test|spec|stories)\.[cm]?[jt]sx?$/;
const EXCLUDED_DIR = new Set([
	'__fixtures__',
	'fixtures',
	'__mocks__',
	'generated'
]);

const isCommentLine = (line) => /^\s*(?:\/\/|\/\*|\*)/.test(line);

export const findPrefixChecks = (source) =>
	source
		.split('\n')
		.map((text, index) => ({ line: index + 1, text }))
		.filter(
			({ text }) =>
				!isCommentLine(text) &&
				PREFIX_PATTERNS.some((pattern) => pattern.test(text))
		);

export const readAllowlist = (file) => {
	const entries = new Map();
	for (const raw of fs.readFileSync(file, 'utf8').split('\n')) {
		const line = raw.trim();
		if (!line || line.startsWith('#')) continue;
		const [entryPath, reason] = line.split('|').map((part) => part?.trim());
		if (!entryPath || !reason) {
			throw new Error(
				`guest-prefix-allowlist.txt: "${line}" needs "<path> | <reason>"`
			);
		}
		entries.set(entryPath, reason);
	}
	return entries;
};

const sourceFiles = (dir) =>
	fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const file = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			return EXCLUDED_DIR.has(entry.name) ? [] : sourceFiles(file);
		}
		return SOURCE_FILE.test(entry.name) && !EXCLUDED_FILE.test(entry.name)
			? [file]
			: [];
	});

export const checkGuestPrefix = (root) => {
	const allowlist = readAllowlist(
		path.join(root, 'scripts/contracts/guest-prefix-allowlist.txt')
	);
	const violations = [];
	const used = new Set();
	for (const file of sourceFiles(path.join(root, 'src'))) {
		const relative = path.relative(root, file).split(path.sep).join('/');
		const hits = findPrefixChecks(fs.readFileSync(file, 'utf8'));
		if (hits.length === 0) continue;
		if (allowlist.has(relative)) {
			used.add(relative);
			continue;
		}
		for (const hit of hits) violations.push({ file: relative, ...hit });
	}
	const stale = [...allowlist.keys()].filter((entry) => !used.has(entry));
	return { violations, stale };
};

const main = () => {
	const root = path.resolve(
		process.argv[2] ??
			path.join(path.dirname(fileURLToPath(import.meta.url)), '../..')
	);
	const { violations, stale } = checkGuestPrefix(root);
	for (const v of violations) {
		console.error(`${v.file}:${v.line}: ${v.text.trim()}`);
	}
	for (const entry of stale) {
		console.error(
			`guest-prefix-allowlist.txt: ${entry} no longer checks the prefix; remove the entry`
		);
	}
	if (violations.length || stale.length) {
		console.error(
			'\nGuest detection by the anon_ / Anonymous- name prefix (ORISO-Frontend#2347).\n' +
				'Decide by the session registrationType / conversationType (getModality) or the\n' +
				'ANONYMOUS authority (isAnonymousAsker). To hide a raw legacy login label, use\n' +
				'isLegacyGuestLoginLabel from src/utils/anonymousChatDisplayName.ts.'
		);
		process.exit(1);
	}
	console.log('guest-prefix guard: no name-prefix guest detection in src/.');
};

if (
	process.argv[1] &&
	path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	main();
}
