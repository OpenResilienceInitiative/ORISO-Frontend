// @vitest-environment node
import {
	cpSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { BaseSequencer } from 'vite-plus/test/node';
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
		reporter.onInit({ config: {} });
		const module = {
			moduleId: path.resolve('src/test/verificationReporter.test.ts'),
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
		reporter.onTestRunStart([
			{ moduleId: path.resolve('src/test/verificationReporter.test.ts') }
		]);
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
		reporter.onInit({ config: {} });
		const cases: object[] = [];
		const module = {
			moduleId: path.resolve('src/test/verificationReporter.test.ts'),
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
		reporter.onTestRunStart([
			{ moduleId: path.resolve('src/test/verificationReporter.test.ts') }
		]);
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
		reporter.onInit({ config: {} });
		reporter.onTestRunStart([
			{ moduleId: path.resolve('src/test/verificationReporter.test.ts') }
		]);
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
		reporter.onInit({ config: {} });
		const tests: object[] = [];
		const module = {
			moduleId: path.resolve('src/test/verificationReporter.test.ts'),
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
		reporter.onTestRunStart([
			{
				moduleId: path.resolve('src/test/verificationReporter.test.ts'),
				project: { name: 'storybook' }
			}
		]);
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
		interrupted.onInit({ config: {} });
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
		reporter.onInit({ config: {} });
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
		reporter.onInit({ config: {} });
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

describe('authoritative native shard inventory', () => {
	const setup = (sharded = true, custom?: typeof BaseSequencer) => {
		const directory = mkdtempSync(path.join(tmpdir(), 'native-plan-'));
		directories.push(directory);
		const specifications = ['a', 'b', 'c', 'd'].map((name) => {
			const moduleId = path.join(directory, `${name}.test.ts`);
			writeFileSync(moduleId, '// declared reporter fixture\n');
			return { moduleId, project: { name: 'unit' } };
		});
		const context = {
			config: {
				root: directory,
				shard: sharded ? { index: 1, count: 2 } : undefined,
				sequence: { sequencer: custom ?? BaseSequencer }
			}
		};
		const reporter = new VerificationReporter({
			directory: path.join(directory, 'report')
		});
		reporter.onInit(context);
		const read = () =>
			JSON.parse(
				readFileSync(
					path.join(directory, 'report/inventory.json'),
					'utf8'
				)
			);
		const plan = () =>
			readFileSync(
				path.join(directory, 'report/assignment-plan.json'),
				'utf8'
			);
		return { directory, specifications, context, reporter, read, plan };
	};
	const complete = (
		reporter: VerificationReporter,
		specification: { moduleId: string; project: { name: string } }
	) => {
		const tests: object[] = [];
		const module = {
			...specification,
			children: { allTests: () => tests }
		};
		const test = {
			id: `${specification.project.name}:${specification.moduleId}`,
			module,
			fullName: 'assigned case',
			options: { mode: 'run' },
			result: () => ({ state: 'passed' }),
			diagnostic: () => ({ retryCount: 0 })
		};
		tests.push(test);
		reporter.onTestModuleCollected(module);
		reporter.onTestCaseResult(test);
		reporter.onTestModuleEnd(module);
		return module;
	};
	it('preserves global discovery and immutable native assigned identities before any collection', async () => {
		const fixture = setup();
		const assigned = await new BaseSequencer(
			fixture.context as never
		).shard(fixture.specifications as never);
		await fixture.reporter.onTestRunStart(fixture.specifications);
		const initialPlan = fixture.plan();
		expect(JSON.parse(initialPlan)).toMatchObject({
			global: fixture.specifications.map(({ moduleId, project }) => ({
				moduleId,
				project: project.name
			})),
			assigned: assigned.map(({ moduleId, project }) => ({
				moduleId,
				project: project.name
			}))
		});
		const modules = assigned.map((spec) =>
			complete(fixture.reporter, spec as never)
		);
		fixture.reporter.onTestRunEnd(modules, [], 'passed');
		expect(fixture.read()).toMatchObject({
			discoveredFiles: fixture.specifications.length,
			expectedFiles: assigned.length,
			inventoryComplete: true,
			missingAssignedModules: []
		});
		expect(fixture.plan()).toBe(initialPlan);
	});
	it('keeps a missing assigned module incomplete even when another global module is not assigned', async () => {
		const f = setup();
		const assigned = await new BaseSequencer(f.context as never).shard(
			f.specifications as never
		);
		await f.reporter.onTestRunStart(f.specifications);
		const module = complete(f.reporter, assigned[0] as never);
		f.reporter.onTestRunEnd([module], [], 'passed');
		expect(f.read()).toMatchObject({
			expectedFiles: assigned.length,
			inventoryComplete: false
		});
		expect(f.read().missingAssignedModules).toEqual([
			{ project: 'unit', moduleId: assigned[1].moduleId }
		]);
	});
	it('cannot replace a missing assigned module with duplicate or foreign completion events', async () => {
		const f = setup();
		const assigned = await new BaseSequencer(f.context as never).shard(
			f.specifications as never
		);
		await f.reporter.onTestRunStart(f.specifications);
		const own = complete(f.reporter, assigned[0] as never);
		const otherProject = {
			...assigned[1],
			project: { name: 'foreign-project' }
		};
		const foreign = complete(f.reporter, otherProject as never);
		f.reporter.onTestModuleEnd(own);
		f.reporter.onTestModuleEnd(foreign);
		f.reporter.onTestRunEnd([own, foreign], [], 'passed');
		expect(f.read().inventoryComplete).toBe(false);
		expect(f.read().missingAssignedModules).toContainEqual({
			project: 'unit',
			moduleId: assigned[1].moduleId
		});
	});
	it.each(['worker error', 'interrupted'])(
		'does not claim completeness after %s even with every module ended',
		async (failure) => {
			const f = setup(false);
			await f.reporter.onTestRunStart(f.specifications);
			const modules = f.specifications.map((spec) =>
				complete(f.reporter, spec)
			);
			f.reporter.onTestRunEnd(
				modules,
				failure === 'worker error'
					? [{ message: 'worker crashed' }]
					: [],
				failure === 'interrupted' ? 'interrupted' : 'failed'
			);
			expect(f.read().inventoryComplete).toBe(false);
		}
	);
	const customSequencer = (shard = vi.fn()) =>
		class extends BaseSequencer {
			shard = shard;
		};
	it('fails closed for a custom shard sequencer without invoking it twice or changing assignment', async () => {
		const shard = vi.fn();
		const f = setup(true, customSequencer(shard));
		await f.reporter.onTestRunStart(f.specifications);
		const modules = f.specifications.map((spec) =>
			complete(f.reporter, spec)
		);
		f.reporter.onTestRunEnd(modules, [], 'passed');
		expect(shard).not.toHaveBeenCalled();
		expect(f.read()).toMatchObject({
			inventoryComplete: false,
			assignmentPlan: { valid: false }
		});
	});
	it('leaves custom sorting without sharding on the exact global assigned plan', async () => {
		const f = setup(false, customSequencer());
		await f.reporter.onTestRunStart(f.specifications);
		const modules = f.specifications.map((spec) =>
			complete(f.reporter, spec)
		);
		f.reporter.onTestRunEnd(modules, [], 'failed');
		expect(f.read()).toMatchObject({
			expectedFiles: f.specifications.length,
			inventoryComplete: true
		});
	});
	it('requires the public onInit context instead of assuming an unknown run is unsharded', async () => {
		const f = setup(false);
		const reporter = new VerificationReporter({
			directory: path.join(f.directory, 'without-init')
		});
		await reporter.onTestRunStart(f.specifications);
		const modules = f.specifications.map((spec) =>
			complete(reporter, spec)
		);
		reporter.onTestRunEnd(modules, [], 'passed');
		const report = JSON.parse(
			readFileSync(
				path.join(f.directory, 'without-init/inventory.json'),
				'utf8'
			)
		);
		expect(report).toMatchObject({
			inventoryComplete: false,
			assignmentPlan: { valid: false }
		});
	});
});
