import { assertControlPhase } from './verification-control-results.mjs';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import {
	mkdirSync,
	readFileSync,
	readdirSync,
	unlinkSync,
	writeFileSync,
	openSync,
	closeSync
} from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const artifacts = path.resolve(
	process.env.VERIFICATION_ARTIFACTS_DIR ||
		`verification-artifacts/controls-${Date.now()}`
);
mkdirSync(artifacts, { recursive: true });
assert.equal(
	readdirSync(artifacts).length,
	0,
	'Controls require a fresh artifact directory'
);
const fixture = path.join(
	root,
	'.superpowers/verification-controls/controls.stories.tsx'
);
mkdirSync(path.dirname(fixture), { recursive: true });
writeFileSync(
	fixture,
	readFileSync(
		new URL('./verification/controls.stories.txt', import.meta.url)
	),
	{ flag: 'wx' }
);
const state = { state: 'running', runs: [] };
const save = () =>
	writeFileSync(
		path.join(artifacts, 'proof-state.json'),
		JSON.stringify(state, null, 2)
	);
const run = async (phase, baselines = [], shuffle = false) => {
	const directory = path.join(
		artifacts,
		phase + (shuffle ? '-shuffled' : '')
	);
	mkdirSync(directory);
	const json = path.join(directory, 'controls.json');
	const command = [
		'node_modules/vitest/vitest.mjs',
		'run',
		'--project',
		'storybook',
		fixture,
		'--maxWorkers=2',
		'--reporter=dot',
		'--reporter=./scripts/verification-reporter.mjs',
		'--reporter=json',
		`--outputFile=${json}`,
		...(shuffle ? ['--sequence.shuffle.tests', '--sequence.seed=1611'] : [])
	];
	const fd = openSync(path.join(directory, 'controls.log'), 'w');
	const child = spawn(process.execPath, command, {
		cwd: root,
		env: {
			...process.env,
			VERIFICATION_ARTIFACTS_DIR: directory,
			ORISO_VERIFICATION_CONTROLS: 'true',
			ORISO_A11Y_CONTROL_PHASE: phase,
			ORISO_A11Y_BASELINE_JSON: JSON.stringify(baselines)
		},
		stdio: ['ignore', fd, fd]
	});
	const record = {
		phase,
		shuffle,
		cwd: root,
		command: [process.execPath, ...command],
		pid: child.pid,
		state: 'running',
		startedAtUTC: new Date().toISOString()
	};
	state.runs.push(record);
	save();
	console.log(JSON.stringify(record));
	const status = await new Promise((resolve, reject) => {
		child.on('error', reject);
		child.on('close', resolve);
	});
	closeSync(fd);
	Object.assign(record, {
		state: 'terminal',
		exitCode: status,
		endedAtUTC: new Date().toISOString()
	});
	save();
	return assertControlPhase(directory, phase, status);
};
try {
	const captured = await run('capture');
	const baselines = captured
		.filter((test) => /--known-/.test(test.a11y?.storyId))
		.map(({ a11y }) => ({
			storyId: a11y.storyId,
			environment: a11y.environment,
			fingerprints: a11y.fingerprints,
			owner: 'verification-selftest',
			issue: 'https://github.com/OpenResilienceInitiative/ORISO-Frontend/issues/1338',
			expires: '2099-01-01'
		}));
	assert.equal(baselines.length, 4);
	assert.ok(baselines.every((entry) => entry.fingerprints?.length));
	writeFileSync(
		path.join(artifacts, 'selftest-only-baselines.json'),
		JSON.stringify(baselines, null, 2)
	);
	const verified = await run('verify', baselines);
	const css = (cases) =>
		cases.find((test) => test.a11y?.storyId.endsWith('--known-worse-style'))
			.a11y;
	assert.equal(
		css(captured).reports[0].result.violations[0].nodes[0].html,
		css(verified).reports[0].result.violations[0].nodes[0].html
	);
	assert.notDeepEqual(css(captured).fingerprints, css(verified).fingerprints);
	await run('verify', baselines, true);
	state.state = 'passed';
	save();
	console.log(
		`27 controls ×3 phases verified; source approvals remain empty.`
	);
} catch (error) {
	state.state = 'failed';
	state.error = String(error);
	save();
	throw error;
} finally {
	unlinkSync(fixture);
}
