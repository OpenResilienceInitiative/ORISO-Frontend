import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
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
		this.running = new Map();
		this.completed = new Map();
		this.eventAnomalies = [];
		this.reconciled = [];
		this.counts = {
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
					inventoryComplete:
						this.state !== 'running' &&
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
		this.counts.expectedFiles = specifications.length;
		this.save();
	}
	onTestModuleCollected(module) {
		if (!this.modules.has(module.moduleId)) {
			this.modules.set(module.moduleId, true);
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
		this.counts.completedFiles += 1;
		this.save();
	}
	onTestRunEnd(modules, errors, reason) {
		modules.forEach((module) => this.reconcile(module));
		this.state = reason;
		this.unhandledErrors = errors.map((error) => error.message);
		this.save();
	}
}
