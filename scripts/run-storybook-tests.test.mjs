import assert from 'node:assert/strict';
import test from 'node:test';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

test('uses the supported worker cap without the removed minWorkers option', () => {
	assert.deepEqual(
		storybookVitestArgs.filter((arg) => arg.startsWith('--maxWorkers')),
		['--maxWorkers=2']
	);
	assert.equal(
		storybookVitestArgs.some((arg) => arg.startsWith('--minWorkers')),
		false
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

// Execute the real wrapper against a tiny isolated child executable. This
// verifies orchestration only; it does not replace the actual Storybook catalog.
const runControlledShards = async (t, plans, cancelParent = false) => {
	const directory = await mkdtemp(path.join(tmpdir(), 'oriso-shards-'));
	const eventsPath = path.join(directory, 'events.jsonl');
	const childPath = path.join(directory, 'node_modules/vitest/vitest.mjs');
	await mkdir(path.dirname(childPath), { recursive: true });
	await writeFile(
		childPath,
		`
import { appendFileSync } from 'node:fs';
const plans = JSON.parse(process.env.ORISO_SHARD_PLANS);
const argv = process.argv.slice(2);
const shard = Number(argv.find(a => a.startsWith('--shard='))?.split('=')[1].split('/')[0] || 1);
const log = event => appendFileSync(process.env.ORISO_SHARD_EVENTS, JSON.stringify({ event, shard, pid: process.pid, argv, nodeOptions: process.env.NODE_OPTIONS, sentinel: process.env.ORISO_SHARD_SENTINEL }) + '\\n');
const plan = plans[shard - 1];
log('start');
if (plan.waitForParent) {
  process.once('SIGTERM', () => { log('signal:SIGTERM'); log('end'); process.exit(143); });
  setTimeout(() => { log('end'); process.exit(0); }, 1000);
} else {
  setTimeout(() => process.stdout.write(plan.output || '', () => {
    log('end');
    if (plan.signal) process.kill(process.pid, plan.signal);
    else process.exit(plan.code || 0);
  }), plan.delayMs || 0);
}
`
	);
	const events = async () => {
		try {
			return (await readFile(eventsPath, 'utf8'))
				.trim()
				.split('\n')
				.filter(Boolean)
				.map((line) => JSON.parse(line));
		} catch (error) {
			if (error.code === 'ENOENT') return [];
			throw error;
		}
	};
	t.after(async () => {
		await rm(directory, { recursive: true, force: true });
	});
	const child = spawn(
		process.execPath,
		[fileURLToPath(new URL('./run-storybook-tests.mjs', import.meta.url))],
		{
			cwd: directory,
			env: {
				...process.env,
				STORYBOOK_TEST_SHARDS: '4',
				ORISO_SHARD_PLANS: JSON.stringify(plans),
				ORISO_SHARD_EVENTS: eventsPath,
				ORISO_SHARD_SENTINEL: 'retained-value'
			},
			stdio: ['ignore', 'pipe', 'pipe']
		}
	);
	let output = '';
	child.stdout.on('data', (chunk) => {
		output += chunk;
	});
	child.stderr.on('data', (chunk) => {
		output += chunk;
	});
	const terminal = new Promise((resolve, reject) => {
		child.once('error', reject);
		child.once('close', (code, signal) => resolve({ code, signal }));
	});
	if (cancelParent) {
		const deadline = Date.now() + 3000;
		while (!(await events()).some((event) => event.event === 'start')) {
			assert.ok(Date.now() < deadline, 'controlled child did not start');
			await new Promise((resolve) => setTimeout(resolve, 10));
		}
		child.kill('SIGTERM');
	}
	const result = await terminal;
	// The controlled cancelled child has a one-second natural bound even on
	// the unfixed wrapper, so a red assertion cannot leave an orphan process.
	if (cancelParent) {
		const deadline = Date.now() + 3000;
		while (!(await events()).some((event) => event.event === 'end')) {
			assert.ok(
				Date.now() < deadline,
				'controlled child did not terminate'
			);
			await new Promise((resolve) => setTimeout(resolve, 10));
		}
	}
	const observed = { ...result, output, events: await events() };
	// Retain actual short-lived child PIDs/events even when a red assertion follows.
	console.log(
		'[shard-orchestration-control]',
		JSON.stringify({ name: t.name, wrapperPid: child.pid, ...observed })
	);
	return observed;
};

test(
	'collects all four sequential shards and returns the first ordinary failure code',
	{ timeout: 20_000 },
	async (t) => {
		const result = await runControlledShards(t, [
			{
				code: 7,
				delayMs: 100,
				output: 'FAIL first.story.ts\nTests 1 failed\n'
			},
			{ code: 0, delayMs: 100, output: 'second shard output\n' },
			{ code: 9, output: 'FAIL third.story.ts\nTests 2 failed\n' },
			{ code: 0, output: 'fourth shard output\n' }
		]);
		assert.equal(result.code, 7);
		assert.deepEqual(
			result.events.map((event) => [event.event, event.shard]),
			[
				['start', 1],
				['end', 1],
				['start', 2],
				['end', 2],
				['start', 3],
				['end', 3],
				['start', 4],
				['end', 4]
			]
		);
		for (const event of result.events) {
			assert.ok(event.argv.includes('--maxWorkers=2'));
			assert.equal(event.nodeOptions, '--max-old-space-size=6144');
			assert.equal(event.sentinel, 'retained-value');
		}
		assert.match(result.output, /second shard output/);
		assert.match(result.output, /fourth shard output/);
	}
);

test(
	'does not retry a failed assertion mixed with disconnect output and still collects later shards',
	{ timeout: 20_000 },
	async (t) => {
		const result = await runControlledShards(t, [
			{ code: 1, output: `FAIL first.story.ts\n${disconnect}\n` },
			{ code: 0 },
			{ code: 0 },
			{ code: 0 }
		]);
		assert.equal(result.code, 1);
		assert.deepEqual(
			result.events
				.filter((event) => event.event === 'start')
				.map((event) => event.shard),
			[1, 2, 3, 4]
		);
		assert.doesNotMatch(result.output, /retrying/);
	}
);

test(
	'a signalled child aborts without disconnect retries or later shards',
	{ timeout: 20_000 },
	async (t) => {
		const result = await runControlledShards(t, [
			{ signal: 'SIGTERM', output: `${disconnect}\n` },
			{ code: 0 },
			{ code: 0 },
			{ code: 0 }
		]);
		assert.equal(result.code, 143);
		assert.deepEqual(
			result.events
				.filter((event) => event.event === 'start')
				.map((event) => event.shard),
			[1]
		);
		assert.doesNotMatch(result.output, /retrying/);
	}
);

test(
	'a fatal startup failure preserves its code and does not launch later shards',
	{ timeout: 20_000 },
	async (t) => {
		const result = await runControlledShards(t, [
			{ code: 2, output: 'Startup Error: configuration failed\n' },
			{ code: 0 },
			{ code: 0 },
			{ code: 0 }
		]);
		assert.equal(result.code, 2);
		assert.deepEqual(
			result.events
				.filter((event) => event.event === 'start')
				.map((event) => event.shard),
			[1]
		);
	}
);

test(
	'parent SIGTERM reaches its active child and prevents later shards',
	{ timeout: 20_000 },
	async (t) => {
		const result = await runControlledShards(
			t,
			[{ waitForParent: true }, { code: 0 }, { code: 0 }, { code: 0 }],
			true
		);
		assert.equal(result.code, 143);
		assert.deepEqual(
			result.events
				.filter((event) => event.event === 'start')
				.map((event) => event.shard),
			[1]
		);
		assert.equal(
			result.events.filter((event) => event.event === 'signal:SIGTERM')
				.length,
			1
		);
	}
);
