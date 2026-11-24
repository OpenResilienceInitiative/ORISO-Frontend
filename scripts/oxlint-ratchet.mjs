#!/usr/bin/env node
// Oxlint ratchet: the number of findings per file and rule may go down, never up.
//
//   npm run lint:oxlint          check against tools/oxlint/baseline.json (CI)
//   npm run lint:oxlint:update   rewrite the baseline after fixing findings
//
// Rules and ignores live in tools/oxlint/oxlintrc.json. Existing findings are frozen in the
// baseline, so only new code has to be clean. Rename or move a file? Run the update script and
// let the reviewer see the baseline diff.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const config = resolve(root, 'tools/oxlint/oxlintrc.json');
const baselinePath = resolve(root, 'tools/oxlint/baseline.json');
const binary = resolve(root, 'node_modules/.bin/oxlint');
const update = process.argv.includes('--update');
// Production code only: tests, stories, mocks and generated API types are out of scope.
// Passed on the command line because config ignorePatterns resolve relative to the config file.
const ignorePatterns = ['**/*.stories.*', '**/stories/**', '**/*.test.*', '**/*.spec.*', '**/__tests__/**', '**/__mocks__/**', '**/generated/**'];

function runOxlint() {
	let output;
	try {
		output = execFileSync(binary, ['-c', config, '-f', 'json', ...ignorePatterns.flatMap((pattern) => ['--ignore-pattern', pattern]), 'src'], {
			cwd: root,
			encoding: 'utf8',
			maxBuffer: 1024 * 1024 * 512,
			stdio: ['ignore', 'pipe', 'inherit']
		});
	} catch (error) {
		// Oxlint exits 1 when it reports errors; the JSON report is still on stdout.
		if (typeof error.stdout !== 'string' || error.stdout.length === 0) throw error;
		output = error.stdout;
	}
	const report = JSON.parse(output);
	if (!report.number_of_files) throw new Error('Oxlint checked no files; check the config.');
	return report.diagnostics;
}

function countByFileAndRule(diagnostics) {
	const counts = {};
	for (const diagnostic of diagnostics) {
		const file = relative(root, diagnostic.filename).split('\\').join('/');
		counts[file] ??= {};
		counts[file][diagnostic.code] = (counts[file][diagnostic.code] ?? 0) + 1;
	}
	const sorted = {};
	for (const file of Object.keys(counts).sort()) {
		sorted[file] = {};
		for (const rule of Object.keys(counts[file]).sort()) sorted[file][rule] = counts[file][rule];
	}
	return sorted;
}

const diagnostics = runOxlint();
const current = countByFileAndRule(diagnostics);

if (update) {
	writeFileSync(baselinePath, `${JSON.stringify(current, null, '\t')}\n`);
	console.log(`Baseline written: ${diagnostics.length} findings in ${Object.keys(current).length} files.`);
	process.exit(0);
}

if (!existsSync(baselinePath)) {
	console.error('No baseline found. Run `npm run lint:oxlint:update` once and commit tools/oxlint/baseline.json.');
	process.exit(1);
}

const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
const increases = [];
let decreased = 0;

for (const [file, rules] of Object.entries(current)) {
	for (const [rule, count] of Object.entries(rules)) {
		const allowed = baseline[file]?.[rule] ?? 0;
		if (count > allowed) increases.push({ file, rule, count, allowed });
	}
}
for (const [file, rules] of Object.entries(baseline)) {
	for (const [rule, allowed] of Object.entries(rules)) {
		if ((current[file]?.[rule] ?? 0) < allowed) decreased += 1;
	}
}

if (increases.length > 0) {
	console.error(`Oxlint ratchet: ${increases.length} file/rule pairs have new findings.\n`);
	for (const { file, rule, count, allowed } of increases) {
		console.error(`${file}  ${rule}  ${count} (baseline ${allowed})`);
		for (const diagnostic of diagnostics) {
			if (diagnostic.code !== rule || !diagnostic.filename.endsWith(file)) continue;
			const line = diagnostic.labels?.[0]?.span?.line ?? '?';
			console.error(`    ${file}:${line}  ${diagnostic.message}`);
		}
	}
	console.error(
		'\nFix the new findings. Existing ones on the same lines may show too; only the count matters.' +
			'\nIf a file was only moved or renamed, run `npm run lint:oxlint:update` and commit the baseline.'
	);
	process.exit(1);
}

console.log(`Oxlint ratchet passed: ${diagnostics.length} findings, none new.`);
if (decreased > 0) {
	console.log(`${decreased} file/rule pairs went down. Run \`npm run lint:oxlint:update\` to lock that in.`);
}
