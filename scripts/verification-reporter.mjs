import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { BaseSequencer } from 'vite-plus/test/node';
import {
	createRunProvenance,
	suppliedBrowser
} from './verification-provenance.mjs';

// Append completed cases immediately. If a worker stalls or CI cancels the job,
// the artifact still distinguishes executed tests from queued/unfinished work.
export default class VerificationReporter {
	constructor(options = {}) {
		this.runId = randomUUID();
		this.provenance = { path: 'provenance.json', runId: this.runId };
		this.projects = [];
		this.inputs = [];
		this.browsers = new Map();
		this.directory =
			options.directory ||
			path.resolve(
				process.env.VERIFICATION_ARTIFACTS_DIR ||
					'verification-artifacts',
				`run-${process.pid}-${this.runId}`
			);
		this.modules = new Map();
		this.completedModules = new Set();
		this.modulePlanErrors = [];
		this.assignedSpecifications = [];
		this.assignmentPlan = {
			path: 'assignment-plan.json',
			valid: false,
			error: 'Run plan not received'
		};
		this.running = new Map();
		this.completed = new Map();
		this.eventAnomalies = [];
		this.reconciled = [];
		this.counts = {
			discoveredFiles: 0,
			expectedFiles: 0,
			collectedFiles: 0,
			completedFiles: 0,
			expectedTests: 0,
			passed: 0,
			failed: 0,
			skipped: 0,
			todo: 0,
			retries: 0,
			declaredNeedsData: 0
		};
		this.state = 'running';
	}
	ensureProvenance() {
		if (this.manifestWritten) return;
		mkdirSync(this.directory, { recursive: true });
		writeFileSync(
			path.join(this.directory, this.provenance.path),
			JSON.stringify(
				createRunProvenance({
					runId: this.runId,
					projects: this.projects,
					inputs: this.inputs
				}),
				null,
				2
			),
			{ flag: 'wx' }
		);
		this.manifestWritten = true;
	}
	save() {
		this.ensureProvenance();
		writeFileSync(
			path.join(this.directory, 'inventory.json'),
			JSON.stringify(
				{
					schemaVersion: 2,
					provenance: this.provenance,
					browsers: [...this.browsers.values()],
					state: this.state,
					...this.counts,
					executed: this.counts.passed + this.counts.failed,
					running:
						this.state === 'running'
							? [...this.running.values()]
							: [],
					unfinished:
						this.state === 'running'
							? []
							: [...this.running.values()],
					assignmentPlan: this.assignmentPlan,
					modulePlanErrors: this.modulePlanErrors,
					missingAssignedModules: this.assignedSpecifications.filter(
						(spec) =>
							!this.modules.has(this.identity(spec)) ||
							!this.completedModules.has(this.identity(spec))
					),
					inventoryComplete:
						this.assignmentPlan.valid &&
						['passed', 'failed'].includes(this.state) &&
						!(this.unhandledErrors || []).length &&
						this.modulePlanErrors.length === 0 &&
						this.assignedSpecifications.every(
							(spec) =>
								this.modules.has(this.identity(spec)) &&
								this.completedModules.has(this.identity(spec))
						) &&
						this.running.size === 0 &&
						this.counts.completedFiles ===
							this.counts.expectedFiles &&
						this.counts.expectedTests ===
							this.counts.passed +
								this.counts.failed +
								this.counts.skipped +
								this.counts.todo,
					eventAnomalies: this.eventAnomalies,
					reconciledTerminalEvents: this.reconciled,
					unhandledErrors: this.unhandledErrors || []
				},
				null,
				2
			)
		);
	}
	onInit(context) {
		this.context = context;
	}
	specification(spec) {
		return {
			project: spec.project?.name ?? spec.project?.config?.name ?? '',
			moduleId: spec.moduleId
		};
	}
	identity(spec) {
		const value =
			typeof spec.project === 'string' ? spec : this.specification(spec);
		return JSON.stringify([value.project, value.moduleId]);
	}
	publishAssignment(global, assigned, kind, error) {
		const discovered = global.map((spec) => this.specification(spec));
		const selection = assigned.map((spec) => this.specification(spec));
		const keys = new Set(discovered.map((spec) => this.identity(spec)));
		if (
			discovered.some((spec) => !spec.moduleId) ||
			keys.size !== discovered.length ||
			selection.some((spec) => !keys.has(this.identity(spec))) ||
			new Set(selection.map((spec) => this.identity(spec))).size !==
				selection.length
		) {
			error = 'Invalid or duplicate native specification identities';
		}
		this.assignedSpecifications = selection;
		this.assignmentPlan = {
			path: 'assignment-plan.json',
			kind,
			shard: this.context?.config?.shard ?? null,
			valid: !error,
			...(error ? { error } : {})
		};
		this.counts.expectedFiles = error ? null : selection.length;
		mkdirSync(this.directory, { recursive: true });
		writeFileSync(
			path.join(this.directory, this.assignmentPlan.path),
			JSON.stringify(
				{
					schemaVersion: 1,
					...this.assignmentPlan,
					global: discovered,
					assigned: selection
				},
				null,
				2
			),
			{ flag: 'wx' }
		);
		this.save();
	}
	onTestRunStart(specifications) {
		this.inputs = specifications
			.map((spec) => spec.moduleId)
			.filter(Boolean);
		this.projects = [
			...new Set(
				specifications
					.map(
						(spec) =>
							spec.project?.name ?? spec.project?.config?.name
					)
					.filter(Boolean)
			)
		].sort();
		this.counts.discoveredFiles = specifications.length;
		if (!this.context?.config) {
			this.publishAssignment(
				specifications,
				[],
				'unavailable',
				'Public native onInit context not received'
			);
			return;
		}
		if (!this.context.config.shard) {
			this.publishAssignment(
				specifications,
				specifications,
				'unsharded-global'
			);
			return;
		}
		if (this.context.config.sequence?.sequencer !== BaseSequencer) {
			this.publishAssignment(
				specifications,
				[],
				'unavailable',
				'Unsupported custom shard sequencer'
			);
			return;
		}
		// Pinned public native implementation, not a second copy of the split algorithm.
		// BaseSequencer.shard is pure; never invoke an unknown/stateful custom sequencer twice.
		return new BaseSequencer(this.context)
			.shard([...specifications])
			.then((assigned) => {
				this.publishAssignment(
					specifications,
					assigned,
					'vitest-base-sequencer'
				);
			});
	}
	onTestModuleCollected(module) {
		const identity = this.identity(module);
		if (
			!this.assignedSpecifications.some(
				(spec) => this.identity(spec) === identity
			)
		) {
			this.modulePlanErrors.push({
				event: 'unassigned-collection',
				...this.specification(module)
			});
		}
		if (!this.modules.has(identity)) {
			this.modules.set(identity, true);
			this.counts.collectedFiles += 1;
			this.counts.expectedTests += [...module.children.allTests()].length;
		}
		this.save();
	}
	event(event, test, extra = {}) {
		this.ensureProvenance();
		appendFileSync(
			path.join(this.directory, 'events.jsonl'),
			`${JSON.stringify({
				provenance: this.provenance,
				event,
				id: test.id,
				file: test.module.moduleId,
				name: test.fullName,
				...extra
			})}\n`
		);
	}
	onTestCaseReady(test) {
		this.event('ready', test);
		if (this.completed.has(test.id)) {
			this.eventAnomalies.push({
				event: 'ready-after-result',
				id: test.id,
				file: test.module.moduleId,
				name: test.fullName
			});
		} else {
			this.running.set(test.id, {
				id: test.id,
				file: test.module.moduleId,
				name: test.fullName,
				startedAt: new Date().toISOString()
			});
		}
		this.save();
	}
	onTestCaseResult(test) {
		const result = test.result();
		const diagnostic = test.diagnostic();
		const integrity = test.meta?.().verificationIntegrity;
		if (integrity?.classification === 'declared-needs-data')
			this.counts.declaredNeedsData += 1;
		const browser = suppliedBrowser(test.meta?.());
		if (browser) this.browsers.set(JSON.stringify(browser), browser);
		this.event('result', test, { state: result.state });
		this.completed.set(test.id, {
			file: test.module.moduleId,
			name: test.fullName,
			state: result.state
		});
		const state =
			result.state === 'skipped' && test.options.mode === 'todo'
				? 'todo'
				: result.state;
		if (state in this.counts) this.counts[state] += 1;
		this.counts.retries += diagnostic?.retryCount || 0;
		this.running.delete(test.id);
		mkdirSync(this.directory, { recursive: true });
		appendFileSync(
			path.join(this.directory, 'cases.jsonl'),
			`${JSON.stringify({
				provenance: this.provenance,
				browser,
				file: test.module.moduleId,
				name: test.fullName,
				state,
				durationMs: diagnostic?.duration,
				retries: diagnostic?.retryCount || 0,
				errors: result.errors?.map((error) => error.message),
				a11y: test.meta?.().verificationA11y,
				integrity
			})}\n`
		);
		this.save();
	}
	reconcile(module) {
		for (const test of module.children.allTests()) {
			const state = test.result().state;
			if (state !== 'pending' && this.running.has(test.id)) {
				this.reconciled.push({
					id: test.id,
					file: module.moduleId,
					name: test.fullName,
					state,
					evidence: 'terminal module test result'
				});
				this.running.delete(test.id);
			}
		}
	}
	onTestModuleEnd(module) {
		this.reconcile(module);
		const identity = this.identity(module);
		if (this.completedModules.has(identity)) {
			this.modulePlanErrors.push({
				event: 'duplicate-completion',
				...this.specification(module)
			});
		} else {
			this.completedModules.add(identity);
			this.counts.completedFiles += 1;
		}
		if (
			!this.assignedSpecifications.some(
				(spec) => this.identity(spec) === identity
			)
		) {
			this.modulePlanErrors.push({
				event: 'unassigned-completion',
				...this.specification(module)
			});
		}
		this.save();
	}
	onTestRunEnd(modules, errors, reason) {
		modules.forEach((module) => this.reconcile(module));
		this.state = reason;
		this.unhandledErrors = errors.map((error) => error.message);
		this.save();
	}
}
