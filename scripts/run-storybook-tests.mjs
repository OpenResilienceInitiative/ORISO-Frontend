import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const BROWSER_DISCONNECT_SIGNATURE =
	'[vitest] Browser connection was closed while running tests';
const MAX_CAPTURED_OUTPUT = 500_000;
/** Full-suite re-runs after a disconnect-only abort (initial attempt + retries). */
export const MAX_BROWSER_DISCONNECT_RETRIES = 4;
const RETRY_COOLDOWN_MS = 2_000;
const TEST_FAILURE_SIGNATURES = [
	/(?:^|\n)\s*FAIL\s+/m,
	/\bTest Files\s+\d+\s+failed\b/i,
	/\bTests\s+\d+\s+failed\b/i,
	/\bAssertionError\b/
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

const hasTestFailure = (output) =>
	TEST_FAILURE_SIGNATURES.some((signature) => signature.test(output));

export const shouldRetryStorybookRun = (
	code,
	capturedOutput,
	{ failureDetected = false } = {}
) =>
	code !== 0 &&
	!failureDetected &&
	capturedOutput.includes(BROWSER_DISCONNECT_SIGNATURE) &&
	!hasTestFailure(capturedOutput);

const sleep = (ms) =>
	new Promise((resolve) => {
		setTimeout(resolve, ms);
	});

const runStorybookTests = () =>
	new Promise((resolve) => {
		let capturedOutput = '';
		let failureDetected = false;
		let outputTruncated = false;
		const child = spawn(process.execPath, storybookVitestArgs, {
			env: {
				...process.env,
				NODE_OPTIONS: '--max-old-space-size=6144'
			},
			stdio: ['inherit', 'pipe', 'pipe']
		});

		const forwardOutput = (stream, destination) => {
			stream.on('data', (chunk) => {
				destination.write(chunk);
				const combinedOutput = `${capturedOutput}${chunk}`;
				failureDetected ||= hasTestFailure(combinedOutput);
				outputTruncated ||= combinedOutput.length > MAX_CAPTURED_OUTPUT;
				capturedOutput = combinedOutput.slice(-MAX_CAPTURED_OUTPUT);
			});
		};

		forwardOutput(child.stdout, process.stdout);
		forwardOutput(child.stderr, process.stderr);
		child.on('error', (error) => {
			console.error(error);
			resolve({
				code: 1,
				capturedOutput,
				failureDetected,
				outputTruncated
			});
		});
		child.on('close', (code) =>
			resolve({ code, capturedOutput, failureDetected, outputTruncated })
		);
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
			`Vitest lost its Storybook browser connection; retrying the suite (${attempt}/${MAX_BROWSER_DISCONNECT_RETRIES}).`
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
