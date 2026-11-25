import {
	BlockReason,
	classifyRequest,
	findAllowlistCandidate,
	redactUrl,
	RequestPolicyConfig
} from './requestPolicy';

/**
 * Given what the browser REALLY sent during a practice run
 * (Playwright `page.on('request')`), list every write that is not on the
 * allowlist. It uses the same policy as the runtime guard, so the guard and
 * its independent check cannot drift apart. Plain data in, no Playwright or
 * app imports, so the spec and the unit tests can both load it.
 */

export interface RecordedNetworkRequest {
	method: string;
	url: string;
	/** Playwright `request.postData()`; null/undefined = not captured. */
	postData?: string | null;
}

/**
 * The body the runtime guard saw for a recorded request. Playwright reports
 * "no body" as null, which otherwise reads as "not captured". Only the
 * heartbeat, whose allowlist entry requires an empty body, is read as empty;
 * every other missing body stays uncaptured and is rejected.
 */
export const recordedBodyText = (
	request: RecordedNetworkRequest,
	config: RequestPolicyConfig
): string | undefined => {
	if (typeof request.postData === 'string') {
		return request.postData;
	}
	return findAllowlistCandidate(request.method, request.url, config) ===
		'livechat-heartbeat'
		? ''
		: undefined;
};

export interface PracticeWriteViolation {
	method: string;
	/** Origin + path only. */
	url: string;
	reason: BlockReason;
}

export const findPracticeWrites = (
	requests: readonly RecordedNetworkRequest[],
	config: RequestPolicyConfig
): PracticeWriteViolation[] => {
	const violations: PracticeWriteViolation[] = [];
	requests.forEach((request) => {
		const verdict = classifyRequest(
			{
				method: request.method,
				url: request.url,
				bodyText: recordedBodyText(request, config)
			},
			config
		);
		if (verdict.verdict === 'block') {
			violations.push({
				method: request.method.toUpperCase(),
				url: redactUrl(request.url),
				reason: verdict.reason
			});
		}
	});
	return violations;
};

/** Throws, naming every offending request (method and URL, never query or body). */
export const assertNoPracticeWrites = (
	requests: readonly RecordedNetworkRequest[],
	config: RequestPolicyConfig
): void => {
	const violations = findPracticeWrites(requests, config);
	if (violations.length > 0) {
		throw new Error(
			`Practice run sent ${violations.length} write(s) that are not on the allowlist:\n` +
				violations
					.map((v) => `  ${v.method} ${v.url} (${v.reason})`)
					.join('\n')
		);
	}
};
