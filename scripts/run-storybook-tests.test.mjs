import assert from 'node:assert/strict';
import test from 'node:test';

import {
	DEFAULT_STORYBOOK_SHARDS,
	MAX_BROWSER_DISCONNECT_RETRIES,
	looksLikeBrowserDisconnect,
	resolveShardCount,
	shouldRetryStorybookRun,
	storybookShardArgs,
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

test('splits the suite into sequential shards so one browser session never drives the whole queue', () => {
	// Every full-suite attempt in ORISO-Frontend#1316 run 34016457101 died at
	// ~95-107 of 175 files; a shard keeps each orchestrator tab well below that.
	assert.equal(DEFAULT_STORYBOOK_SHARDS, 4);
	assert.deepEqual(storybookShardArgs(2, 4), [
		...storybookVitestArgs,
		'--shard=2/4'
	]);
});

test('runs unsharded when a single shard is requested', () => {
	assert.deepEqual(storybookShardArgs(1, 1), storybookVitestArgs);
});

test('reads the shard count from STORYBOOK_TEST_SHARDS and falls back to the default', () => {
	assert.equal(resolveShardCount({ STORYBOOK_TEST_SHARDS: '6' }), 6);
	assert.equal(
		resolveShardCount({ STORYBOOK_TEST_SHARDS: '0' }),
		DEFAULT_STORYBOOK_SHARDS
	);
	assert.equal(
		resolveShardCount({ STORYBOOK_TEST_SHARDS: 'abc' }),
		DEFAULT_STORYBOOK_SHARDS
	);
	assert.equal(resolveShardCount({}), DEFAULT_STORYBOOK_SHARDS);
});
