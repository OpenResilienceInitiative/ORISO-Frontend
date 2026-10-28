import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const expected = new Map([
	['Healthy', null],
	['Native Phone Viewport', null],
	['Legacy Phone Viewport', null],
	['Exact Expected Error', null],
	['Mui Theme', null],
	['State Writer', null],
	['State Reader', null],
	['Unnamed Button', 'button-name'],
	['Console Error', 'console-error: controlled-console-error'],
	['Uncaught Exception', 'uncaught-error:'],
	[
		'Unhandled Rejection',
		'unhandled-rejection: controlled-unhandled-rejection'
	],
	['Unexpected Request', 'unexpected-request:'],
	['Fallback', 'fallback:'],
	['Real Boundary Fallback', 'fallback:'],
	['Missing Expected Error', 'expected 1, received 0'],
	['Extra Expected Error', 'expected 1, received 2'],
	['Low Contrast', 'color-contrast'],
	['Missing Alt', 'image-alt'],
	['Known Baseline', 'Unapproved accessibility violation'],
	['Known Added Node', 'Unapproved accessibility violation'],
	['Known Worse Style', 'Unapproved accessibility violation'],
	['Known Operational Error', 'Unapproved accessibility violation'],
	['Missing Audit', 'Accessibility audit'],
	['Audit Error', 'Accessibility audit'],
	['Duplicate Audit', 'Accessibility audit'],
	['Strict Addon Violation', 'Unapproved accessibility violation'],
	['Declared Needs Data', 'fallback:']
]);
export const assertControlPhase = (directory, phase, status) => {
	const json = path.join(directory, 'controls.json');
	assert.equal(status, 1, 'Negative controls must fail their child run');
	const tests = JSON.parse(readFileSync(json, 'utf8')).testResults.flatMap(
		(suite) => suite.assertionResults
	);
	assert.equal(tests.length, expected.size);
	const checks = new Map(expected);
	if (phase === 'verify') {
		checks.set('Known Baseline', null);
		checks.set(
			'Known Operational Error',
			'console-error: approved story independent console failure'
		);
	}
	for (const [name, reason] of checks) {
		const test = tests.find((item) => item.title === name);
		assert.ok(test, `Missing ${name}`);
		assert.equal(
			test.status,
			reason ? 'failed' : 'passed',
			`Wrong ${phase} outcome: ${name}`
		);
		if (reason)
			assert.ok(
				test.failureMessages.join('\n').includes(reason),
				`Wrong ${phase} failure reason: ${name}`
			);
	}
	const runs = readdirSync(directory).filter((name) =>
		name.startsWith('run-')
	);
	assert.equal(runs.length, 1);
	const inventory = JSON.parse(
		readFileSync(path.join(directory, runs[0], 'inventory.json'), 'utf8')
	);
	assert.deepEqual(
		inventory.unhandledErrors,
		[],
		'Unhandled runner errors invalidate expected-negative proof'
	);
	assert.equal(inventory.inventoryComplete, true);
	assert.equal(inventory.executed, expected.size);
	assert.equal(inventory.skipped + inventory.todo + inventory.retries, 0);
	assert.equal(inventory.declaredNeedsData, 1);
	const cases = readFileSync(
		path.join(directory, runs[0], 'cases.jsonl'),
		'utf8'
	)
		.trim()
		.split('\n')
		.map(JSON.parse);
	const strict = cases.find((test) =>
		test.a11y?.storyId.endsWith('--strict-addon-violation')
	);
	assert.equal(strict.a11y.auditCount, 1);
	assert.equal(strict.a11y.strictAssertionCompanion, true);
	assert.equal(strict.a11y.reports.length, 2);
	assert.equal(strict.a11y.reports[0].result.testEngine.version, '4.7.0');
	assert.ok(strict.a11y.fingerprints.length > 0);
	assert.ok(
		strict.a11y.reports[1].result.error.includes('toHaveNoViolations')
	);
	assert.ok(
		!strict.errors.some((error) =>
			error.includes('Accessibility audit requires exactly one')
		)
	);
	return cases;
};

if (
	process.argv[1] &&
	import.meta.url === pathToFileURL(process.argv[1]).href
) {
	assertControlPhase(process.argv[2], process.argv[3], 1);
}
