/**
 * The practice area's write policy as pure functions, shared by the runtime
 * `NetworkGuard` and the Playwright proof (`assertNoPracticeWrites`). Keep it
 * free of app imports: the Playwright run loads this file outside the app.
 *
 * Default-deny: only GET/HEAD/OPTIONS pass; of everything else exactly two
 * requests are allowed (spec section 4, claim 1). Anything unparseable or
 * unreadable fails closed.
 */

export type AllowlistEntry = 'tutorial-progress' | 'token-refresh';

export type BlockReason = 'default-deny' | 'body-rejected' | 'unparseable-url';

export interface RequestPolicyConfig {
	/** Tour ids whose progress may be written: the running practice tour. */
	allowedTourIds: readonly string[];
	/** Absolute URL of `PUT /users/tutorials/progress`. */
	tutorialProgressUrl: string;
	/** Absolute URL of the identity provider's token endpoint. */
	tokenRefreshUrl: string;
}

export interface PolicyRequest {
	method: string;
	url: string;
	/** undefined = the body could not be read; the policy then fails closed. */
	bodyText?: string;
}

export type Verdict =
	| { verdict: 'pass' }
	| { verdict: 'allow'; entry: AllowlistEntry }
	| { verdict: 'block'; reason: BlockReason };

const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

/** Both allowed bodies are tiny; a larger one is not what the app sends. */
export const MAX_ALLOWLISTED_BODY_LENGTH = 16 * 1024;

export const isSafeMethod = (method: unknown): boolean =>
	typeof method === 'string' && SAFE_METHODS.includes(method.toUpperCase());

const currentBase = (): string | undefined =>
	typeof globalThis.location?.href === 'string'
		? globalThis.location.href
		: undefined;

const parseUrl = (raw: string, base = currentBase()): URL | null => {
	try {
		return new URL(raw, base);
	} catch (_error) {
		return null;
	}
};

export const isParseableUrl = (raw: unknown): boolean =>
	typeof raw === 'string' && parseUrl(raw) !== null;

/** Origin + path only: no query, fragment or credentials ever leave this file. */
export const redactUrl = (raw: string | undefined): string => {
	const url = typeof raw === 'string' ? parseUrl(raw) : null;
	return url ? url.origin + url.pathname : '[unparseable]';
};

// Exact: same origin and path, and no query or fragment on the request.
const isEndpoint = (candidate: URL, endpointUrl: string): boolean => {
	const endpoint = parseUrl(endpointUrl);
	return (
		endpoint !== null &&
		candidate.origin === endpoint.origin &&
		candidate.pathname === endpoint.pathname &&
		candidate.search === '' &&
		candidate.hash === ''
	);
};

/** Which allowlist entry a request could belong to, judged by method and URL. */
export const findAllowlistCandidate = (
	method: string,
	url: string,
	config: RequestPolicyConfig
): AllowlistEntry | null => {
	const parsed = parseUrl(url);
	if (!parsed) {
		return null;
	}
	const upper = method.toUpperCase();
	if (upper === 'PUT' && isEndpoint(parsed, config.tutorialProgressUrl)) {
		return 'tutorial-progress';
	}
	if (upper === 'POST' && isEndpoint(parsed, config.tokenRefreshUrl)) {
		return 'token-refresh';
	}
	return null;
};

const parseJsonObject = (text: string): Record<string, unknown> | null => {
	try {
		const value = JSON.parse(text);
		return value && typeof value === 'object' && !Array.isArray(value)
			? value
			: null;
	} catch (_error) {
		return null;
	}
};

const isTutorialProgressBody = (
	text: string,
	config: RequestPolicyConfig
): boolean => {
	const body = parseJsonObject(text);
	return (
		body !== null &&
		body.surface === 'frontend' &&
		typeof body.tourId === 'string' &&
		config.allowedTourIds.includes(body.tourId)
	);
};

// Only the refresh grant; the password grant shares the URL and must stay blocked.
const isTokenRefreshBody = (text: string): boolean => {
	const params = new URLSearchParams(text);
	const only = (name: string, value: string) => {
		const all = params.getAll(name);
		return all.length === 1 && all[0] === value;
	};
	return (
		only('grant_type', 'refresh_token') &&
		only('client_id', 'app') &&
		!params.has('username') &&
		!params.has('password')
	);
};

export const bodyMatchesAllowlistEntry = (
	entry: AllowlistEntry,
	bodyText: string | undefined,
	config: RequestPolicyConfig
): boolean => {
	if (
		typeof bodyText !== 'string' ||
		bodyText.length > MAX_ALLOWLISTED_BODY_LENGTH
	) {
		return false;
	}
	return entry === 'tutorial-progress'
		? isTutorialProgressBody(bodyText, config)
		: isTokenRefreshBody(bodyText);
};

export const classifyRequest = (
	request: PolicyRequest,
	config: RequestPolicyConfig
): Verdict => {
	if (isSafeMethod(request.method)) {
		return { verdict: 'pass' };
	}
	if (!parseUrl(request.url)) {
		return { verdict: 'block', reason: 'unparseable-url' };
	}
	const entry = findAllowlistCandidate(request.method, request.url, config);
	if (!entry) {
		return { verdict: 'block', reason: 'default-deny' };
	}
	return bodyMatchesAllowlistEntry(entry, request.bodyText, config)
		? { verdict: 'allow', entry }
		: { verdict: 'block', reason: 'body-rejected' };
};
