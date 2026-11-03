import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { assertControlPhase } from './verification-control-results.mjs';

// Synthetic acceptance artifacts exercise the consumer, not an axe execution.
const positives = [
	'Healthy',
	'Native Phone Viewport',
	'Legacy Phone Viewport',
	'Exact Expected Error',
	'Mui Theme',
	'State Writer',
	'State Reader'
];
const negatives = {
	'Unnamed Button': 'button-name',
	'Console Error': 'console-error: controlled-console-error',
	'Uncaught Exception': 'uncaught-error:',
	'Unhandled Rejection':
		'unhandled-rejection: controlled-unhandled-rejection',
	'Unexpected Request': 'unexpected-request:',
	'Fallback': 'fallback:',
	'Real Boundary Fallback': 'fallback:',
	'Missing Expected Error': 'expected 1, received 0',
	'Extra Expected Error': 'expected 1, received 2',
	'Low Contrast': 'color-contrast',
	'Missing Alt': 'image-alt',
	'Known Baseline': 'Unapproved accessibility violation',
	'Known Added Node': 'Unapproved accessibility violation',
	'Known Worse Style': 'Unapproved accessibility violation',
	'Known Operational Error': 'Unapproved accessibility violation',
	'Missing Audit': 'Accessibility audit',
	'Audit Error': 'Accessibility audit',
	'Duplicate Audit': 'Accessibility audit',
	'Strict Addon Violation': 'Unapproved accessibility violation',
	'Declared Needs Data': 'fallback:'
};
const fixture = async (unhandledErrors) => {
	const directory = await mkdtemp(path.join(tmpdir(), 'frontend-phase-'));
	const tests = [
		...positives.map((title) => ({
			title,
			status: 'passed',
			failureMessages: []
		})),
		...Object.entries(negatives).map(([title, reason]) => ({
			title,
			status: 'failed',
			failureMessages: [reason]
		}))
	];
	await writeFile(
		path.join(directory, 'controls.json'),
		JSON.stringify({ testResults: [{ assertionResults: tests }] })
	);
	await mkdir(path.join(directory, 'run-synthetic'));
	await writeFile(
		path.join(directory, 'run-synthetic/inventory.json'),
		JSON.stringify({
			inventoryComplete: true,
			executed: 27,
			skipped: 0,
			todo: 0,
			retries: 0,
			declaredNeedsData: 1,
			unhandledErrors
		})
	);
	const strict = {
		errors: ['Unapproved accessibility violation'],
		a11y: {
			storyId: 'temporary--strict-addon-violation',
			auditCount: 1,
			strictAssertionCompanion: true,
			fingerprints: ['synthetic-fingerprint'],
			reports: [
				{ result: { testEngine: { version: '4.7.0' } } },
				{ result: { error: 'expect(...).toHaveNoViolations(...)' } }
			]
		}
	};
	const cases = tests.map((item) => ({
		name: item.title,
		state: item.status,
		...(item.title === 'Strict Addon Violation' ? strict : {})
	}));
	await writeFile(
		path.join(directory, 'run-synthetic/cases.jsonl'),
		cases.map(JSON.stringify).join('\n') + '\n'
	);
	return directory;
};
const invoke = (directory, t) =>
	new Promise((resolve, reject) => {
		const args = [
			path.resolve('scripts/verification-control-results.mjs'),
			directory,
			'capture'
		];
		const child = spawn(process.execPath, args);
		t.diagnostic(
			JSON.stringify({
				childPid: child.pid,
				command: [process.execPath, ...args],
				cwd: process.cwd()
			})
		);
		let output = '';
		child.stdout.on('data', (data) => {
			output += data;
		});
		child.stderr.on('data', (data) => {
			output += data;
		});
		child.on('error', reject);
		child.on('close', (code) => resolve({ code, output }));
	});
test('accepts complete expected-negative artifacts with no independent runner error', async (t) => {
	const directory = await fixture([]);
	try {
		assert.equal(assertControlPhase(directory, 'capture', 1).length, 27);
		assert.equal((await invoke(directory, t)).code, 0);
	} finally {
		await rm(directory, { recursive: true });
	}
});
test('rejects an extra runner error at the same phase seam and native CLI', async (t) => {
	const directory = await fixture(['controlled-unrelated-runner-error']);
	try {
		const native = await invoke(directory, t);
		assert.notEqual(
			native.code,
			0,
			'Expected-negative proof must reject unrelated runner errors'
		);
		assert.match(native.output, /runner.*unhandled|Unhandled runner/i);
		assert.throws(
			() => assertControlPhase(directory, 'capture', 1),
			/runner.*unhandled|Unhandled runner/i
		);
	} finally {
		await rm(directory, { recursive: true });
	}
});
