import { describe, expect, it } from 'vite-plus/test';
import {
	createA11yBaselineGate,
	fingerprintViolations
} from '../../.storybook/a11yBaseline';

const violation = (color = '#aaa', target = '#contrast') => ({
	id: 'color-contrast',
	impact: 'serious' as const,
	nodes: [
		{
			target: [target],
			html: '<p id="contrast">Same DOM</p>',
			impact: 'serious' as const,
			any: [
				{
					id: 'color-contrast',
					impact: 'serious' as const,
					data: {
						fgColor: color,
						bgColor: '#fff',
						contrastRatio: 2.3,
						expectedContrastRatio: 4.5
					},
					relatedNodes: []
				}
			],
			all: [],
			none: []
		}
	]
});
const result = (
	violations: ReturnType<typeof violation>[] = [violation()]
) => ({
	testEngine: { name: 'axe-core', version: '4.7.0' },
	testEnvironment: { userAgent: 'controlled-browser' },
	violations,
	passes: [],
	incomplete: [],
	inapplicable: []
});
const context = (id = 'known') => ({
	id,
	parameters: { a11y: { test: 'error', options: { runOnly: ['wcag2aa'] } } },
	globals: {},
	reporting: {
		reports: [] as {
			type?: string;
			version?: number;
			result?: unknown;
			status?: string;
		}[]
	}
});
const baseline = () => ({
	storyId: 'known',
	environment: 'controlled',
	owner: 'Storypapst',
	issue: 'https://github.com/OpenResilienceInitiative/ORISO-Frontend/issues/1338',
	expires: '2026-11-20',
	fingerprints: fingerprintViolations(result(), () => [])
});
const gate = (entries = [baseline()], styles = () => [] as object[]) =>
	createA11yBaselineGate({
		entries,
		environment: () => 'controlled',
		styles,
		today: () => '2026-10-20'
	});
const report = (ctx: ReturnType<typeof context>, value = result()) => {
	let status = 'passed';
	if (value.violations.length)
		status = ctx.parameters.a11y.test === 'todo' ? 'warning' : 'failed';
	return ctx.reporting.reports.push({
		type: 'a11y',
		version: 1,
		status,
		result: value
	});
};

describe('single-audit accessibility baseline gate', () => {
	it('accepts only an unchanged approved audit, cloning and restoring parameters', () => {
		const ctx = context();
		const original = ctx.parameters;
		const { a11y } = original;
		const bridge = gate();
		bridge.begin(ctx);
		expect(ctx.parameters.a11y.test).toBe('todo');
		expect(ctx.parameters).not.toBe(original);
		expect(ctx.parameters.a11y).not.toBe(a11y);
		report(ctx);
		bridge.finish();
		expect(ctx.parameters).toBe(original);
		expect(a11y.test).toBe('error');
	});
	it('rejects a new rule/node or increased multiplicity in an already baselined story', () => {
		const ctx = context();
		const bridge = gate();
		bridge.begin(ctx);
		report(ctx, result([violation(), violation('#aaa', '#second')]));
		expect(() => bridge.finish()).toThrow(
			'Unapproved accessibility violation'
		);
	});
	it('rejects unchanged HTML with worsened check colors even when axe truncates the same ratio', () => {
		const ctx = context();
		const bridge = gate();
		bridge.begin(ctx);
		report(ctx, result([violation('#bbb')]));
		expect(() => bridge.finish()).toThrow(
			'Unapproved accessibility violation'
		);
	});
	it('rejects a stylesheet-only opacity regression with identical DOM and axe check data', () => {
		const ctx = context();
		const bridge = gate([baseline()], () => [{ opacity: '0.4' }]);
		bridge.begin(ctx);
		report(ctx);
		expect(() => bridge.finish()).toThrow(
			'Unapproved accessibility violation'
		);
	});
	it('keeps an unknown story strict despite an imported todo annotation', () => {
		const ctx = context('new');
		ctx.parameters.a11y.test = 'todo';
		const bridge = gate();
		bridge.begin(ctx);
		expect(ctx.parameters.a11y.test).toBe('error');
		report(ctx);
		expect(() => bridge.finish()).toThrow(
			'Unapproved accessibility violation'
		);
	});
	it.each(['missing', 'duplicate', 'error', 'engine', 'malformed'])(
		'fails closed for a %s report',
		(kind) => {
			const ctx = context();
			const bridge = gate();
			bridge.begin(ctx);
			if (kind === 'duplicate') {
				report(ctx);
				report(ctx);
			}
			if (kind === 'error')
				ctx.reporting.reports.push({
					type: 'a11y',
					version: 1,
					result: { error: 'audit aborted' }
				});
			if (kind === 'engine') {
				const value = result();
				value.testEngine.version = '0.0.0';
				report(ctx, value);
			}
			if (kind === 'malformed')
				ctx.reporting.reports.push({
					type: 'a11y',
					version: 1,
					result: {}
				});
			expect(() => bridge.finish()).toThrow('Accessibility audit');
		}
	);
	it('retains audit error evidence while rejecting the failed report', () => {
		const ctx = context();
		const bridge = gate();
		bridge.begin(ctx);
		ctx.reporting.reports.push({
			type: 'a11y',
			version: 1,
			result: { error: new Error('real audit failure') }
		});
		const evidence: unknown[] = [];
		expect(() => bridge.finish((value) => evidence.push(value))).toThrow(
			'Accessibility audit'
		);
		expect(evidence).toEqual([
			expect.objectContaining({
				reports: [
					expect.objectContaining({
						result: expect.objectContaining({
							error: 'Error: real audit failure'
						})
					})
				]
			})
		]);
	});
	it('rejects stale reports, overlapping runs, and a finish without an active identity', () => {
		const ctx = context();
		report(ctx);
		const bridge = gate();
		expect(() => bridge.begin(ctx)).toThrow('stale');
		const next = context();
		bridge.begin(next);
		expect(() => bridge.begin(context())).toThrow('overlapping');
		report(next);
		bridge.finish();
		expect(() => bridge.finish()).toThrow('active');
	});
	it('keeps A → B → A runs isolated and permits pruning resolved violations', () => {
		const bridge = gate();
		['known', 'healthy', 'known'].forEach((id) => {
			const ctx = context(id);
			bridge.begin(ctx);
			report(ctx, result([]));
			bridge.finish();
		});
	});
	it('rejects expired approvals and an unapproved environment', () => {
		const entry = baseline();
		entry.expires = '2026-10-19';
		const ctx = context();
		const bridge = gate([entry]);
		expect(() => bridge.begin(ctx)).toThrow('expired');
		const other = createA11yBaselineGate({
			entries: [baseline()],
			environment: () => 'new viewport',
			styles: () => [],
			today: () => '2026-10-20'
		});
		other.begin(ctx);
		expect(ctx.parameters.a11y.test).toBe('error');
		report(ctx);
		expect(() => other.finish()).toThrow(
			'Unapproved accessibility violation'
		);
	});
	it('evaluates one real raw violation plus its pinned strict matcher assertion without calling it a second audit', () => {
		const ctx = context('new');
		const bridge = gate();
		bridge.begin(ctx);
		const raw = result();
		report(ctx, raw);
		const error = Object.assign(
			new Error(
				`expect(received).toHaveNoViolations(expected)\n\nExpected the HTML found at $('#contrast') to have no violations:\n\n${raw.violations[0].nodes[0].html}\n\nReceived: (color-contrast)`
			),
			{ actual: raw.violations }
		);
		ctx.reporting.reports.push({
			type: 'a11y',
			version: 1,
			status: 'failed',
			result: { error }
		});
		const evidence: unknown[] = [];
		expect(() => bridge.finish((value) => evidence.push(value))).toThrow(
			'Unapproved accessibility violation'
		);
		expect(evidence[0]).toMatchObject({
			auditCount: 1,
			strictAssertionCompanion: true,
			reports: [
				expect.objectContaining({
					result: expect.objectContaining({
						violations: raw.violations
					})
				}),
				expect.objectContaining({
					result: expect.objectContaining({ error: String(error) })
				})
			],
			fingerprints: fingerprintViolations(raw, () => [])
		});
	});
	it.each([
		'other-error',
		'mismatched-actual',
		'wrong-status',
		'wrong-version',
		'extra-report',
		'reversed',
		'resolved-raw'
	])('rejects a false strict assertion companion: %s', (kind) => {
		const ctx = context('new');
		const bridge = gate();
		bridge.begin(ctx);
		const raw = result();
		const error = Object.assign(
			new Error(
				`expect(received).toHaveNoViolations(expected)\n\nExpected the HTML found at $('#contrast') to have no violations:\n\n${raw.violations[0].nodes[0].html}\n\nReceived: (color-contrast)`
			),
			{ actual: raw.violations }
		);
		if (kind === 'other-error') error.message = 'arbitrary second error';
		if (kind === 'mismatched-actual') error.actual = [violation('#bbb')];
		if (kind === 'resolved-raw') raw.violations = [];
		report(ctx, raw);
		ctx.reporting.reports.push({
			type: 'a11y',
			version: kind === 'wrong-version' ? 2 : 1,
			status: kind === 'wrong-status' ? 'warning' : 'failed',
			result: { error }
		});
		if (kind === 'extra-report')
			ctx.reporting.reports.push({ ...ctx.reporting.reports[1] });
		if (kind === 'reversed') ctx.reporting.reports.reverse();
		expect(() => bridge.finish()).toThrow(
			'Accessibility audit requires exactly one'
		);
	});
	it.each([false, true])(
		'retains raw audit evidence when style observation throws (strict companion=%s)',
		(companion) => {
			const ctx = context('new');
			const bridge = gate([], () => {
				throw new Error('controlled-style-observation-error');
			});
			bridge.begin(ctx);
			const raw = result();
			report(ctx, raw);
			if (companion) {
				const error = Object.assign(
					new Error(
						`expect(received).toHaveNoViolations(expected)\n\nExpected the HTML found at $('#contrast') to have no violations:\n\n${raw.violations[0].nodes[0].html}\n\nReceived: (color-contrast)`
					),
					{ actual: raw.violations }
				);
				ctx.reporting.reports.push({
					type: 'a11y',
					version: 1,
					status: 'failed',
					result: { error }
				});
			}
			const evidence: unknown[] = [];
			expect(() =>
				bridge.finish((value) => evidence.push(value))
			).toThrow('controlled-style-observation-error');
			expect(evidence).toHaveLength(1);
			expect(evidence[0]).toMatchObject({
				storyId: 'new',
				environment: 'controlled',
				auditCount: 1,
				strictAssertionCompanion: companion,
				fingerprintObservationError: {
					message: 'controlled-style-observation-error'
				},
				reports: [
					expect.objectContaining({
						result: expect.objectContaining({
							testEngine: raw.testEngine,
							testEnvironment: raw.testEnvironment,
							violations: raw.violations
						})
					}),
					...(companion
						? [
								expect.objectContaining({
									result: expect.objectContaining({
										error: expect.stringContaining(
											'toHaveNoViolations'
										)
									})
								})
							]
						: [])
				]
			});
		}
	);
});
