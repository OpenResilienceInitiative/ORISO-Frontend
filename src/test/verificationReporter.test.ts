// @vitest-environment node
import {
	cpSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';
import { BaseSequencer } from 'vite-plus/test/node';
import VerificationReporter from '../../scripts/verification-reporter.mjs';

const directories: string[] = [];
let initialExitCode: typeof process.exitCode;
beforeEach(() => {
	initialExitCode = process.exitCode;
});
const initialize = (reporter: VerificationReporter, config = {}) => {
	const callbacks: (() => unknown)[] = [];
	const readErrors = vi.fn((): unknown => []);
	reporter.onInit({
		config,
		state: { getUnhandledErrors: readErrors },
		onClose: (callback: () => unknown) => {
			callbacks.push(callback);
		}
	});
	return {
		callbacks,
		readErrors,
		close: () => Promise.all(callbacks.map((callback) => callback()))
	};
};
afterEach(() => {
	directories
		.splice(0)
		.forEach((directory) =>
			rmSync(directory, { recursive: true, force: true })
		);
	vi.unstubAllEnvs();
	// Restore only this controlled reporter fixture's exit-code side effect.
	process.exitCode = initialExitCode;
});

describe('durable verification inventory', () => {
	it('retains completed, skipped, retry and unfinished-test state before a run ends', () => {
		const directory = mkdtempSync(
			path.join(tmpdir(), 'frontend-verification-')
		);
		directories.push(directory);
		const reporter = new VerificationReporter({ directory });
		initialize(reporter);
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
	it('reconciles a terminal result followed by a delayed ready event without claiming a live test', async () => {
		const directory = mkdtempSync(
			path.join(tmpdir(), 'frontend-verification-')
		);
		directories.push(directory);
		const reporter = new VerificationReporter({ directory });
		const lifecycle = initialize(reporter);
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
		await lifecycle.close();
		const report = JSON.parse(
			readFileSync(path.join(directory, 'inventory.json'), 'utf8')
		);
		expect(report.running).toEqual([]);
		expect(report.inventoryComplete).toBe(false);
		expect(report.eventAnomalies).toHaveLength(1);
		expect(report.failed).toBe(1);
	});

	it('preserves an unexplained ready event as unfinished evidence at terminal interruption', () => {
		const directory = mkdtempSync(
			path.join(tmpdir(), 'frontend-verification-')
		);
		directories.push(directory);
		const reporter = new VerificationReporter({ directory });
		initialize(reporter);
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
		initialize(reporter);
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
		initialize(interrupted);
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
		initialize(reporter);
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
		initialize(reporter);
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
		const lifecycle = initialize(reporter, context.config);
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
		return {
			directory,
			specifications,
			context,
			reporter,
			read,
			plan,
			lifecycle
		};
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
		await fixture.lifecycle.close();
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
		await f.lifecycle.close();
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

describe('public after-pool error accounting', () => {
	const setup = () => {
		const directory = mkdtempSync(
			path.join(tmpdir(), 'late-native-errors-')
		);
		directories.push(directory);
		const reporter = new VerificationReporter({ directory });
		const lifecycle = initialize(reporter);
		const tests: object[] = [];
		const module = {
			moduleId: path.resolve('src/test/verificationReporter.test.ts'),
			project: { name: 'unit' },
			children: { allTests: () => tests }
		};
		const test = {
			id: 'native-case',
			module,
			fullName: 'literal native pass',
			options: { mode: 'run' },
			result: () => ({ state: 'passed' }),
			diagnostic: () => ({ retryCount: 0 })
		};
		tests.push(test);
		reporter.onTestRunStart([module]);
		reporter.onTestModuleCollected(module);
		reporter.onTestCaseReady(test);
		reporter.onTestCaseResult(test);
		reporter.onTestModuleEnd(module);
		const read = () =>
			JSON.parse(
				readFileSync(path.join(directory, 'inventory.json'), 'utf8')
			);
		return { reporter, lifecycle, module, directory, read };
	};
	it('keeps a passing run provisional until the actual public close snapshot', async () => {
		const f = setup();
		f.reporter.onTestRunEnd([f.module], [], 'passed');
		expect(f.read().inventoryComplete).toBe(false);
		await f.lifecycle.close();
		expect(f.lifecycle.readErrors).toHaveBeenCalledTimes(1);
		expect(f.read()).toMatchObject({
			state: 'passed',
			nativeRunReason: 'passed',
			passed: 1,
			failed: 0,
			inventoryComplete: true,
			afterPool: {
				status: 'checked',
				errors: [],
				exitCodeSnapshotIsFinal: false
			}
		});
	});
	it('fails on late-only native errors while retaining literal results and nested unknown-case context', async () => {
		const f = setup();
		f.reporter.onTestRunEnd([f.module], [], 'passed');
		const error = {
			name: 'AggregateError',
			type: 'Teardown Error',
			message: 'late native error',
			errors: [
				{
					type: 'unhandled exception',
					detail: {
						name: 'ReferenceError',
						message: 'document is not defined',
						stack: 'actual retained nested stack'
					}
				}
			]
		};
		f.lifecycle.readErrors.mockReturnValue([error]);
		await f.lifecycle.close();
		expect(process.exitCode).toBe(1);
		expect(f.read()).toMatchObject({
			state: 'failed',
			nativeRunReason: 'passed',
			passed: 1,
			failed: 0,
			inventoryComplete: false,
			nativeRunEndErrors: [],
			unhandledErrors: [],
			afterPool: { errors: [error], inventedCaseAttribution: null }
		});
		expect(f.read().afterPool.errorsInspect).toContain(
			'actual retained nested stack'
		);
	});
	it('retains earlier supplied errors separately when after-pool state adds another error', async () => {
		const f = setup();
		const earlier = {
			message: 'earlier worker error',
			stack: 'earlier stack'
		};
		f.reporter.onTestRunEnd([f.module], [earlier], 'failed');
		const late = { message: 'late error', detail: { stack: 'late stack' } };
		f.lifecycle.readErrors.mockReturnValue([late]);
		await f.lifecycle.close();
		expect(f.read()).toMatchObject({
			nativeRunReason: 'failed',
			nativeRunEndErrors: [earlier],
			unhandledErrors: ['earlier worker error'],
			afterPool: { errors: [late] },
			inventoryComplete: false
		});
		expect(process.exitCode).toBe(1);
	});
	it.each(['throw undefined', 'non-array'])(
		'fails closed for public state %s',
		async (kind) => {
			const f = setup();
			f.reporter.onTestRunEnd([f.module], [], 'passed');
			if (kind === 'throw undefined')
				f.lifecycle.readErrors.mockImplementation(() => {
					// eslint-disable-next-line no-throw-literal -- Exercise a real falsy throw in the public API.
					throw undefined;
				});
			else f.lifecycle.readErrors.mockReturnValue({ invalid: true });
			const outcomes = await Promise.allSettled([f.lifecycle.close()]);
			expect(outcomes[0].status).toBe('rejected');
			expect(process.exitCode).toBe(1);
			expect(f.read().inventoryComplete).toBe(false);
		}
	);
	it('requires the public close API rather than silently losing the late check', () => {
		const reporter = new VerificationReporter();
		expect(() =>
			reporter.onInit({
				config: {},
				state: { getUnhandledErrors: () => [] }
			})
		).toThrow('Public native close/error accounting unavailable');
		expect(process.exitCode).toBe(1);
	});
	it('rejects final write failure asynchronously so subsequent native close callbacks still run', async () => {
		const f = setup();
		f.reporter.onTestRunEnd([f.module], [], 'passed');
		const target = path.join(f.directory, 'inventory.json');
		rmSync(target);
		mkdirSync(target);
		const laterCleanup = vi.fn();
		f.lifecycle.callbacks.push(laterCleanup);
		const outcomes = await Promise.allSettled(
			f.lifecycle.callbacks.map((callback) => callback())
		);
		expect(outcomes[0]).toMatchObject({
			status: 'rejected',
			reason: { code: 'EISDIR' }
		});
		expect(laterCleanup).toHaveBeenCalledTimes(1);
		expect(process.exitCode).toBe(1);
	});
	it('does not fabricate a run for public initialization/collection without test execution', async () => {
		const directory = mkdtempSync(path.join(tmpdir(), 'no-native-run-'));
		directories.push(directory);
		const reporter = new VerificationReporter({ directory });
		const lifecycle = initialize(reporter);
		await lifecycle.close();
		expect(existsSync(path.join(directory, 'inventory.json'))).toBe(false);
		expect(process.exitCode).toBe(initialExitCode);
	});
	it('preserves an earlier nonzero native exit when late errors also occur', async () => {
		const f = setup();
		f.reporter.onTestRunEnd([f.module], [], 'passed');
		process.exitCode = 2;
		f.lifecycle.readErrors.mockReturnValue([{ message: 'late' }]);
		await f.lifecycle.close();
		expect(process.exitCode).toBe(2);
		expect(f.read().inventoryComplete).toBe(false);
	});
});

describe('matching public terminal snapshots for delayed ready events', () => {
	const setup = (
		id = 'native-case',
		name = 'literal native pass',
		file = 'src/test/verificationReporter.test.ts',
		recordResult = true,
		recordedState: string | undefined = 'passed'
	) => {
		const directory = mkdtempSync(
			path.join(tmpdir(), 'terminal-native-snapshot-')
		);
		directories.push(directory);
		const reporter = new VerificationReporter({ directory });
		const lifecycle = initialize(reporter);
		const snapshots: object[] = [];
		const module = {
			moduleId: path.resolve(file),
			project: { name: 'unit' },
			children: { allTests: () => snapshots }
		};
		const test = {
			id,
			module,
			fullName: name,
			options: { mode: 'run' },
			result: () => ({ state: recordedState }),
			diagnostic: () => ({ retryCount: 0 })
		};
		snapshots.push(test);
		reporter.onTestRunStart([module]);
		reporter.onTestModuleCollected(module);
		if (recordResult) reporter.onTestCaseResult(test);
		const read = () =>
			JSON.parse(
				readFileSync(path.join(directory, 'inventory.json'), 'utf8')
			);
		return {
			directory,
			reporter,
			lifecycle,
			module,
			test,
			snapshots,
			read
		};
	};
	const observed = [
		{
			id: '-1125501980_6_0',
			name: 'AccountData — the help-seeker is told which wording binds > names the language that actually binds, not a fixed one',
			file: 'src/components/registration/accountData/AccountData.consentGating.test.tsx'
		},
		{
			id: '-1125501980_6_3',
			name: 'AccountData — the help-seeker is told which wording binds > says nothing when the wording is the authored one',
			file: 'src/components/registration/accountData/AccountData.consentGating.test.tsx'
		},
		{
			id: '-1125501980_8_0',
			name: 'AccountData — a versioned acceptance is still tied to the wording shown > drops the tick when the same version is shown in another language',
			file: 'src/components/registration/accountData/AccountData.consentGating.test.tsx'
		},
		{
			id: '-1013758531_0_12',
			name: 'LiveChatEntryRoom — who is live, before anything is created > shows closed again when the door confirms it after "Ich warte"',
			file: 'src/components/anonymousChat/entryRoom/LiveChatEntryRoom.precheck.test.tsx'
		}
	];
	it.each(observed)(
		'resolves actual observed case $id only from its matching public module snapshot',
		async ({ id, name, file }) => {
			const f = setup(id, name, file);
			f.reporter.onTestCaseReady(f.test);
			f.reporter.onTestModuleEnd(f.module);
			f.reporter.onTestRunEnd([f.module], [], 'passed');
			await f.lifecycle.close();
			expect(f.read()).toMatchObject({
				state: 'passed',
				inventoryComplete: true,
				passed: 1,
				failed: 0,
				expectedTests: 1,
				skipped: 0,
				todo: 0,
				retries: 0,
				running: [],
				unfinished: [],
				unresolvedEventAnomalies: []
			});
			expect(f.read().eventAnomalies).toHaveLength(1);
			expect(f.read().reconciledTerminalEvents).toContainEqual(
				expect.objectContaining({
					id,
					name,
					file: path.resolve(file),
					project: 'unit',
					state: 'passed',
					evidence:
						'matching public module snapshot for delayed ready'
				})
			);
			const raw = readFileSync(
				path.join(f.directory, 'events.jsonl'),
				'utf8'
			)
				.trim()
				.split('\n')
				.map(JSON.parse);
			expect(
				raw.map(({ event, id: eventId }) => ({ event, id: eventId }))
			).toEqual([
				{ event: 'result', id },
				{ event: 'ready', id }
			]);
			const cases = readFileSync(
				path.join(f.directory, 'cases.jsonl'),
				'utf8'
			)
				.trim()
				.split('\n')
				.map(JSON.parse);
			expect(cases).toHaveLength(1);
			expect(cases[0]).toMatchObject({
				name,
				file: path.resolve(file),
				state: 'passed',
				retries: 0
			});
		}
	);
	it.each([
		'public case id',
		'public full name',
		'public module path',
		'public project',
		'ready full name',
		'ready module path',
		'ready project',
		'conflicting final state',
		'pending state',
		'unknown state',
		'missing public child',
		'duplicate ready',
		'ready after public module end'
	])('keeps %s unresolved despite a module-end callback', async (fault) => {
		const f = setup();
		let ready = f.test;
		let snapshot = f.test;
		if (fault === 'public case id')
			snapshot = { ...snapshot, id: 'another-native-id' };
		if (fault === 'public full name')
			snapshot = { ...snapshot, fullName: 'another test' };
		if (fault === 'public module path')
			snapshot = {
				...snapshot,
				module: {
					...f.module,
					moduleId: path.resolve(
						'src/test/storybookTenantPublicFixture.test.ts'
					)
				}
			};
		if (fault === 'public project')
			snapshot = {
				...snapshot,
				module: { ...f.module, project: { name: 'storybook' } }
			};
		if (fault === 'ready full name')
			ready = { ...ready, fullName: 'another test' };
		if (fault === 'ready module path')
			ready = {
				...ready,
				module: {
					...f.module,
					moduleId: path.resolve(
						'src/test/storybookTenantPublicFixture.test.ts'
					)
				}
			};
		if (fault === 'ready project')
			ready = {
				...ready,
				module: { ...f.module, project: { name: 'storybook' } }
			};
		if (fault === 'conflicting final state')
			snapshot = { ...snapshot, result: () => ({ state: 'failed' }) };
		if (fault === 'pending state')
			snapshot = { ...snapshot, result: () => ({ state: 'pending' }) };
		if (fault === 'unknown state')
			snapshot = { ...snapshot, result: () => ({ state: undefined }) };
		f.snapshots.splice(
			0,
			1,
			...(fault === 'missing public child' ? [] : [snapshot])
		);
		if (fault === 'ready after public module end')
			f.reporter.onTestModuleEnd(f.module);
		f.reporter.onTestCaseReady(ready);
		if (fault === 'duplicate ready') f.reporter.onTestCaseReady(ready);
		if (fault !== 'ready after public module end')
			f.reporter.onTestModuleEnd(f.module);
		f.reporter.onTestRunEnd([f.module], [], 'passed');
		await f.lifecycle.close();
		expect(f.read()).toMatchObject({
			state: 'failed',
			inventoryComplete: false,
			passed: 1,
			failed: 0
		});
		expect(f.read().unresolvedEventAnomalies).toHaveLength(
			fault === 'duplicate ready' ? 2 : 1
		);
		expect(f.read().reconciledTerminalEvents).toEqual([]);
		expect(process.exitCode).toBe(1);
	});
	it.each(['incomplete', 'interrupted'])(
		'retains %s failure even with a matching terminal child',
		async (kind) => {
			const f = setup();
			f.reporter.onTestCaseReady(f.test);
			if (kind !== 'incomplete') f.reporter.onTestModuleEnd(f.module);
			f.reporter.onTestRunEnd(
				[f.module],
				[],
				kind === 'interrupted' ? 'interrupted' : 'passed'
			);
			await f.lifecycle.close();
			expect(f.read()).toMatchObject({
				state: 'failed',
				inventoryComplete: false,
				passed: 1,
				failed: 0
			});
			if (kind === 'incomplete') {
				expect(f.read().unresolvedEventAnomalies).toHaveLength(1);
				expect(f.read().reconciledTerminalEvents).toEqual([]);
			}
			expect(process.exitCode).toBe(1);
		}
	);
	it.each(['failed', 'skipped'])(
		'does not resolve a matching recorded non-PASS state %s',
		async (state) => {
			const f = setup(
				'non-pass-case',
				'literal non-pass case',
				'src/test/verificationReporter.test.ts',
				true,
				state
			);
			f.reporter.onTestCaseReady(f.test);
			f.reporter.onTestModuleEnd(f.module);
			f.reporter.onTestRunEnd(
				[f.module],
				[],
				state === 'failed' ? 'failed' : 'passed'
			);
			await f.lifecycle.close();
			expect(f.read()).toMatchObject({
				state: 'failed',
				inventoryComplete: false,
				passed: 0,
				failed: state === 'failed' ? 1 : 0,
				skipped: state === 'skipped' ? 1 : 0
			});
			expect(f.read().unresolvedEventAnomalies).toHaveLength(1);
			expect(f.read().reconciledTerminalEvents).toEqual([]);
			expect(process.exitCode).toBe(1);
		}
	);
	it.each(['pending', undefined])(
		'does not clear an ordinary running record with public state %s',
		async (state) => {
			const f = setup(
				'pending-native-case',
				'unfinished public case',
				'src/test/verificationReporter.test.ts',
				false
			);
			const pending = { ...f.test, result: () => ({ state }) };
			f.snapshots.splice(0, 1, pending);
			f.reporter.onTestCaseReady(pending);
			f.reporter.onTestModuleEnd(f.module);
			f.reporter.onTestRunEnd([f.module], [], 'interrupted');
			await f.lifecycle.close();
			expect(f.read().unfinished).toContainEqual(
				expect.objectContaining({
					id: pending.id,
					name: pending.fullName
				})
			);
			expect(f.read().inventoryComplete).toBe(false);
			expect(process.exitCode).toBe(1);
		}
	);
});

describe('recorded identity at a delayed ready callback', () => {
	it('cannot rehabilitate a conflicting shared ID after a later PASS overwrites the completed map', async () => {
		const directory = mkdtempSync(
			path.join(tmpdir(), 'native-id-conflict-')
		);
		directories.push(directory);
		const reporter = new VerificationReporter({ directory });
		const lifecycle = initialize(reporter);
		const children: object[] = [];
		const module = {
			moduleId: path.resolve('src/test/verificationReporter.test.ts'),
			project: { name: 'unit' },
			children: { allTests: () => children }
		};
		const first = {
			id: 'conflicting-native-id',
			module,
			fullName: 'public child A',
			options: { mode: 'run' },
			result: () => ({ state: 'passed' }),
			diagnostic: () => ({ retryCount: 0 })
		};
		const second = { ...first, fullName: 'public child B' };
		children.push(first, second);
		reporter.onTestRunStart([module]);
		reporter.onTestModuleCollected(module);
		reporter.onTestCaseReady(first);
		reporter.onTestCaseResult(first);
		reporter.onTestCaseReady(second);
		reporter.onTestCaseResult(second);
		reporter.onTestModuleEnd(module);
		reporter.onTestRunEnd([module], [], 'passed');
		await lifecycle.close();
		const read = JSON.parse(
			readFileSync(path.join(directory, 'inventory.json'), 'utf8')
		);
		expect(read).toMatchObject({
			state: 'failed',
			nativeRunReason: 'passed',
			inventoryComplete: false,
			expectedTests: 2,
			passed: 2,
			failed: 0,
			skipped: 0,
			todo: 0,
			retries: 0
		});
		expect(read.eventAnomalies).toHaveLength(1);
		expect(read.unresolvedEventAnomalies).toHaveLength(1);
		expect(read.reconciledTerminalEvents).toEqual([]);
		expect(read.eventAnomalies[0]).toMatchObject({
			id: first.id,
			name: second.fullName,
			completedAtReady: {
				id: first.id,
				name: first.fullName,
				project: 'unit',
				file: module.moduleId,
				state: 'passed'
			}
		});
		const cases = readFileSync(path.join(directory, 'cases.jsonl'), 'utf8')
			.trim()
			.split('\n')
			.map(JSON.parse);
		expect(cases.map(({ name, state }) => ({ name, state }))).toEqual([
			{ name: first.fullName, state: 'passed' },
			{ name: second.fullName, state: 'passed' }
		]);
		const events = readFileSync(
			path.join(directory, 'events.jsonl'),
			'utf8'
		)
			.trim()
			.split('\n')
			.map(JSON.parse);
		expect(
			events.map(({ event, name, id }) => ({ event, name, id }))
		).toEqual([
			{ event: 'ready', name: first.fullName, id: first.id },
			{ event: 'result', name: first.fullName, id: first.id },
			{ event: 'ready', name: second.fullName, id: first.id },
			{ event: 'result', name: second.fullName, id: first.id }
		]);
		expect(process.exitCode).toBe(1);
	});
});
