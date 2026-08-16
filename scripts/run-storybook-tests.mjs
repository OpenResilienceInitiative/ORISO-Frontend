import { spawn } from 'node:child_process';

const BROWSER_DISCONNECT_SIGNATURE =
	'[vitest] Browser connection was closed while running tests';
const MAX_CAPTURED_OUTPUT = 500_000;

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

const firstRun = await runStorybookTests();

if (firstRun.code === 0) {
	process.exit(0);
}

if (!firstRun.capturedOutput.includes(BROWSER_DISCONNECT_SIGNATURE)) {
	process.exit(firstRun.code ?? 1);
}

console.warn(
	'Vitest lost its Storybook browser connection; retrying the suite once.'
);
const retry = await runStorybookTests();
process.exit(retry.code ?? 1);
