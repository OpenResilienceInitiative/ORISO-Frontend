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

export const shouldRetryStorybookRun = (code, capturedOutput) =>
	code !== 0 &&
	capturedOutput.includes(BROWSER_DISCONNECT_SIGNATURE) &&
	!TEST_FAILURE_SIGNATURES.some((signature) =>
		signature.test(capturedOutput)
	);

const runStorybookTests = () =>
	new Promise((resolve) => {
		let capturedOutput = '';
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
				capturedOutput = `${capturedOutput}${chunk}`.slice(
					-MAX_CAPTURED_OUTPUT
				);
			});
		};

		forwardOutput(child.stdout, process.stdout);
		forwardOutput(child.stderr, process.stderr);
		child.on('error', (error) => {
			console.error(error);
			resolve({ code: 1, capturedOutput });
		});
		child.on('close', (code) => resolve({ code, capturedOutput }));
	});

const main = async () => {
	const firstRun = await runStorybookTests();

	if (firstRun.code === 0) {
		return 0;
	}

	if (!shouldRetryStorybookRun(firstRun.code, firstRun.capturedOutput)) {
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
