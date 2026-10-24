// Exercise the actual Storybook/Vitest integration, not a separate axe instance.
// Temporary stories must fail for the expected rules; a clean control must pass.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const fixtureDir = await mkdtemp(
	path.resolve('src/components/a11y-gate-probe-')
);
const reportDir = await mkdtemp(path.join(tmpdir(), 'storybook-a11y-gate-'));
const reportPath = path.join(reportDir, 'results.json');
try {
	await writeFile(
		path.join(fixtureDir, 'Gate.stories.tsx'),
		`
/* eslint-disable jsx-a11y/alt-text -- intentionally invalid accessibility probe */
import React from 'react';
const meta = { title: 'Tests/Accessibility gate probe' };
export default meta;
export const LowContrast = {
 render: () => <p style={{ color: '#e4e2e2', background: '#eeeeee' }}>Unreadable text</p>
};
export const UnnamedButton = {
 render: () => <button type="button"><span aria-hidden="true">+</span></button>
};
export const MissingAlt = {
 render: () => <img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" />
};
export const AccessibleControl = {
 render: () => <button type="button" style={{ color: '#000', background: '#fff' }}>Save</button>
};
`
	);
	const code = await new Promise((resolve, reject) => {
		const child = spawn(
			process.execPath,
			[
				'node_modules/vitest/vitest.mjs',
				'run',
				'--project',
				'storybook',
				fixtureDir,
				'--maxWorkers=2',
				'--minWorkers=1',
				'--reporter=default',
				'--reporter=json',
				`--outputFile=${reportPath}`
			],
			{ stdio: 'inherit' }
		);
		child.once('error', reject);
		child.once('close', resolve);
	});
	assert.equal(code, 1, 'The deliberately inaccessible stories must fail');
	const report = JSON.parse(await readFile(reportPath, 'utf8'));
	const tests = report.testResults.flatMap((file) => file.assertionResults);
	assert.equal(tests.length, 4, 'All four gate probes must execute');
	for (const [title, rule] of [
		['Low Contrast', 'color-contrast'],
		['Unnamed Button', 'button-name'],
		['Missing Alt', 'image-alt']
	]) {
		const test = tests.find((result) => result.title === title);
		assert.ok(test, `Missing probe: ${title}`);
		assert.equal(test.status, 'failed', `${title} must fail`);
		assert.ok(
			test.failureMessages.join('\n').includes(rule),
			`${title} must report axe rule ${rule}, not an unrelated error`
		);
	}
	assert.equal(
		tests.find((test) => test.title === 'Accessible Control')?.status,
		'passed',
		'Accessible control must pass'
	);
	console.log(
		'Accessibility gate verified: three expected axe failures and one passing control.'
	);
} finally {
	await rm(fixtureDir, { recursive: true, force: true });
	await rm(reportDir, { recursive: true, force: true });
}
