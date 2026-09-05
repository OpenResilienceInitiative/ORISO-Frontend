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
const SUITE_FAIL_SIGNATURES = [
	/(?:^|\n)\s*FAIL\s+/m,
	/\bTest Files\s+\d+\s+failed\b/i
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

const stripAnsi = (output) => output.replace(/\u001b\[[0-9;]*m/g, '');

const hasAssertionFailure = (output) =>
	ASSERTION_FAILURE_SIGNATURES.some((signature) =>
		signature.test(stripAnsi(output))
	);

const hasUnexplainedSuiteFail = (output) => {
	if (looksLikeImportCrash(output)) {
		return false;
	}
	const plain = stripAnsi(output);
	return SUITE_FAIL_SIGNATURES.some((signature) => signature.test(plain));
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
	const abortedQueue =
		!!files && Number(files[1]) < Number(files[2]);
	const testsPassed = /\bTests\s+\d+\s+passed\b/i.test(plain);
	const oneUnhandled = /\bErrors\s+1\s+error\b/i.test(plain);
	return abortedQueue && testsPassed && oneUnhandled;
};

/*
 * `outputTruncated` deliberately does NOT gate the retry.
 *
 * It used to, on the reasoning that a truncated log "can have removed an
 * earlier failure". It cannot: `failureDetected` is latched in `forwardOutput`
 * against the rolling window (retained tail + the arriving chunk) on every
 * `data` event, so every `Tests n failed` / AssertionError line is
 * scanned at the moment it streams — truncation only ever discards text that
 * has already been examined. A `FAIL` from "Failed to import test file" is
 * Chrome dying mid-collect, not an assertion, and must not latch. A chunk is far smaller than MAX_CAPTURED_OUTPUT,
 * so the retained tail also heals signatures that straddle a chunk boundary.
 *
 * Gating on it made the retry unreachable in CI: the Storybook run emits
 * thousands of "Module … has been externalized for browser compatibility"
 * lines, so every run crosses MAX_CAPTURED_OUTPUT and latches `outputTruncated`
 * true. A browser-disconnect abort — 863/863 tests passed, 18 of 171 files
 * never reached — therefore failed the job outright instead of being retried
 * (ORISO-Frontend#1233 CI run 33470719328).
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

const runStorybookTests = () =>
	new Promise((resolve) => {
		let capturedOutput = '';
		let failureDetected = false;
		let outputTruncated = false;
		let exitCode = 1;
		let stdoutDone = false;
		let stderrDone = false;
		let closed = false;
		let settled = false;
		const child = spawn(process.execPath, storybookVitestArgs, {
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
			resolve({
				code: exitCode,
				capturedOutput,
				failureDetected,
				outputTruncated
			});
		};

		const forwardOutput = (stream, destination, onEnd) => {
			stream.on('data', (chunk) => {
				destination.write(chunk);
				const combinedOutput = `${capturedOutput}${chunk}`;
				failureDetected ||= hasAssertionFailure(combinedOutput);
				outputTruncated ||= combinedOutput.length > MAX_CAPTURED_OUTPUT;
				capturedOutput = combinedOutput.slice(-MAX_CAPTURED_OUTPUT);
			});
			stream.on('end', onEnd);
		};

		forwardOutput(child.stdout, process.stdout, () => {
			stdoutDone = true;
			settle();
		});
		forwardOutput(child.stderr, process.stderr, () => {
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

const main = async () => {
	let attempt = 0;
	let lastRun = await runStorybookTests();

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
			`Vitest lost its Storybook browser connection; retrying the suite (${attempt}/${MAX_BROWSER_DISCONNECT_RETRIES}).` +
				(lastRun.outputTruncated
					? ' Captured output was truncated; failures were scanned live as the run streamed.'
					: '')
		);
		await sleep(RETRY_COOLDOWN_MS);
		lastRun = await runStorybookTests();
	}

	return lastRun.code ?? 0;
};

if (
	process.argv[1] &&
	import.meta.url === pathToFileURL(process.argv[1]).href
) {
	process.exit(await main());
}
