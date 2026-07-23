/**
 * Helpers for the react-router v5 → v7 migration.
 *
 * v7 dropped two v5 conveniences the route tables relied on:
 *   1. optional path params (`:id?`) — every combination must be an explicit route
 *   2. prefix matching by default — non-exact routes must opt in with a `/*` suffix
 *   3. an array `path` on a single `<Route>` — each entry becomes its own route
 *
 * These pure functions translate the existing `RouterConfig` route objects
 * (`{ path, exact? }`) into the explicit v7 path strings, and are unit-tested so
 * the route table can stay declarative without hand-expanding every variant.
 */

const isOptionalSegment = (segment: string): boolean =>
	segment.startsWith(':') && segment.endsWith('?');

const stripOptionalMarker = (segment: string): string =>
	isOptionalSegment(segment) ? segment.slice(0, -1) : segment;

/**
 * Expand a v5 path containing trailing optional params into the explicit v7
 * variants, most-specific first.
 *
 *   '/registration/:step?'                       → ['/registration/:step', '/registration']
 *   '/sessions/user/view/:rcGroupId?/:sessionId?' →
 *       ['/sessions/user/view/:rcGroupId/:sessionId',
 *        '/sessions/user/view/:rcGroupId',
 *        '/sessions/user/view']
 *
 * Only trailing optional runs are supported — every ORISO optional param is
 * trailing, and a non-optional segment after an optional one is positionally
 * impossible, so we throw rather than emit a malformed path.
 */
export function splitOptionalParams(path: string): string[] {
	const segments = path.split('/');
	const firstOptionalIdx = segments.findIndex(isOptionalSegment);
	if (firstOptionalIdx === -1) {
		return [path];
	}

	const head = segments.slice(0, firstOptionalIdx);
	const tail = segments.slice(firstOptionalIdx);
	if (!tail.every(isOptionalSegment)) {
		throw new Error(
			`splitOptionalParams: non-trailing optional param in "${path}" is unsupported`
		);
	}

	const variants: string[] = [];
	for (let keep = tail.length; keep >= 0; keep--) {
		const kept = [...head, ...tail.slice(0, keep).map(stripOptionalMarker)];
		variants.push(kept.join('/') || '/');
	}
	return variants;
}

/**
 * Apply v7 match semantics to a single (already optional-free) path:
 * exact routes are unchanged; non-exact routes get a `/*` splat so they keep
 * matching descendants the way v5 prefix matching did.
 */
export function toV7Path(path: string, exact: boolean): string {
	if (exact) {
		return path;
	}
	const base = path.replace(/\/$/, '');
	return base.endsWith('/*') ? base : `${base}/*`;
}

/**
 * Convert an absolute route path into one relative to a parent layout route
 * (e.g. inside a `<Route path="sessions/*">` the child `<Routes>` need paths
 * relative to `/sessions/`). Returns `'.'` for the index of the parent.
 *
 *   stripPrefix('/sessions/consultant/sessionView/session/:sessionId', '/sessions/')
 *     → 'consultant/sessionView/session/:sessionId'
 *   stripPrefix('/sessions/consultant/sessionView/', '/sessions/')
 *     → 'consultant/sessionView'
 */
export function stripPrefix(path: string, prefix: string): string {
	const prefixNoSlash = prefix.replace(/\/$/, '');
	if (path === prefixNoSlash) {
		return '.';
	}
	const rel = (path.startsWith(prefix) ? path.slice(prefix.length) : path)
		.replace(/\/$/, '')
		.replace(/^\//, '');
	return rel === '' ? '.' : rel;
}

/**
 * Full translation of a RouterConfig route object's `path` (string or array,
 * possibly with optional params and an `exact` flag) into the flat list of v7
 * path strings it should produce.
 */
export function toV7Paths(route: {
	path: string | string[];
	exact?: boolean;
}): string[] {
	const exact = route.exact ?? true;
	const paths = Array.isArray(route.path) ? route.path : [route.path];
	return paths
		.flatMap((p) => splitOptionalParams(p))
		.map((p) => toV7Path(p, exact));
}
