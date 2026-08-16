import assert from 'node:assert/strict';
import test from 'node:test';

import { shouldRetryStorybookRun } from './run-storybook-tests.mjs';

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
	assert.equal(shouldRetryStorybookRun(1, 'Test Files 2 failed'), false);
	assert.equal(shouldRetryStorybookRun(0, disconnect), false);
});
