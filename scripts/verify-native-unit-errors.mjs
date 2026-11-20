import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
	closeSync,
	mkdirSync,
	openSync,
	readFileSync,
	readdirSync,
	writeFileSync
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const fixtureRoot = path.join(root, 'scripts/native-unit-error-canary');
const output = path.join(
	root,
	'verification-artifacts/native-unit-errors',
	`${Date.now()}-${process.pid}`
);
mkdirSync(output, { recursive: true });
const read = (file) => JSON.parse(readFileSync(file, 'utf8'));
const hash = (file) =>
	createHash('sha256').update(readFileSync(file)).digest('hex');
const stages = [
	{
		file: 'late-observer.test.ts',
		exit: 1,
		errorName: 'ReferenceError',
		errorMessage: 'document is not defined',
		stackOwner: 'fixture',
		names: ['real body observer remains until environment teardown']
	},
	{
		file: 'proper-cleanup.test.ts',
		exit: 0,
		names: [
			'same real body observer disconnects before owned DOM cleanup',
			'ordinary expected console.error remains an ordinary log',
			'lookalike Uncaught console text remains an ordinary log'
		]
	},
	{
		file: 'constructor-fault.test.ts',
		exit: 1,
		errorName: 'Error',
		errorMessage: 'ORISO_CANARY_CONSTRUCTOR_ERROR',
		stackOwner: 'https://oriso-native-canary.test/constructor-fault',
		names: [
			'constructor script runs and its real exception remains visible'
		]
	},
	{
		file: 'constructor-healthy.test.ts',
		exit: 0,
		names: ['configured constructor HTML executes without an exception']
	}
];
const summary = {
	runtime: process.version,
	output,
	stages: [],
	accepted: false
};
const save = () =>
	writeFileSync(
		path.join(output, 'summary.json'),
		JSON.stringify(summary, null, 2)
	);
try {
	for (const stage of stages) {
		const directory = path.join(output, stage.file);
		mkdirSync(directory);
		const fixture = path.join(fixtureRoot, stage.file);
		const nativePath = path.join(directory, 'native.json');
		const verification = path.join(directory, 'verification');
		const argv = [
			path.join(root, 'node_modules/vitest/vitest.mjs'),
			'run',
			'--config',
			path.join(fixtureRoot, 'vitest.config.mts'),
			'--project',
			'unit',
			'--maxWorkers=2',
			'--retry=0',
			`--outputFile=${nativePath}`,
			fixture
		];
		const record = {
			fixture,
			fixtureSHA256: hash(fixture),
			argv,
			plannedNames: stage.names,
			expectedNativeExit: stage.exit,
			interpretation:
				'Native cases, natural exit and final inventory are separate facts',
			accepted: false
		};
		summary.stages.push(record);
		save();
		const fd = openSync(path.join(directory, 'raw.log'), 'wx');
		let child;
		try {
			child = spawnSync(process.execPath, argv, {
				cwd: root,
				env: {
					...process.env,
					CI: 'true',
					TZ: 'UTC',
					VERIFICATION_ARTIFACTS_DIR: verification
				},
				stdio: ['ignore', fd, fd],
				timeout: 180_000,
				killSignal: 'SIGKILL'
			});
		} finally {
			closeSync(fd);
		}
		Object.assign(record, {
			nativeExit: child.status,
			signal: child.signal,
			error: child.error
				? {
						name: child.error.name,
						message: child.error.message,
						code: child.error.code
					}
				: null
		});
		save();
		assert.equal(
			child.error,
			undefined,
			'Launch/timeout errors are not canary proof'
		);
		assert.equal(
			child.signal,
			null,
			'Forced/partial runs are not canary proof'
		);
		assert.equal(
			child.status,
			stage.exit,
			'Unexpected natural native exit'
		);
		const native = read(nativePath);
		assert.equal(
			native.success,
			true,
			'Literal native JSON case success must survive separately'
		);
		assert.equal(native.numTotalTests, stage.names.length);
		assert.equal(native.numPassedTests, stage.names.length);
		for (const key of ['numFailedTests', 'numPendingTests', 'numTodoTests'])
			assert.equal(native[key], 0);
		assert.equal(native.testResults.length, 1);
		assert.equal(path.resolve(native.testResults[0].name), fixture);
		const assertions = native.testResults[0].assertionResults;
		assert.deepEqual(
			assertions.map((item) => item.fullName).sort(),
			[...stage.names].sort()
		);
		for (const item of assertions) {
			assert.equal(item.status, 'passed');
			assert.deepEqual(item.failureMessages, []);
		}
		const runs = readdirSync(verification);
		assert.equal(
			runs.length,
			1,
			'Exactly one fresh normal reporter run required'
		);
		const run = path.join(verification, runs[0]);
		const inventory = read(path.join(run, 'inventory.json'));
		const provenance = read(path.join(run, 'provenance.json'));
		assert.equal(provenance.runId, inventory.provenance.runId);
		assert.equal(provenance.runtime.node, process.version);
		if (summary.stages.length > 1) {
			assert.deepEqual(
				provenance.source,
				summary.stages[0].provenance.source
			);
			assert.deepEqual(
				provenance.toolchain,
				summary.stages[0].provenance.toolchain
			);
		}
		assert.equal(inventory.assignmentPlan.valid, true);
		assert.equal(inventory.assignmentPlan.kind, 'unsharded-global');
		for (const key of [
			'discoveredFiles',
			'expectedFiles',
			'collectedFiles',
			'completedFiles'
		])
			assert.equal(inventory[key], 1);
		for (const key of ['expectedTests', 'executed', 'passed'])
			assert.equal(inventory[key], stage.names.length);
		for (const key of [
			'failed',
			'skipped',
			'todo',
			'retries',
			'declaredNeedsData'
		])
			assert.equal(inventory[key], 0);
		for (const key of [
			'running',
			'unfinished',
			'modulePlanErrors',
			'missingAssignedModules',
			'eventAnomalies'
		])
			assert.deepEqual(inventory[key], []);
		assert.equal(inventory.nativeRunReason, 'passed');
		assert.equal(inventory.afterPool.status, 'checked');
		const cases = readFileSync(path.join(run, 'cases.jsonl'), 'utf8')
			.trim()
			.split('\n')
			.map(JSON.parse);
		assert.deepEqual(
			cases.map((item) => item.name).sort(),
			[...stage.names].sort()
		);
		for (const item of cases) {
			assert.equal(path.resolve(item.file), fixture);
			assert.equal(item.state, 'passed');
			assert.equal(item.retries, 0);
			assert.equal(item.provenance.runId, provenance.runId);
			assert.equal((item.errors || []).length, 0);
		}
		if (stage.exit === 1) {
			assert.equal(inventory.state, 'failed');
			assert.equal(inventory.inventoryComplete, false);
			const checkFault = (error) => {
				assert.equal(error.name, 'AggregateError');
				assert.equal(error.type, 'Teardown Error');
				assert.equal(error.errors.length, 1);
				const [nested] = error.errors;
				assert.equal(nested.type, 'unhandled exception');
				assert.equal(nested.detail.name, stage.errorName);
				assert.equal(nested.detail.message, stage.errorMessage);
				const owner =
					stage.stackOwner === 'fixture' ? fixture : stage.stackOwner;
				assert.ok(
					nested.detail.stack.includes(owner),
					'Actual nested exception must bind the intended owner'
				);
			};
			assert.equal(inventory.afterPool.errors.length, 1);
			checkFault(inventory.afterPool.errors[0]);
			// Native teardown may arrive before or after onTestRunEnd. Accept
			// only this exact fault at either checkpoint, never unrelated errors.
			assert.ok(inventory.nativeRunEndErrors.length <= 1);
			inventory.nativeRunEndErrors.forEach(checkFault);
			assert.deepEqual(
				inventory.unhandledErrors,
				inventory.nativeRunEndErrors.map((error) => error.message)
			);
		} else {
			assert.equal(inventory.state, 'passed');
			assert.equal(inventory.inventoryComplete, true);
			assert.deepEqual(inventory.afterPool.errors, []);
			assert.deepEqual(inventory.nativeRunEndErrors, []);
			assert.deepEqual(inventory.unhandledErrors, []);
		}
		Object.assign(record, {
			accepted: true,
			nativeCases: native.numTotalTests,
			nativeJSONSuccess: native.success,
			inventoryComplete: inventory.inventoryComplete,
			overall: inventory.state,
			afterPoolErrors: inventory.afterPool.errors,
			inventorySHA256: hash(path.join(run, 'inventory.json')),
			nativeSHA256: hash(nativePath),
			provenance
		});
		save();
	}
	summary.accepted = true;
} catch (error) {
	summary.failure = {
		name: error.name,
		message: error.message,
		stack: error.stack
	};
	process.exitCode = 1;
} finally {
	save();
	console.log(
		`Native unit error canary: ${summary.accepted ? 'expected outcomes verified' : 'FAILED'}; ${output}`
	);
}
