// Regression tests for the Oxlint ratchet gate. Run: npm run test:oxlint-ratchet
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	compareToBaseline,
	countByFileAndRule,
	formatBaseline,
	parseReport
} from './oxlint-ratchet.mjs';

const root = '/repo';
const finding = (file, code) => ({ filename: `${root}/${file}`, code });
const baseline = {
	'src/a.ts': { 'anti-slop(no-runtime-typeof)': 2 },
	'src/b.ts': { 'eslint(no-unused-vars)': 1 }
};

describe('countByFileAndRule', () => {
	it('counts per relative file and rule with sorted keys', () => {
		const counts = countByFileAndRule(
			[
				finding('src/b.ts', 'z-rule'),
				finding('src/a.ts', 'y-rule'),
				finding('src/b.ts', 'a-rule'),
				finding('src/b.ts', 'z-rule')
			],
			root
		);
		assert.deepEqual(counts, {
			'src/a.ts': { 'y-rule': 1 },
			'src/b.ts': { 'a-rule': 1, 'z-rule': 2 }
		});
		assert.deepEqual(Object.keys(counts), ['src/a.ts', 'src/b.ts']);
		assert.deepEqual(Object.keys(counts['src/b.ts']), ['a-rule', 'z-rule']);
	});
});

describe('compareToBaseline', () => {
	it('passes when counts are unchanged', () => {
		assert.deepEqual(compareToBaseline(structuredClone(baseline), baseline), {
			increases: [],
			decreased: 0
		});
	});

	it('passes and reports when counts go down or a file disappears', () => {
		const result = compareToBaseline(
			{ 'src/a.ts': { 'anti-slop(no-runtime-typeof)': 1 } },
			baseline
		);
		assert.deepEqual(result.increases, []);
		assert.equal(result.decreased, 2);
	});

	it('fails when a known file/rule pair goes up', () => {
		const result = compareToBaseline(
			{ ...baseline, 'src/a.ts': { 'anti-slop(no-runtime-typeof)': 3 } },
			baseline
		);
		assert.deepEqual(result.increases, [
			{
				file: 'src/a.ts',
				rule: 'anti-slop(no-runtime-typeof)',
				count: 3,
				allowed: 2
			}
		]);
	});

	it('fails for a new rule in a known file and for a new file', () => {
		const result = compareToBaseline(
			{
				...baseline,
				'src/b.ts': { 'eslint(no-unused-vars)': 1, 'react(jsx-key)': 1 },
				'src/new.ts': { 'eslint(no-unused-vars)': 1 }
			},
			baseline
		);
		assert.deepEqual(
			result.increases.map(({ file, rule, allowed }) => [file, rule, allowed]),
			[
				['src/b.ts', 'react(jsx-key)', 0],
				['src/new.ts', 'eslint(no-unused-vars)', 0]
			]
		);
	});
});

describe('formatBaseline (what --update writes)', () => {
	it('writes tab-indented JSON with a trailing newline that round-trips', () => {
		const text = formatBaseline(baseline);
		assert.ok(text.endsWith('}\n'));
		assert.ok(text.includes('\n\t"src/a.ts"'));
		assert.deepEqual(JSON.parse(text), baseline);
	});
});

describe('parseReport', () => {
	it('returns the diagnostics of a valid report', () => {
		const diagnostics = [finding('src/a.ts', 'x')];
		assert.deepEqual(
			parseReport(JSON.stringify({ diagnostics, number_of_files: 3 })),
			diagnostics
		);
	});

	it('throws on output that is not JSON', () => {
		assert.throws(() => parseReport('Failed to load config'), SyntaxError);
	});

	it('throws when the report has no diagnostics list', () => {
		assert.throws(
			() => parseReport(JSON.stringify({ number_of_files: 3 })),
			/no diagnostics list/
		);
	});

	it('throws when Oxlint checked no files', () => {
		assert.throws(
			() => parseReport(JSON.stringify({ diagnostics: [], number_of_files: 0 })),
			/checked no files/
		);
	});
});
