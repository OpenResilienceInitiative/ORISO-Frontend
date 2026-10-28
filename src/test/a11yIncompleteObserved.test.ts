import { describe, expect, it } from 'vite-plus/test';
import {
	createA11yBaselineGate,
	fingerprintViolations
} from '../../.storybook/a11yBaseline';
import observed from './fixtures/a11y-observed-native-55.json';

// Complete native PASS reports retain full axe arrays in results.json.
// Never send the compact cases.jsonl pass summaries through the shape gate.
const incompleteReport = () =>
	structuredClone(observed.cases.incomplete.report);
const cleanReport = () => structuredClone(observed.cases.clean.report);

type Report = {
	type?: string;
	version?: number;
	status?: string;
	result?: unknown;
};
const context = (id = observed.cases.incomplete.storyId) => {
	const reports: Report[] = [];
	return {
		id,
		parameters: { a11y: { test: 'error' } },
		globals: {},
		reporting: { reports }
	};
};
const options = {
	environment: () => 'observed-audit-unit-replay',
	styles: () => [],
	today: () => '2026-10-21'
};
const gate = () => createA11yBaselineGate({ ...options, entries: [] });
const record = (evidence: unknown[]) => (value: unknown) =>
	evidence.push(value);

// Unit-only composition: retain the actual observed violation nodes/checks,
// but clear incomplete to isolate the independent violation rejection path.
// This is not a newly executed complete browser audit.
const violationReport = () => {
	const raw = incompleteReport();
	raw.status = 'failed';
	raw.result.violations = structuredClone(
		observed.cases.violation.report.result.violations
	);
	raw.result.incomplete = [];
	return raw;
};

// #1338: axe's `incomplete` (could not measure) is recorded, not failed;
// violations still fail.
describe('observed incomplete accessibility audits are recorded, not failed', () => {
	it.each(['full', 'aria-allowed-attr', 'color-contrast'])(
		'accepts actual zero-violation SidePanel evidence (%s), retaining data and restoring isolation',
		(rule) => {
			const raw = incompleteReport();
			if (rule !== 'full')
				raw.result.incomplete = raw.result.incomplete.filter(
					(item) => item.id === rule
				);
			expect(raw.result.violations).toEqual([]);
			expect(raw.result.incomplete.length).toBeGreaterThan(0);
			const before = JSON.stringify(raw);
			const ctx = context();
			const original = ctx.parameters;
			const bridge = gate();
			const evidence: unknown[] = [];
			bridge.begin(ctx);
			ctx.reporting.reports.push(raw);
			expect(() => bridge.finish(record(evidence))).not.toThrow();
			expect(evidence).toHaveLength(1);
			expect(evidence[0]).toMatchObject({
				storyId: ctx.id,
				auditCount: 1,
				strictAssertionCompanion: false,
				fingerprints: [],
				reports: [
					expect.objectContaining({
						result: expect.objectContaining({
							testEngine: raw.result.testEngine,
							testEnvironment: raw.result.testEnvironment,
							incomplete: raw.result.incomplete,
							violations: []
						})
					})
				]
			});
			expect(JSON.stringify(raw)).toBe(before);
			expect(ctx.parameters).toBe(original);
			expect(() => bridge.finish()).toThrow(
				'missing active story identity'
			);
			const next = context(observed.cases.clean.storyId);
			const nextParameters = next.parameters;
			bridge.begin(next);
			next.reporting.reports.push(cleanReport());
			expect(() => bridge.finish()).not.toThrow();
			expect(next.parameters).toBe(nextParameters);
		}
	);

	it('lets an exact unit-only violation approval pass while incomplete checks ride along', () => {
		const raw = incompleteReport();
		raw.result.violations = structuredClone(
			observed.cases.violation.report.result.violations
		);
		raw.status = 'warning';
		// Deliberate test-local approval only; no source approval file changes.
		const bridge = createA11yBaselineGate({
			...options,
			entries: [
				{
					storyId: observed.cases.incomplete.storyId,
					environment: options.environment(),
					owner: 'unit-regression-only',
					issue: 'https://github.com/OpenResilienceInitiative/ORISO-Frontend/issues/1338',
					expires: '2099-01-01',
					fingerprints: fingerprintViolations(
						raw.result,
						options.styles
					)
				}
			]
		});
		const ctx = context();
		const original = ctx.parameters;
		bridge.begin(ctx);
		expect(ctx.parameters.a11y.test).toBe('todo');
		ctx.reporting.reports.push(raw);
		const evidence: unknown[] = [];
		expect(() => bridge.finish(record(evidence))).not.toThrow();
		expect(evidence[0]).toMatchObject({
			auditCount: 1,
			reports: [
				expect.objectContaining({
					result: expect.objectContaining({
						incomplete: raw.result.incomplete,
						violations: raw.result.violations
					})
				})
			]
		});
		expect(ctx.parameters).toBe(original);
	});

	it('still rejects a report status that does not match, incomplete checks or not', () => {
		const ctx = context();
		const bridge = gate();
		const raw = incompleteReport();
		raw.status = 'warning';
		bridge.begin(ctx);
		ctx.reporting.reports.push(raw);
		expect(() => bridge.finish()).toThrow(
			'Accessibility audit mode/report status does not match'
		);
	});

	it('accepts the genuinely completed clean Desktop audit', () => {
		const ctx = context(observed.cases.clean.storyId);
		const bridge = gate();
		const raw = cleanReport();
		expect(raw.result.violations).toEqual([]);
		expect(raw.result.incomplete).toEqual([]);
		bridge.begin(ctx);
		ctx.reporting.reports.push(raw);
		const evidence: unknown[] = [];
		expect(() => bridge.finish(record(evidence))).not.toThrow();
		expect(evidence[0]).toMatchObject({
			auditCount: 1,
			strictAssertionCompanion: false,
			fingerprints: []
		});
	});

	it('still rejects actual observed violation nodes in an explicitly unit-derived complete envelope', () => {
		const raw = violationReport();
		expect(raw.result.violations).toEqual(
			observed.cases.violation.report.result.violations
		);
		const ctx = context(observed.cases.violation.storyId);
		const bridge = gate();
		bridge.begin(ctx);
		ctx.reporting.reports.push(raw);
		expect(() => bridge.finish()).toThrow(
			'Unapproved accessibility violation'
		);
	});

	it('retains one genuine audit plus its native strict companion and fails on its violations', () => {
		const native = observed.cases.violation;
		// Failed-native retention compacted only passes/inapplicable; restore
		// those summary arrays to [] for this explicitly unit-only shape replay.
		const raw = {
			...structuredClone(native.report),
			result: {
				...structuredClone(native.report.result),
				passes: [],
				inapplicable: []
			}
		};
		const retained = native.retainedReports.find(
			(item) => 'errorDetails' in item.result
		);
		if (
			!retained ||
			!('errorDetails' in retained.result) ||
			!retained.result.errorDetails ||
			typeof retained.result.errorDetails.message !== 'string'
		)
			throw new Error('Native strict companion evidence is missing');
		const error = Object.assign(
			new Error(retained.result.errorDetails.message),
			{ actual: raw.result.violations }
		);
		const ctx = context(native.storyId);
		const original = ctx.parameters;
		const bridge = gate();
		bridge.begin(ctx);
		ctx.reporting.reports.push(raw, {
			type: 'a11y',
			version: 1,
			status: 'failed',
			result: { error }
		});
		const evidence: unknown[] = [];
		expect(() => bridge.finish(record(evidence))).toThrow(
			'Unapproved accessibility violation'
		);
		expect(evidence[0]).toMatchObject({
			auditCount: 1,
			strictAssertionCompanion: true,
			reports: [
				expect.objectContaining({
					result: expect.objectContaining({
						incomplete: raw.result.incomplete,
						violations: raw.result.violations
					})
				}),
				expect.objectContaining({
					result: expect.objectContaining({ error: String(error) })
				})
			]
		});
		expect(ctx.parameters).toBe(original);
	});
});
