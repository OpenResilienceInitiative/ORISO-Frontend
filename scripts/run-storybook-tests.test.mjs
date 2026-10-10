import assert from 'node:assert/strict';
import test from 'node:test';

import {
	DEFAULT_STORYBOOK_SHARDS,
	createSuiteFailureTracker,
	MAX_BROWSER_DISCONNECT_RETRIES,
	looksLikeBrowserDisconnect,
	looksLikeImportCrash,
	resolveShardCount,
	runStorybookTests,
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

const pr1297ImportCrash = [
	'Module "url" has been externalized for browser compatibility. Cannot access "url.pathToFileURL" in client code.',
	' ✓  storybook (chromium)  src/components/listSearchField/ListSearchField.stories.tsx (2 tests) 78ms',
	' ✓  storybook (chromium)  src/components/modal/Modal.stories.tsx (2 tests) 94ms',
	'',
	' FAIL   storybook (chromium)  src/components/card/Card.stories.tsx [ src/components/card/Card.stories.tsx ]',
	'Error: Failed to import test file /home/runner/work/ORISO-Frontend/ORISO-Frontend/.storybook/vitest.setup.ts',
	'Caused by: TypeError: Failed to fetch dynamically imported module: http://localhost:63315/home/runner/work/ORISO-Frontend/ORISO-Frontend/.storybook/vitest.setup.ts?import',
	'',
	' Test Files  1 failed | 158 passed (174)',
	'      Tests  894 passed (894)',
	'     Errors  1 error',
	disconnect
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

test('retries when Chrome dies mid-import and Vitest marks that file FAIL', () => {
	// PR #1297: Card.stories.tsx was the victim, not the cause. Every play()
	// that ran passed; the FAIL is "Failed to fetch vitest.setup.ts" after
	// the orchestrator tab closed. That must retry, not fail the job.
	assert.equal(looksLikeImportCrash(pr1297ImportCrash), true);
	assert.equal(looksLikeBrowserDisconnect(pr1297ImportCrash), true);
	assert.equal(shouldRetryStorybookRun(1, pr1297ImportCrash), true);
	assert.equal(
		shouldRetryStorybookRun(1, pr1297ImportCrash, {
			failureDetected: false
		}),
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

test('does not retry when a live assertion failure was latched', () => {
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
	// parseInt would accept these prefixes as 6 and 1
	assert.equal(
		resolveShardCount({ STORYBOOK_TEST_SHARDS: '6workers' }),
		DEFAULT_STORYBOOK_SHARDS
	);
	assert.equal(
		resolveShardCount({ STORYBOOK_TEST_SHARDS: '1.5' }),
		DEFAULT_STORYBOOK_SHARDS
	);
	assert.equal(resolveShardCount({}), DEFAULT_STORYBOOK_SHARDS);
});

test('does not retry a genuine suite error mixed with a separate import crash', () => {
	const realFailure =
		' FAIL src/Real.stories.tsx\nTypeError: broken story setup';
	const importFailure =
		' FAIL src/Import.stories.tsx\nFailed to import test file';
	for (const blocks of [
		[realFailure, importFailure],
		[importFailure, realFailure]
	]) {
		assert.equal(
			shouldRetryStorybookRun(
				1,
				[...blocks, ' Test Files 2 failed', disconnect].join('\n')
			),
			false
		);
	}
});

test('does not let a lone import signature explain a missing failed suite', () => {
	assert.equal(
		shouldRetryStorybookRun(
			1,
			[
				' FAIL src/Import.stories.tsx',
				'Failed to import test file',
				' Test Files 2 failed',
				disconnect
			].join('\n')
		),
		false
	);
});

test('retains an early non-assertion suite failure after the captured tail is truncated', () => {
	const tracker = createSuiteFailureTracker();
	const chunks = [
		' FAIL src/Real.stories.tsx\nTypeError: broken story setup\n',
		'x'.repeat(500_001) + '\n',
		' FAIL src/Import.stories.tsx\nFailed to import test file\n',
		disconnect
	];
	for (const chunk of chunks) tracker.append(chunk);
	const tail = chunks.join('').slice(-500_000);
	assert.equal(tail.includes('broken story setup'), false);
	assert.equal(
		shouldRetryStorybookRun(1, tail, {
			failureDetected: tracker.finish(),
			outputTruncated: true
		}),
		false
	);
});

test('preserves import-only retries across chunk boundaries and interleaved streams', () => {
	const tracker = createSuiteFailureTracker();
	tracker.append(' \u001b[31mFA', 'stderr');
	tracker.append('Test Files 1 failed\n', 'stdout');
	tracker.append(
		'IL src/Import.stories.tsx\u001b[39m\nFailed to im',
		'stderr'
	);
	tracker.append('808 tests passed\n', 'stdout');
	tracker.append('port test file', 'stderr');
	assert.equal(tracker.finish(), false);
	assert.equal(
		shouldRetryStorybookRun(1, pr1297ImportCrash, {
			failureDetected: tracker.finish()
		}),
		true
	);
});

test('retries when every independently reported failed suite is an import crash', () => {
	const output = [
		' FAIL first.stories.tsx',
		'Failed to import test file',
		' FAIL second.stories.tsx',
		'Failed to fetch dynamically imported module',
		'Test Files 2 failed',
		disconnect
	].join('\n');
	assert.equal(shouldRetryStorybookRun(1, output), true);
});

test('the live child-output capture cannot erase a genuine failed suite before an import crash', async () => {
	const script = `process.stdout.write([
  ' FAIL src/Real.stories.tsx', 'TypeError: early genuine suite failure',
  'x'.repeat(500_001),
  ' FAIL src/Import.stories.tsx', 'Failed to import test file',
  ${JSON.stringify(disconnect)}
 ].join('\\n')); process.exitCode = 1;`;
	const discardedOutput = { write: () => true };
	const result = await runStorybookTests(['-e', script], {
		stdout: discardedOutput,
		stderr: discardedOutput
	});
	assert.equal(result.code, 1);
	assert.equal(result.outputTruncated, true);
	assert.equal(result.failureDetected, true);
	assert.equal(
		result.capturedOutput.includes('early genuine suite failure'),
		false
	);
	assert.equal(
		shouldRetryStorybookRun(result.code, result.capturedOutput, result),
		false
	);
});
