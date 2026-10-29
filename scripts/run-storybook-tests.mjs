import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const BROWSER_DISCONNECT_SIGNATURE =
	'[vitest] Browser connection was closed while running tests';
const MAX_CAPTURED_OUTPUT = 500_000;
/** Full-suite re-runs after a disconnect-only abort (initial attempt + retries). */
export const MAX_BROWSER_DISCONNECT_RETRIES = 4;
const RETRY_COOLDOWN_MS = 2_000;
const ASSERTION_FAILURE_SIGNATURES = [
	/\bTests\s+[1-9]\d*\s+failed\b/i,
	/\bAssertionError\b/
];
const IMPORT_CRASH_SIGNATURES = [
	/Failed to import test file/i,
	/Failed to fetch dynamically imported module/i,
	/Vitest failed to find the runner/i
];

export const storybookVitestArgs = [
	'node_modules/vitest/vitest.mjs',
	'run',
	'--project',
	'storybook',
	// Cap workers: unlimited parallelism on CI runners opens many orchestrator
	// tabs and makes the disconnect flake more likely. Two workers matched the
	// last stable local run (#1127) without funneling all ~170 files through one
	// tab (which --maxWorkers=1 provokes).
	'--maxWorkers=2',
	'--minWorkers=1'
];

/**
 * Sequential shards. ORISO-Frontend#1316 (CI run 34016457101): all five
 * full-suite attempts lost the browser connection at ~95-107 of 175 files —
 * the detached story iframes of one orchestrator tab pile up until the tab
 * dies, so re-running the *whole* suite can never get past that point.
 * `vitest --shard=i/n` gives each vitest invocation (and its browser) a
 * fraction of the files, well below the threshold, and a disconnect only
 * costs the affected shard a retry.
 */
export const DEFAULT_STORYBOOK_SHARDS = 4;

export const resolveShardCount = (env = process.env) => {
	// Number(), not parseInt(): '6workers' and '1.5' must fall back, not
	// silently become 6 and 1.
	const raw = (env.STORYBOOK_TEST_SHARDS ?? '').trim();
	const parsed = raw === '' ? Number.NaN : Number(raw);
	return Number.isInteger(parsed) && parsed > 0
		? parsed
		: DEFAULT_STORYBOOK_SHARDS;
};

export const storybookShardArgs = (index, count) =>
	count > 1
		? [...storybookVitestArgs, `--shard=${index}/${count}`]
		: [...storybookVitestArgs];

const stripAnsi = (output) => output.replace(/\u001b\[[0-9;]*m/g, '');

const hasAssertionFailure = (output) =>
	ASSERTION_FAILURE_SIGNATURES.some((signature) =>
		signature.test(stripAnsi(output))
	);

/** Classify each failed suite before its output can leave the rolling buffer. */
export const createSuiteFailureTracker = () => {
	const pendingLines = new Map();
	let activeSuite = null;
	let genuineFailure = false;
	let importFailures = 0;
	let reportedFailedSuites = 0;

	const finishSuite = () => {
		if (activeSuite !== null) {
			if (activeSuite.importCrash) {
				importFailures += 1;
			} else {
				genuineFailure = true;
			}
			activeSuite = null;
		}
	};
	const inspectLine = (line) => {
		const plain = stripAnsi(line);
		if (/^\s*FAIL\s+/.test(plain)) {
			finishSuite();
			activeSuite = { importCrash: false };
		}
		if (activeSuite !== null && looksLikeImportCrash(plain)) {
			activeSuite.importCrash = true;
		}
		const summary = plain.match(/\bTest Files\s+(\d+)\s+failed\b/i);
		if (summary) {
			reportedFailedSuites = Math.max(
				reportedFailedSuites,
				Number(summary[1])
			);
		}
	};
	return {
		append(chunk, stream = 'stdout') {
			// Separate incomplete stdout/stderr lines so interleaving cannot
			// splice a suite header or import signature into an unrelated line.
			const lines = `${pendingLines.get(stream) ?? ''}${chunk}`.split(
				'\n'
			);
			pendingLines.set(stream, lines.pop());
			for (const line of lines) {
				inspectLine(line);
			}
		},
		finish() {
			for (const line of pendingLines.values()) {
				inspectLine(line);
			}
			pendingLines.clear();
			finishSuite();
			// An import crash cannot explain any additional failed suite whose
			// block was absent from the captured tail or otherwise unclassified.
			return genuineFailure || reportedFailedSuites > importFailures;
		}
	};
};

const hasUnexplainedSuiteFail = (output) => {
	const tracker = createSuiteFailureTracker();
	tracker.append(output);
	return tracker.finish();
};

/**
 * Chrome dying mid-collect shows up as FAIL on whichever story was importing
 * `.storybook/vitest.setup.ts`, plus "Failed to fetch dynamically imported
 * module". That is infrastructure, not a broken Card/story. The
 * `url.pathToFileURL` lines are the same Vite noise every run prints.
 */
export const looksLikeImportCrash = (output) => {
	const plain = stripAnsi(output);
	return IMPORT_CRASH_SIGNATURES.some((signature) => signature.test(plain));
};

/**
 * Chrome sometimes drops the orchestrator WebSocket after hundreds of green
 * stories. The disconnect line is the last thing Vitest prints, so a `close`
 * listener that does not wait for stdout/stderr `end` can miss it. The
 * summary `132 passed (171)` plus `Errors 1 error` is the earlier, durable
 * signal that the queue was aborted with no failed assertions.
 */
export const looksLikeBrowserDisconnect = (output) => {
	const plain = stripAnsi(output);
	if (plain.includes(BROWSER_DISCONNECT_SIGNATURE)) {
		return true;
	}
	const files = plain.match(/Test Files\s+(\d+)\s+passed\s+\((\d+)\)/i);
	const abortedQueue = !!files && Number(files[1]) < Number(files[2]);
	const testsPassed = /\bTests\s+\d+\s+passed\b/i.test(plain);
	const oneUnhandled = /\bErrors\s+1\s+error\b/i.test(plain);
	return abortedQueue && testsPassed && oneUnhandled;
};

/*
 * `outputTruncated` deliberately does NOT gate the retry.
 *
 * Assertion failures are latched as chunks arrive. Failed suite blocks are
 * classified independently by a streaming tracker, which retains their outcome
 * even after the rolling output drops the original text. Only import-crash
 * blocks may retry; a genuine or unclassified failed suite stops the retry.
 *
 * Gating on it made the retry unreachable in CI: the Storybook run emits
 * thousands of "Module … has been externalized for browser compatibility"
 * lines, so every run crosses MAX_CAPTURED_OUTPUT and latches `outputTruncated`
 * true. A browser-disconnect abort — 863/863 tests passed, 18 of 171 files
 * never reached — therefore failed the job outright instead of being retried
 * (ORISO-Frontend#1233 CI run 33470719328).
 *
 * Detection goes through `looksLikeBrowserDisconnect`, NOT a bare
 * `capturedOutput.includes(...)`. The raw substring test looked equivalent and
 * was not: `capturedOutput` is one buffer fed by two streams, so a stdout chunk
 * can land in the middle of the stderr line and split the phrase, and the raw
 * text still carries the ANSI codes Vitest colours it with. CI run 33968368364
 * (#1307) aborted at `Test Files 88 passed (176)` / `Tests 543 passed` /
 * `Errors 1 error` with the stack frames visibly interleaved into the summary,
 * the substring test missed it, and the job failed instead of retrying — the
 * exact case the aborted-green fallback above exists to catch.
 */
export const shouldRetryStorybookRun = (
	code,
	capturedOutput,
	{ failureDetected = false } = {}
) =>
	code !== 0 &&
	!failureDetected &&
	!hasAssertionFailure(capturedOutput) &&
	!hasUnexplainedSuiteFail(capturedOutput) &&
	(looksLikeBrowserDisconnect(capturedOutput) ||
		looksLikeImportCrash(capturedOutput));

const sleep = (ms) =>
	new Promise((resolve) => {
		setTimeout(resolve, ms);
	});

export const runStorybookTests = (
	args = storybookVitestArgs,
	{ stdout = process.stdout, stderr = process.stderr } = {}
) =>
	new Promise((resolve) => {
		let capturedOutput = '';
		let failureDetected = false;
		let outputTruncated = false;
		const suiteFailures = createSuiteFailureTracker();
		let exitCode = 1;
		let stdoutDone = false;
		let stderrDone = false;
		let closed = false;
		let settled = false;
		const child = spawn(process.execPath, args, {
			env: {
				...process.env,
				NODE_OPTIONS: '--max-old-space-size=6144'
			},
			stdio: ['inherit', 'pipe', 'pipe']
		});

		const settle = () => {
			if (settled || !closed || !stdoutDone || !stderrDone) {
				return;
			}
			settled = true;
			failureDetected ||= suiteFailures.finish();
			resolve({
				code: exitCode,
				capturedOutput,
				failureDetected,
				outputTruncated
			});
		};

		const forwardOutput = (stream, destination, streamName, onEnd) => {
			stream.on('data', (chunk) => {
				destination.write(chunk);
				suiteFailures.append(chunk, streamName);
				const combinedOutput = `${capturedOutput}${chunk}`;
				failureDetected ||= hasAssertionFailure(combinedOutput);
				outputTruncated ||= combinedOutput.length > MAX_CAPTURED_OUTPUT;
				capturedOutput = combinedOutput.slice(-MAX_CAPTURED_OUTPUT);
			});
			stream.on('end', onEnd);
		};

		forwardOutput(child.stdout, stdout, 'stdout', () => {
			stdoutDone = true;
			settle();
		});
		forwardOutput(child.stderr, stderr, 'stderr', () => {
			stderrDone = true;
			settle();
		});
		child.on('error', (error) => {
			console.error(error);
			exitCode = 1;
			closed = true;
			stdoutDone = true;
			stderrDone = true;
			settle();
		});
		child.on('close', (code) => {
			exitCode = code ?? 1;
			closed = true;
			settle();
		});
	});

const runShardWithRetries = async (index, count) => {
	const args = storybookShardArgs(index, count);
	const label = count > 1 ? ` (shard ${index}/${count})` : '';
	let attempt = 0;
	let lastRun = await runStorybookTests(args);

	while (lastRun.code !== 0 && attempt < MAX_BROWSER_DISCONNECT_RETRIES) {
		if (
			!shouldRetryStorybookRun(
				lastRun.code,
				lastRun.capturedOutput,
				lastRun
			)
		) {
			return lastRun.code ?? 1;
		}

		attempt += 1;
		console.warn(
			`Vitest lost its Storybook browser connection; retrying${label} (${attempt}/${MAX_BROWSER_DISCONNECT_RETRIES}).` +
				(lastRun.outputTruncated
					? ' Captured output was truncated; failures were scanned live as the run streamed.'
					: '')
		);
		await sleep(RETRY_COOLDOWN_MS);
		lastRun = await runStorybookTests(args);
	}

	return lastRun.code ?? 0;
};

const main = async () => {
	const shardCount = resolveShardCount();
	for (let index = 1; index <= shardCount; index += 1) {
		if (shardCount > 1) {
			console.log(
				`Storybook component tests: shard ${index}/${shardCount}`
			);
		}
		const code = await runShardWithRetries(index, shardCount);
		if (code !== 0) {
			return code;
		}
	}
	return 0;
};

if (
	process.argv[1] &&
	import.meta.url === pathToFileURL(process.argv[1]).href
) {
	process.exit(await main());
}
