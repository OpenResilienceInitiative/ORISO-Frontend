// @vitest-environment node
import { cpSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import VerificationReporter from '../../scripts/verification-reporter.mjs';

const directories: string[] = [];
afterEach(() => {
	directories
		.splice(0)
		.forEach((directory) =>
			rmSync(directory, { recursive: true, force: true })
		);
	vi.unstubAllEnvs();
});

describe('durable verification inventory', () => {
	it('retains completed, skipped, retry and unfinished-test state before a run ends', () => {
		const directory = mkdtempSync(
			path.join(tmpdir(), 'frontend-verification-')
		);
		directories.push(directory);
		const reporter = new VerificationReporter({ directory });
		const module = {
			moduleId: 'example.test.ts',
			children: { allTests: () => [1, 2, 3] }
		};
		const test = (
			id: string,
			state: string,
			mode = 'run',
			retries = 0
		) => ({
			id,
			module,
			fullName: id,
			options: { mode },
			result: () => ({ state }),
			diagnostic: () => ({ retryCount: retries, duration: 5 })
		});
		reporter.onTestRunStart([{}]);
		reporter.onTestModuleCollected(module);
		reporter.onTestCaseResult(test('passed', 'passed', 'run', 1));
		expect(
			JSON.parse(
				readFileSync(path.join(directory, 'inventory.json'), 'utf8')
			).executed
		).toBe(1);
		reporter.onTestCaseResult(test('todo', 'skipped', 'todo'));
		reporter.onTestCaseReady(test('unfinished', 'pending'));
		const report = JSON.parse(
			readFileSync(path.join(directory, 'inventory.json'), 'utf8')
		);
		expect(report).toMatchObject({
			state: 'running',
			expectedTests: 3,
			executed: 1,
			todo: 1,
			retries: 1,
			completedFiles: 0
		});
		expect(report.running).toHaveLength(1);
		expect(
			readFileSync(path.join(directory, 'cases.jsonl'), 'utf8')
				.trim()
				.split('\n')
		).toHaveLength(2);
		reporter.onTestRunEnd(
			[],
			[{ message: 'unhandled control' }],
			'interrupted'
		);
		expect(
			JSON.parse(
				readFileSync(path.join(directory, 'inventory.json'), 'utf8')
			)
		).toMatchObject({
			state: 'interrupted',
			unhandledErrors: ['unhandled control']
		});
	});
	it('reconciles a terminal result followed by a delayed ready event without claiming a live test', () => {
		const directory = mkdtempSync(
			path.join(tmpdir(), 'frontend-verification-')
		);
		directories.push(directory);
		const reporter = new VerificationReporter({ directory });
		const cases: object[] = [];
		const module = {
			moduleId: 'story.stories.tsx',
			children: { allTests: () => cases }
		};
		const test = {
			id: 'case-id',
			module,
			fullName: 'Completed story',
			options: { mode: 'run' },
			result: () => ({
				state: 'failed',
				errors: [{ message: 'actual axe failure' }]
			}),
			diagnostic: () => ({ retryCount: 0, duration: 204.4 })
		};
		cases.push(test);
		reporter.onTestRunStart([{}]);
		reporter.onTestModuleCollected(module);
		reporter.onTestCaseResult(test);
		reporter.onTestCaseReady(test);
		reporter.onTestModuleEnd(module);
		reporter.onTestRunEnd([module], [], 'failed');
		const report = JSON.parse(
			readFileSync(path.join(directory, 'inventory.json'), 'utf8')
		);
		expect(report.running).toEqual([]);
		expect(report.inventoryComplete).toBe(true);
		expect(report.eventAnomalies).toHaveLength(1);
		expect(report.failed).toBe(1);
	});

	it('preserves an unexplained ready event as unfinished evidence at terminal interruption', () => {
		const directory = mkdtempSync(
			path.join(tmpdir(), 'frontend-verification-')
		);
		directories.push(directory);
		const reporter = new VerificationReporter({ directory });
		reporter.onTestRunStart([{}]);
		reporter.onTestCaseReady({
			id: 'unfinished',
			module: { moduleId: 'unfinished.test.ts' },
			fullName: 'Unfinished'
		});
		reporter.onTestRunEnd([], [], 'interrupted');
		const report = JSON.parse(
			readFileSync(path.join(directory, 'inventory.json'), 'utf8')
		);
		expect(report.running).toEqual([]);
		expect(report.unfinished).toHaveLength(1);
		expect(report.inventoryComplete).toBe(false);
	});
	it('binds interrupted and terminal streams to one portable immutable source/runtime manifest', () => {
		const directory = mkdtempSync(
			path.join(tmpdir(), 'frontend-verification-')
		);
		directories.push(directory);
		const reporter = new VerificationReporter({ directory });
		const tests: object[] = [];
		const module = {
			moduleId: 'browser.stories.tsx',
			children: { allTests: () => tests },
			project: { name: 'storybook' }
		};
		const test = {
			id: 'browser-case',
			module,
			fullName: 'Browser evidence',
			options: { mode: 'run' },
			result: () => ({ state: 'passed' }),
			diagnostic: () => ({ retryCount: 0 }),
			meta: () => ({
				verificationA11y: {
					reports: [
						{
							result: {
								testEnvironment: {
									userAgent:
										'Mozilla/5.0 HeadlessChrome/151.0.7922.34 Safari/537.36'
								}
							}
						}
					]
				}
			})
		};
		tests.push(test);
		reporter.onTestRunStart([{ project: { name: 'storybook' } }]);
		reporter.onTestModuleCollected(module);
		reporter.onTestCaseReady(test);
		const readInventory = () =>
			JSON.parse(
				readFileSync(path.join(directory, 'inventory.json'), 'utf8')
			);
		const running = readInventory();
		expect(running.provenance).toEqual({
			path: 'provenance.json',
			runId: expect.any(String)
		});
		const manifestPath = path.join(directory, running.provenance.path);
		const initial = readFileSync(manifestPath, 'utf8');
		const manifest = JSON.parse(initial);
		expect(manifest).toMatchObject({
			runId: running.provenance.runId,
			source: {
				revision: expect.stringMatching(/^[a-f0-9]{40}$/),
				dirty: expect.any(Boolean),
				snapshot: {
					algorithm: 'sha256',
					digest: expect.stringMatching(/^[a-f0-9]{64}$/),
					files: expect.any(Number)
				}
			},
			runtime: {
				node: process.version,
				platform: process.platform,
				arch: process.arch
			},
			toolchain: {
				vitePlus: '1.3.0',
				vitest: '5.0.5',
				storybook: '10.6.3',
				vite: {
					package: '@voidzero-dev/vite-plus-core',
					packageVersion: '1.3.0',
					runtimeVersion: '8.3.4'
				}
			},
			invocation: { command: expect.any(Array), projects: ['storybook'] }
		});
		reporter.onTestCaseResult(test);
		reporter.onTestModuleEnd(module);
		reporter.onTestRunEnd([module], [], 'passed');
		expect(readFileSync(manifestPath, 'utf8')).toBe(initial);
		expect(readInventory()).toMatchObject({
			provenance: running.provenance,
			browsers: [
				{
					name: 'chromium',
					version: '151.0.7922.34',
					userAgent: expect.any(String)
				}
			]
		});
		['cases.jsonl', 'events.jsonl'].forEach((stream) => {
			const records = readFileSync(path.join(directory, stream), 'utf8')
				.trim()
				.split('\n')
				.map(JSON.parse);
			expect(
				records.every(
					(record) =>
						record.provenance.path === 'provenance.json' &&
						record.provenance.runId === manifest.runId
				)
			).toBe(true);
		});
		const copiedDirectory = mkdtempSync(
			path.join(tmpdir(), 'copied-verification-')
		);
		directories.push(copiedDirectory);
		cpSync(directory, copiedDirectory, { recursive: true });
		const copied = JSON.parse(
			readFileSync(path.join(copiedDirectory, 'inventory.json'), 'utf8')
		);
		expect(
			readFileSync(
				path.join(copiedDirectory, copied.provenance.path),
				'utf8'
			)
		).toBe(initial);
		const interruptedDirectory = mkdtempSync(
			path.join(tmpdir(), 'frontend-verification-')
		);
		directories.push(interruptedDirectory);
		const interrupted = new VerificationReporter({
			directory: interruptedDirectory
		});
		interrupted.onTestRunStart([]);
		interrupted.onTestRunEnd([], [], 'interrupted');
		const interruptedInventory = JSON.parse(
			readFileSync(
				path.join(interruptedDirectory, 'inventory.json'),
				'utf8'
			)
		);
		expect(interruptedInventory.provenance.runId).not.toBe(manifest.runId);
		expect(
			JSON.parse(
				readFileSync(
					path.join(
						interruptedDirectory,
						interruptedInventory.provenance.path
					),
					'utf8'
				)
			).source.snapshot.digest
		).toMatch(/^[a-f0-9]{64}$/);
	});

	it('rejects an explicitly supplied checkout SHA that does not identify HEAD', () => {
		const directory = mkdtempSync(
			path.join(tmpdir(), 'frontend-verification-')
		);
		directories.push(directory);
		vi.stubEnv(
			'VERIFICATION_SOURCE_SHA',
			'0000000000000000000000000000000000000000'
		);
		const reporter = new VerificationReporter({ directory });
		expect(() => reporter.onTestRunStart([])).toThrow(
			'does not match checked-out HEAD'
		);
	});
	it('keeps declared needs-data failures separate from passing evidence', () => {
		const directory = mkdtempSync(
			path.join(tmpdir(), 'frontend-verification-')
		);
		directories.push(directory);
		const reporter = new VerificationReporter({ directory });
		const test = {
			id: 'needs-data',
			module: { moduleId: 'declared.stories.tsx' },
			fullName: 'Declared data',
			options: { mode: 'run' },
			result: () => ({ state: 'failed' }),
			diagnostic: () => ({}),
			meta: () => ({
				verificationIntegrity: {
					classification: 'declared-needs-data',
					storyId: 'declared'
				}
			})
		};
		reporter.onTestRunStart([]);
		reporter.onTestCaseResult(test);
		expect(
			JSON.parse(
				readFileSync(path.join(directory, 'inventory.json'), 'utf8')
			)
		).toMatchObject({ failed: 1, passed: 0, declaredNeedsData: 1 });
		expect(
			JSON.parse(
				readFileSync(path.join(directory, 'cases.jsonl'), 'utf8')
			)
		).toMatchObject({
			state: 'failed',
			integrity: { classification: 'declared-needs-data' }
		});
	});
});
