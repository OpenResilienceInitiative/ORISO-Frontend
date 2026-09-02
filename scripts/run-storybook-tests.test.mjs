import assert from 'node:assert/strict';
import test from 'node:test';

import {
	MAX_BROWSER_DISCONNECT_RETRIES,
	shouldRetryStorybookRun,
	storybookVitestArgs
} from './run-storybook-tests.mjs';

const disconnect = '[vitest] Browser connection was closed while running tests';

test('retries when the browser disconnect is the only reported failure', () => {
	assert.equal(shouldRetryStorybookRun(1, disconnect), true);
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
		false
	);
});

test('caps Storybook workers and allows several disconnect retries', () => {
	assert.equal(MAX_BROWSER_DISCONNECT_RETRIES, 4);
	assert.deepEqual(
		storybookVitestArgs.filter((arg) => arg.startsWith('--maxWorkers')),
		['--maxWorkers=2']
	);
});
