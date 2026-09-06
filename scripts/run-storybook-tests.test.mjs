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

test('a failure latched off the live stream blocks the retry', () => {
	// The Storybook run emits thousands of "Module … has been externalized"
	// lines, so MAX_CAPTURED_OUTPUT is crossed on every CI run and truncation
	// alone must not gate the retry (the test above). `failureDetected` is a
	// different signal: it is latched in `forwardOutput` as the run streams, so
	// it reports a failure that truncation has since scrolled out of the buffer
	// — and it must still stop the retry from masking it.
	assert.equal(
		shouldRetryStorybookRun(1, disconnect, {
			failureDetected: true,
			outputTruncated: true
		}),
		false
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

test('retries the interleaved, ANSI-coloured abort from CI run 33968368364', () => {
	// Two streams share one buffer, so stderr stack frames land between the
	// stdout summary lines and the coloured disconnect phrase gets split. Only
	// the aborted-green shape survives that, which is why the retry decision
	// goes through looksLikeBrowserDisconnect rather than a raw substring test.
	const interleaved = [
		'[31mError[39m: [vitest] Browser connection [2mwas',
		' ❯ WebSocket.emit node:events:531:35',
		'closed while running tests[22m. Was the page closed unexpectedly?',
		' ❯ WebSocket.emitClose node_modules/ws/lib/websocket.js:279:10',
		' Test Files  88 passed (176)',
		' ❯ Socket.socketOnClose node_modules/ws/lib/websocket.js:1360:15',
		'      Tests  543 passed (543)',
		'     Errors  1 error'
	].join('\n');

	assert.equal(interleaved.includes(disconnect), false);
	assert.equal(shouldRetryStorybookRun(1, interleaved), true);
});

test('caps Storybook workers and allows several disconnect retries', () => {
	assert.equal(MAX_BROWSER_DISCONNECT_RETRIES, 4);
	assert.deepEqual(
		storybookVitestArgs.filter((arg) => arg.startsWith('--maxWorkers')),
		['--maxWorkers=2']
	);
});
