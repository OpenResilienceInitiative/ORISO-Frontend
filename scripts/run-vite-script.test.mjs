import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { spawn } from 'node:child_process';

const runner = resolve('scripts/run-vite-script.mjs');
const run = (args, cwd) =>
	new Promise((done, reject) => {
		const child = spawn(process.execPath, [runner, ...args], { cwd });
		let output = '';
		child.stdout.on('data', (data) => {
			output += data;
		});
		child.stderr.on('data', (data) => {
			output += data;
		});
		child.on('error', reject);
		child.on('close', (code) => done({ code, output }));
	});

test('executes a real TypeScript entry with argv, cwd and module-relative identity', async () => {
	const cwd = await realpath(await mkdtemp(join(tmpdir(), 'oriso-script-')));
	try {
		await writeFile(
			join(cwd, 'value.ts'),
			'export const value: number = 42;'
		);
		await writeFile(
			join(cwd, 'entry.mts'),
			`
import { writeFile } from 'node:fs/promises';
import { value } from './value';
await writeFile('result.json', JSON.stringify({ value, cwd: process.cwd(), argv: process.argv.slice(1), url: import.meta.url }));
`
		);
		const result = await run(['entry.mts', '--name', 'a value'], cwd);
		assert.equal(result.code, 0, result.output);
		const actual = JSON.parse(
			await readFile(join(cwd, 'result.json'), 'utf8')
		);
		assert.equal(actual.value, 42);
		assert.equal(actual.cwd, cwd);
		assert.deepEqual(actual.argv, [
			join(cwd, 'entry.mts'),
			'--name',
			'a value'
		]);
		assert.equal(
			actual.url,
			new URL(`file://${join(cwd, 'entry.mts')}`).href
		);
	} finally {
		await rm(cwd, { recursive: true });
	}
});

test('propagates module failures and explicit exit status without a live server', async () => {
	const cwd = await realpath(await mkdtemp(join(tmpdir(), 'oriso-script-')));
	try {
		await writeFile(
			join(cwd, 'throws.mts'),
			"throw new Error('controlled-loader-failure');"
		);
		const thrown = await run(['throws.mts'], cwd);
		assert.equal(thrown.code, 1);
		assert.match(thrown.output, /controlled-loader-failure/);
		await writeFile(join(cwd, 'status.mts'), 'process.exitCode = 7;');
		assert.equal((await run(['status.mts'], cwd)).code, 7);
	} finally {
		await rm(cwd, { recursive: true });
	}
});

test('missing entry returns a useful nonzero usage error', async () => {
	const result = await run([], process.cwd());
	assert.equal(result.code, 1);
	assert.match(result.output, /Usage:.*run-vite-script/);
});
