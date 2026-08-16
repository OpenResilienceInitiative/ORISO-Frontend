import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const BROWSER_DISCONNECT_SIGNATURE =
	'[vitest] Browser connection was closed while running tests';
const MAX_CAPTURED_OUTPUT = 500_000;
const TEST_FAILURE_SIGNATURES = [
	/(?:^|\n)\s*FAIL\s+/m,
	/\bTest Files\s+\d+\s+failed\b/i,
	/\bTests\s+\d+\s+failed\b/i,
	/\bAssertionError\b/
];

const hasTestFailure = (output) =>
	TEST_FAILURE_SIGNATURES.some((signature) => signature.test(output));

export const shouldRetryStorybookRun = (
	code,
	capturedOutput,
	{ failureDetected = false, outputTruncated = false } = {}
) =>
	code !== 0 &&
	!failureDetected &&
	!outputTruncated &&
	capturedOutput.includes(BROWSER_DISCONNECT_SIGNATURE) &&
	!hasTestFailure(capturedOutput);

const runStorybookTests = () =>
	new Promise((resolve) => {
		let capturedOutput = '';
		let failureDetected = false;
		let outputTruncated = false;
		const child = spawn(
			process.execPath,
			[
				'node_modules/vitest/vitest.mjs',
				'run',
				'--project',
				'storybook',
				'--maxWorkers=1',
				'--minWorkers=1'
			],
			{
				env: {
					...process.env,
					NODE_OPTIONS: '--max-old-space-size=6144'
				},
				stdio: ['inherit', 'pipe', 'pipe']
			}
		);

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
	const firstRun = await runStorybookTests();

	if (firstRun.code === 0) {
		return 0;
	}

	if (
		!shouldRetryStorybookRun(
			firstRun.code,
			firstRun.capturedOutput,
			firstRun
		)
	) {
		return firstRun.code ?? 1;
	}

	console.warn(
		'Vitest lost its Storybook browser connection; retrying the suite once.'
	);
	const retry = await runStorybookTests();
	return retry.code ?? 1;
};

if (
	process.argv[1] &&
	import.meta.url === pathToFileURL(process.argv[1]).href
) {
	process.exit(await main());
}
