import {
	computeOrisoPalette,
	type OrisoSeeds,
	type OrisoSchemeName
} from '../../utils/theme/orisoScheme';

/** Declared mapping provenance, not a claim about a browser's winning rule. */
export interface TokenMappingSource {
	path: string;
	rule: string;
	declaration: string;
}

export interface AppliedTokenObservation {
	id: string;
	kind: 'colour' | 'typography' | 'spacing' | 'radius';
	token: string;
	property: string;
	expected: string | null;
	calculated: string | null;
	applied: string | null;
	elementFound: boolean;
	source: TokenMappingSource;
}

export type AppliedTokenStatus =
	| 'match'
	| 'mismatch'
	| 'missing'
	| 'unresolved';
export interface AppliedTokenResult extends AppliedTokenObservation {
	status: AppliedTokenStatus;
	issues: string[];
}

/** Compare browser-normalized observations without manufacturing missing data. */
export const evaluateAppliedToken = (
	observation: AppliedTokenObservation
): AppliedTokenResult => {
	const result = (
		status: AppliedTokenStatus,
		issues: string[]
	): AppliedTokenResult => ({
		...observation,
		status,
		issues
	});
	if (!observation.elementFound)
		return result('missing', ['missing-element']);
	if (!observation.expected?.trim())
		return result('unresolved', ['missing-expected']);
	if (!observation.calculated?.trim())
		return result('missing', ['missing-token']);
	if (/var\s*\(/i.test(observation.calculated))
		return result('unresolved', ['unresolved-token']);
	if (!observation.applied?.trim())
		return result('missing', ['missing-applied']);
	const issues: string[] = [];
	if (observation.calculated !== observation.expected)
		issues.push('calculated-mismatch');
	if (observation.applied !== observation.expected)
		issues.push('applied-mismatch');
	return result(issues.length ? 'mismatch' : 'match', issues);
};

export interface AppliedTokenMapping {
	id: string;
	selector: string;
	property: string;
	token: string;
	kind: AppliedTokenObservation['kind'];
	source: TokenMappingSource;
}

export interface AppliedTokenInspection extends AppliedTokenResult {
	selector: string;
	targetIndex: number | null;
	raw: {
		expected: string | null;
		calculated: string | null;
		applied: string | null;
		rootToken: string;
	};
}

/** Resolve CSS syntax using the owning browser, not a second colour parser. */
const normalizedProperty = (
	document: Document,
	property: string,
	value: string | null
): string | null => {
	if (!value?.trim()) return null;
	// Unresolved expressions must not turn into the probe's inherited fallback.
	if (/var\s*\(/i.test(value)) return value.trim();
	const view = document.defaultView;
	if (!view)
		throw new Error('Applied-token inspection requires a live document');
	if (!view.CSS.supports(property, value)) return null;
	const probe = document.createElement('span');
	probe.hidden = true;
	probe.style.setProperty(property, value, 'important');
	document.body.appendChild(probe);
	try {
		return (
			view.getComputedStyle(probe).getPropertyValue(property).trim() ||
			null
		);
	} finally {
		probe.remove();
	}
};

/**
 * Read the real component and its inherited token under the installed provider.
 * This first slice supports engine colour roles; an unknown/noncolour expected
 * role stays unresolved until its independent source contract is supplied.
 */
export const inspectAppliedTokens = ({
	root,
	seeds,
	scheme,
	mappings
}: {
	root: HTMLElement;
	seeds: OrisoSeeds;
	scheme: OrisoSchemeName;
	mappings: readonly AppliedTokenMapping[];
}): AppliedTokenInspection[] => {
	const document = root.ownerDocument;
	const view = document.defaultView;
	if (!view || !root.isConnected)
		throw new Error('Applied-token inspection requires a connected canvas');
	const { tokens } = computeOrisoPalette(seeds, scheme);
	return mappings.flatMap((mapping) => {
		const targets = Array.from(root.querySelectorAll(mapping.selector));
		const expectedRaw =
			mapping.kind === 'colour' ? (tokens[mapping.token] ?? null) : null;
		const expected = normalizedProperty(
			document,
			mapping.property,
			expectedRaw
		);
		const rootToken = view
			.getComputedStyle(document.documentElement)
			.getPropertyValue(mapping.token)
			.trim();
		const inspectTarget = (
			target: Element | null,
			index: number | null
		): AppliedTokenInspection => {
			const style = target ? view.getComputedStyle(target) : null;
			const calculatedRaw =
				style?.getPropertyValue(mapping.token).trim() || null;
			const appliedRaw =
				style?.getPropertyValue(mapping.property).trim() || null;
			return {
				...evaluateAppliedToken({
					id: mapping.id,
					kind: mapping.kind,
					token: mapping.token,
					property: mapping.property,
					source: mapping.source,
					expected,
					calculated: normalizedProperty(
						document,
						mapping.property,
						calculatedRaw
					),
					applied: appliedRaw,
					elementFound: target !== null
				}),
				selector: mapping.selector,
				targetIndex: index,
				raw: {
					expected: expectedRaw,
					calculated: calculatedRaw,
					applied: appliedRaw,
					rootToken
				}
			};
		};
		return targets.length
			? targets.map(inspectTarget)
			: [inspectTarget(null, null)];
	});
};
