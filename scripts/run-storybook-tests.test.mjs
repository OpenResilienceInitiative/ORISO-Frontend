import assert from 'node:assert/strict';
import test from 'node:test';

import {
	MAX_BROWSER_DISCONNECT_RETRIES,
	looksLikeBrowserDisconnect,
	looksLikeImportCrash,
	shouldRetryStorybookRun,
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

test('caps Storybook workers and allows several disconnect retries', () => {
	assert.equal(MAX_BROWSER_DISCONNECT_RETRIES, 4);
	assert.deepEqual(
		storybookVitestArgs.filter((arg) => arg.startsWith('--maxWorkers')),
		['--maxWorkers=2']
	);
});
