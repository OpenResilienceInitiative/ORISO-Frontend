import assert from 'node:assert/strict';
import test from 'node:test';

import {
	MAX_BROWSER_DISCONNECT_RETRIES,
	looksLikeBrowserDisconnect,
	shouldRetryStorybookRun,
	storybookVitestArgs
} from './run-storybook-tests.mjs';

const disconnect = '[vitest] Browser connection was closed while running tests';
const abortedGreenSummary = [
	' Test Files  132 passed (171)',
	'      Tests  808 passed (808)',
	'     Errors  1 error'
].join('\n');

test('retries when the browser disconnect is the only reported failure', () => {
	assert.equal(shouldRetryStorybookRun(1, disconnect), true);
});

test('retries an aborted-green summary even if the disconnect line was not captured', () => {
	// The disconnect is the last thing Vitest prints. Resolving on `close`
	// before stderr `end` can drop that line; the incomplete file count is
	// printed earlier and is enough to retry.
	assert.equal(looksLikeBrowserDisconnect(abortedGreenSummary), true);
	assert.equal(shouldRetryStorybookRun(1, abortedGreenSummary), true);
});

test('retries an ANSI-wrapped disconnect line', () => {
	assert.equal(
		shouldRetryStorybookRun(
			1,
			`\u001b[31m\u001b[1mError\u001b[22m: ${disconnect}. Was the page closed unexpectedly?\u001b[39m`
		),
		true
	);
});

test('does not retry and mask a failed assertion reported before the disconnect', () => {
	assert.equal(
		shouldRetryStorybookRun(
			1,
			`AssertionError: expected false to be true\nTests 1 failed\n${disconnect}`
		),
		false
	);
});

test('does not retry ordinary test failures or successful runs', () => {
	for (const output of [
		`FAIL  story.test.ts\n${disconnect}`,
		`Test Files 2 failed\n${disconnect}`,
		`Tests 1 failed\n${disconnect}`
	]) {
		assert.equal(shouldRetryStorybookRun(1, output), false);
	}
	assert.equal(shouldRetryStorybookRun(0, disconnect), false);
	assert.equal(
		looksLikeBrowserDisconnect(
			' Test Files  171 passed (171)\n      Tests  900 passed (900)'
		),
		false
	);
});

test('still retries a disconnect when captured output was truncated', () => {
	assert.equal(
		shouldRetryStorybookRun(1, disconnect, {
			failureDetected: false,
			outputTruncated: true
		}),
		true
	);
});

test('still retries a disconnect-only abort when the log was truncated', () => {
	// The Storybook run emits thousands of "Module … has been externalized"
	// lines, so MAX_CAPTURED_OUTPUT is crossed on every CI run. Gating the
	// retry on truncation made it unreachable and turned the disconnect flake
	// into a hard failure. `failureDetected` is latched against the live
	// stream, so truncation cannot hide a failure from us.
	assert.equal(
		shouldRetryStorybookRun(1, disconnect, {
			failureDetected: true,
			outputTruncated: true
		}),
		true
	);
});

test('a real failure in a truncated log still blocks the retry', () => {
	assert.equal(
		shouldRetryStorybookRun(1, `Tests 3 failed\n${disconnect}`, {
			failureDetected: false,
			outputTruncated: true
		}),
		true
	);
});

test('caps Storybook workers and allows several disconnect retries', () => {
	assert.equal(MAX_BROWSER_DISCONNECT_RETRIES, 4);
	assert.deepEqual(
		storybookVitestArgs.filter((arg) => arg.startsWith('--maxWorkers')),
		['--maxWorkers=2']
	);
});
