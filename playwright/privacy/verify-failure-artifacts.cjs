#!/usr/bin/env node
// Isolated synthetic canary only; never import a credential fixture or contact an app.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { createRequire } = require('node:module');
const assert = require('node:assert/strict');
const { PNG } = require('pngjs');

const outputRoot = process.env.ORISO_RECOVERY_OUTPUT_DIR;
assert(
	outputRoot,
	'Set ORISO_RECOVERY_OUTPUT_DIR to a new synthetic evidence directory'
);
assert(
	!fs.existsSync(outputRoot),
	'Output directory must not exist; never overwrite real evidence'
);
fs.mkdirSync(outputRoot, { recursive: true });
const testPackage = require.resolve('@playwright/test/package.json');
const testRequire = createRequire(testPackage);
const runtimes = [
	testRequire.resolve('playwright/package.json'),
	require.resolve('playwright/package.json')
];
assert.deepEqual(
	runtimes.map((p) => require(p).version),
	['1.58.2', '1.62.1'],
	'Installed versions changed: review the guard and explicitly update the expected matrix'
);

function filesUnder(directory) {
	return fs
		.readdirSync(directory, { withFileTypes: true })
		.flatMap((entry) => {
			const file = path.join(directory, entry.name);
			return entry.isDirectory() ? filesUnder(file) : [file];
		});
}
function inspectArtifacts(directory, canary) {
	const files = filesUnder(directory);
	const textFiles = files.filter((file) => !file.endsWith('.png'));
	const forbidden = files.some((file) =>
		/snapshot|trace|\.webm$|\.zip$/.test(path.basename(file))
	);
	const leaked = textFiles.some((file) =>
		fs.readFileSync(file, 'utf8').includes(canary)
	);
	const snapshotText = textFiles.some((file) =>
		/# Page snapshot|```yaml\s*\n-/.test(fs.readFileSync(file, 'utf8'))
	);
	return { files, forbidden, leaked, snapshotText };
}
function validatePixels(directory) {
	const files = filesUnder(directory);
	const pngs = files.filter((file) => file.endsWith('.png'));
	const diagnostics = files.filter((file) =>
		file.endsWith('sanitized-failure.json')
	);
	assert.equal(
		pngs.length,
		1,
		'Exactly one explicitly masked screenshot required'
	);
	assert.equal(diagnostics.length, 1);
	const metadata = JSON.parse(fs.readFileSync(diagnostics[0], 'utf8'));
	assert.deepEqual(Object.keys(metadata).sort(), [
		'kind',
		'mask',
		'viewport'
	]);
	const png = PNG.sync.read(fs.readFileSync(pngs[0]));
	assert.equal(png.width, 640);
	assert.equal(png.height, 480);
	assert.deepEqual(metadata.mask, { x: 40, y: 70, width: 560, height: 80 });
	for (let y = 0; y < png.height; y++) {
		for (let x = 0; x < png.width; x++) {
			const offset = (y * png.width + x) * 4;
			const expected =
				x >= 40 && x < 600 && y >= 70 && y < 150
					? [255, 0, 255, 255]
					: x < 20 && y < 20
						? [0, 0, 255, 255]
						: [255, 255, 255, 255];
			assert.deepEqual(
				[...png.data.subarray(offset, offset + 4)],
				expected,
				'Known fixture image must contain only the opaque mask, visible blue control and white background; secret overflow is forbidden'
			);
		}
	}
	return {
		maskPixelsVerified: 44800,
		fullFixturePixelsVerified: 307200,
		visibleControlVerified: true
	};
}

const results = [];
for (const packageFile of runtimes) {
	const runtime = path.dirname(packageFile);
	const version = require(packageFile).version;
	const scratch = fs.mkdtempSync(
		path.join(os.tmpdir(), 'oriso-privacy-canary-')
	);
	try {
		fs.copyFileSync(
			path.join(__dirname, 'failure-artifact.fixture.cjs'),
			path.join(scratch, 'failure-artifact.fixture.cjs')
		);
		const canary = `SYNTHETIC_PRIVACY_${crypto.randomBytes(24).toString('hex')}`;
		const run = (guard, directory) => {
			const config = path.join(scratch, `config-${guard}.cjs`);
			fs.writeFileSync(
				config,
				`process.env.PLAYWRIGHT_NO_COPY_PROMPT=${JSON.stringify(guard ? '1' : '')};module.exports=${JSON.stringify(
					{
						testDir: scratch,
						testMatch: 'failure-artifact.fixture.cjs',
						outputDir: directory,
						workers: 1,
						retries: 0,
						timeout: 15000,
						reporter: [['list']],
						use: {
							browserName: 'chromium',
							viewport: { width: 640, height: 480 },
							trace: 'off',
							video: 'off',
							screenshot: 'off'
						}
					}
				)};`
			);
			const env = {
				...process.env,
				ORISO_PRIVACY_TEST_MODULE: path.join(runtime, 'test.js'),
				ORISO_PRIVACY_CANARY: canary,
				DEBUG: '',
				PWDEBUG: '0',
				FORCE_COLOR: '0',
				PLAYWRIGHT_NO_COPY_PROMPT: guard ? '1' : ''
			};
			const result = spawnSync(
				process.execPath,
				[path.join(runtime, 'cli.js'), 'test', '--config', config],
				{ env, encoding: 'utf8', timeout: 45000 }
			);
			assert.equal(
				result.status,
				1,
				'Fixture must reach exactly one deliberate failed test'
			);
			const log = `${result.stdout || ''}\n${result.stderr || ''}`;
			assert.match(log, /Intentional synthetic failure/);
			assert.match(log, /1 failed/);
			fs.writeFileSync(path.join(directory, 'runner.log'), log);
			return inspectArtifacts(directory, canary);
		};
		const control = run(false, path.join(scratch, 'guard-disabled'));
		assert(
			control.snapshotText && control.leaked,
			'Positive control must detect the automatic DOM snapshot and canary'
		);
		const directory = path.join(outputRoot, version);
		const observed = run(true, directory);
		assert(
			!observed.forbidden && !observed.leaked && !observed.snapshotText,
			'Failure artifact privacy regression: snapshot or canary found'
		);
		assert(
			observed.files.every((file) => /\.(png|json|log|md)$/.test(file)),
			'Unexpected artifact type requires review'
		);
		const pixels = validatePixels(directory);
		results.push({
			version,
			expectedFailedTests: 1,
			guardDisabledSnapshotDetected: true,
			textArtifactsContainCanary: false,
			automaticSnapshots: 0,
			...pixels
		});
	} finally {
		fs.rmSync(scratch, { recursive: true, force: true });
	}
}
fs.writeFileSync(
	path.join(outputRoot, 'privacy-results.json'),
	JSON.stringify({ passed: true, results }, null, 2)
);
console.log(JSON.stringify({ passed: true, results }, null, 2));
