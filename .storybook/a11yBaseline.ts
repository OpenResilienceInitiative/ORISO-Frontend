import type { CheckResult, NodeResult, RelatedNode, Result } from 'axe-core';
// Storybook 10.6.3's one automatic addon-a11y audit is read through its public
// reporting object. Mode reassignment in beforeEach is source-verified and
// version-pinned; the browser controls protect this lifecycle integration.
export interface A11yBaselineEntry {
	storyId: string;
	environment: string;
	owner: string;
	issue: string;
	expires: string;
	fingerprints: string[];
}

type AuditCheck = Pick<CheckResult, 'id' | 'impact'> & {
	message?: string;
	data?: unknown;
	relatedNodes?: RelatedNode[];
};
type AuditNode = Pick<NodeResult, 'target' | 'html' | 'impact'> & {
	any: AuditCheck[];
	all: AuditCheck[];
	none: AuditCheck[];
};
type AuditRule = Pick<Result, 'id' | 'impact'> & { nodes: AuditNode[] };
interface AuditResult {
	testEngine: { name: string; version: string };
	testEnvironment: { userAgent: string };
	violations: AuditRule[];
	passes: AuditRule[];
	incomplete: AuditRule[];
	inapplicable: AuditRule[];
}
interface RunContext {
	id: string;
	parameters: {
		a11y?: {
			disable?: boolean;
			test?: string;
			options?: unknown;
			config?: unknown;
			context?: unknown;
		};
		verification?: { a11yContext?: unknown };
		orisoSeed?: unknown;
		router?: unknown;
	};
	globals: { a11y?: { manual?: boolean }; ghostStories?: unknown };
	reporting: {
		reports: {
			type?: string;
			version?: number;
			result?: unknown;
			status?: string;
		}[];
	};
}
interface GateOptions {
	entries: A11yBaselineEntry[];
	environment: (context: RunContext) => string;
	styles: (target: NodeResult['target']) => unknown;
	today: () => string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	value !== null && typeof value === 'object' && !Array.isArray(value);
const isRelatedNode = (value: unknown): value is RelatedNode =>
	isRecord(value) &&
	typeof value.html === 'string' &&
	Array.isArray(value.target);
const isCheck = (value: unknown): value is AuditCheck =>
	isRecord(value) &&
	typeof value.id === 'string' &&
	typeof value.impact === 'string' &&
	(value.message === undefined || typeof value.message === 'string') &&
	(value.relatedNodes === undefined ||
		(Array.isArray(value.relatedNodes) &&
			value.relatedNodes.every(isRelatedNode)));
const isRule = (value: unknown): value is AuditRule =>
	isRecord(value) &&
	typeof value.id === 'string' &&
	Array.isArray(value.nodes) &&
	value.nodes.every(
		(node) =>
			isRecord(node) &&
			typeof node.html === 'string' &&
			Array.isArray(node.target) &&
			[node.any, node.all, node.none].every(
				(checks) => Array.isArray(checks) && checks.every(isCheck)
			)
	);
const isAuditResult = (value: unknown): value is AuditResult =>
	isRecord(value) &&
	!value.error &&
	isRecord(value.testEngine) &&
	value.testEngine.name === 'axe-core' &&
	value.testEngine.version === '4.7.0' &&
	isRecord(value.testEnvironment) &&
	typeof value.testEnvironment.userAgent === 'string' &&
	value.testEnvironment.userAgent.length > 0 &&
	[
		value.violations,
		value.passes,
		value.incomplete,
		value.inapplicable
	].every((rules) => Array.isArray(rules) && rules.every(isRule));

export const canonical = (value: unknown): string => {
	if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
	if (isRecord(value))
		return `{${Object.keys(value)
			.sort()
			.map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
			.join(',')}}`;
	return JSON.stringify(value) ?? 'undefined';
};

// 10.6.3 adds {error} after its strict toHaveNoViolations matcher throws.
// This is only a companion to the immediately preceding failed raw result.
const isStrictAssertionCompanion = (
	report: RunContext['reporting']['reports'][number],
	raw: AuditResult
) => {
	if (
		report.version !== 1 ||
		report.status !== 'failed' ||
		!isRecord(report.result) ||
		Object.keys(report.result).length !== 1
	)
		return false;
	const { error } = report.result;
	if (
		!(error instanceof Error) ||
		!isRecord(error) ||
		error.name !== 'Error' ||
		canonical(error.actual) !== canonical(raw.violations)
	)
		return false;
	const message = error.message
		.split(String.fromCharCode(27))
		.map((part) => part.replace(/^\[[0-9;]*m/, ''))
		.join('');
	return (
		message.startsWith(
			'expect(received).toHaveNoViolations(expected)\n\n'
		) &&
		raw.violations.every(
			(rule) =>
				message.includes(`(${rule.id})`) &&
				rule.nodes.every(
					(node) =>
						message.includes(
							`Expected the HTML found at $('${node.target.join(', ')}') to have no violations:`
						) && message.includes(node.html)
				)
		)
	);
};

export const fingerprintViolations = (
	result: { violations: AuditRule[] },
	styles: GateOptions['styles']
): string[] =>
	result.violations
		.flatMap((rule) =>
			rule.nodes.map((node) =>
				canonical({
					rule: rule.id,
					impact: rule.impact,
					target: node.target,
					html: node.html,
					nodeImpact: node.impact,
					styles: styles(node.target),
					checks: (['any', 'all', 'none'] as const).map((kind) => [
						kind,
						node[kind].map((check) => ({
							id: check.id,
							impact: check.impact,
							message: check.message,
							data: check.data,
							relatedNodes: (check.relatedNodes ?? []).map(
								(related) => ({
									target: related.target,
									html: related.html,
									styles: styles(related.target)
								})
							)
						}))
					])
				})
			)
		)
		.sort();

export const createA11yBaselineGate = ({
	entries,
	environment,
	styles,
	today
}: GateOptions) => {
	let active:
		| {
				context: RunContext;
				original: RunContext['parameters'];
				environment: string;
				entry?: A11yBaselineEntry;
				token: number;
		  }
		| undefined;
	let sequence = 0;
	const begin = (context: RunContext) => {
		if (active)
			throw new Error(
				'Accessibility audit overlapping active story runs'
			);
		if (
			!context.reporting ||
			context.reporting.reports.some((report) => report.type === 'a11y')
		)
			throw new Error(
				'Accessibility audit stale or missing reporting identity'
			);
		const original = context.parameters;
		const a11y = original.a11y ?? {};
		if (
			a11y.disable ||
			a11y.test === 'off' ||
			context.globals.a11y?.manual ||
			context.globals.ghostStories
		)
			throw new Error(
				'Accessibility audit disabled or manual: the normal gate requires an automatic audit'
			);
		const identity = environment(context);
		const matching = entries.filter(
			(entry) =>
				entry.storyId === context.id && entry.environment === identity
		);
		if (matching.length > 1)
			throw new Error('Accessibility audit duplicate approvals');
		const [entry] = matching;
		if (
			entry &&
			(!entry.owner ||
				!entry.issue ||
				!/^\d{4}-\d{2}-\d{2}$/.test(entry.expires) ||
				entry.expires < today())
		)
			throw new Error(
				'Accessibility audit approval expired or missing ownership'
			);
		sequence += 1;
		active = {
			context,
			original,
			environment: identity,
			entry,
			token: sequence
		};
		context.parameters = {
			...original,
			a11y: { ...a11y, test: entry ? 'todo' : 'error' }
		};
	};
	const finish = (record: (evidence: unknown) => void = () => undefined) => {
		if (!active)
			throw new Error(
				'Accessibility audit missing active story identity'
			);
		const run = active;
		active = undefined;
		try {
			const reports = run.context.reporting.reports.filter(
				(report) => report.type === 'a11y'
			);
			const valid = reports.filter(
				(report): report is typeof report & { result: AuditResult } =>
					isAuditResult(report.result)
			);
			const strictAssertionCompanion =
				reports.length === 2 &&
				valid.length === 1 &&
				reports[0] === valid[0] &&
				!run.entry &&
				valid[0].status === 'failed' &&
				valid[0].result.violations.length > 0 &&
				isStrictAssertionCompanion(reports[1], valid[0].result);
			let fingerprints: string[] | undefined;
			let observationFailure: { error: unknown } | undefined;
			let fingerprintObservationError:
				| { name: string; message: string }
				| undefined;
			try {
				if (valid.length === 1)
					fingerprints = fingerprintViolations(
						valid[0].result,
						styles
					);
			} catch (error) {
				observationFailure = { error };
				fingerprintObservationError = {
					name: error instanceof Error ? error.name : 'Error',
					message:
						error instanceof Error ? error.message : String(error)
				};
			}
			record({
				storyId: run.context.id,
				token: run.token,
				environment: run.environment,
				reports: reports.map((report) => {
					let { result } = report;
					if (isAuditResult(result)) {
						result = {
							...result,
							passes: result.passes.map((rule) => ({
								id: rule.id,
								nodeCount: rule.nodes.length
							})),
							inapplicable: result.inapplicable.map((rule) => ({
								id: rule.id
							}))
						};
					} else if (isRecord(result) && result.error) {
						result = {
							...result,
							error: String(result.error),
							errorDetails: isRecord(result.error)
								? {
										name: result.error.name,
										message: result.error.message,
										actual: result.error.actual
									}
								: undefined
						};
					}
					return { ...report, result };
				}),
				fingerprints,
				fingerprintObservationError,
				auditCount: valid.length,
				strictAssertionCompanion
			});
			if (observationFailure) throw observationFailure.error;
			if (
				(reports.length !== 1 && !strictAssertionCompanion) ||
				reports.some((report) => report.version !== 1)
			)
				throw new Error(
					`Accessibility audit requires exactly one fresh version1 raw report and only its pinned strict assertion companion; received ${reports.length} reports (${valid.length} valid raw)`
				);
			const { result, status } = reports[0];
			if (!isAuditResult(result))
				throw new Error(
					'Accessibility audit missing, malformed, failed, or unexpected engine version'
				);
			let expectedStatus = 'passed';
			if (result.violations.length)
				expectedStatus = run.entry ? 'warning' : 'failed';
			if (status !== expectedStatus)
				throw new Error(
					'Accessibility audit mode/report status does not match this story approval'
				);
			if (!fingerprints)
				throw new Error(
					'Accessibility audit missing violation fingerprint data'
				);
			const allowed = [...(run.entry?.fingerprints ?? [])];
			const unexpected = fingerprints.filter((fingerprint) => {
				const index = allowed.indexOf(fingerprint);
				if (index < 0) return true;
				allowed.splice(index, 1);
				return false;
			});
			if (unexpected.length)
				throw new Error(
					`Unapproved accessibility violation in ${run.context.id}: ${unexpected.join('\n')}`
				);
		} finally {
			run.context.parameters = run.original;
		}
	};
	return { begin, finish };
};
