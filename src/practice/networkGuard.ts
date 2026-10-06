import {
	BlockReason,
	bodyMatchesAllowlistEntry,
	findAllowlistCandidate,
	isParseableUrl,
	isSafeMethod,
	MAX_ALLOWLISTED_BODY_LENGTH,
	redactUrl,
	RequestPolicyConfig
} from './requestPolicy';

/**
 * Default-deny wrapper for `fetch`, `XMLHttpRequest` and `navigator.sendBeacon`
 * for as long as a practice flow runs (spec section 4, claim 1). Only
 * GET/HEAD/OPTIONS pass; of everything else only two fetch requests are
 * allowed (see `requestPolicy.ts`). XHR and beacons never get an exception:
 * nothing the app sends on those channels is on the allowlist.
 *
 * Layering: install the guard FIRST. The fake REST backend (S2) goes on top
 * and answers practice endpoints from memory; whatever it does not answer
 * falls through to this guard. Uninstall in reverse order. If something else
 * still wraps the guard on uninstall, the guard stays in the chain as a
 * pass-through instead of clobbering the outer patch.
 *
 * WebSocket is deliberately NOT wrapped. The only sockets in the app are the
 * LiveService STOMP client, which only subscribes (the app never publishes a
 * frame) and Matrix events, which arrive via sync; blocking `new WebSocket`
 * would only break reads. Nothing can be proven by a send hook there, so the
 * claim is asserted from outside instead: the T2 end-to-end run records every
 * request with `page.on('request')` and `assertNoPracticeWrites` fails on any
 * non-allowlisted write that reaches the network.
 *
 * Not covered, by design of the platform: form-submit and link navigations,
 * `<img>`/CSS loads (all GET), code that kept a pre-install reference to
 * `fetch`, and anything that replaces `window.fetch` wholesale afterwards.
 */

export type GuardChannel = 'fetch' | 'xhr' | 'beacon';

/** Method and redacted URL only (no query, no body): safe to log and assert on. */
export interface RecordedRequest {
	method: string;
	url: string;
	channel: GuardChannel;
}

export interface BlockedRequest extends RecordedRequest {
	reason: BlockReason;
}

export interface NetworkGuardOptions extends RequestPolicyConfig {
	/** Called synchronously for every blocked request; errors in it are ignored. */
	onBlocked?: (request: BlockedRequest) => void;
}

export interface NetworkGuard {
	install(): void;
	uninstall(): void;
	readonly isInstalled: boolean;
	counter(): { blocked: number; allowed: number };
	readonly blockedRequests: readonly BlockedRequest[];
	readonly allowedRequests: readonly RecordedRequest[];
}

/**
 * Not a TypeError on purpose: the OTLP exporter retries network TypeErrors
 * with back-off, which would turn one blocked export into many.
 */
export class PracticeBlockedRequestError extends Error {
	readonly request: BlockedRequest;

	constructor(request: BlockedRequest) {
		super(`Practice mode blocked ${request.method} ${request.url}`);
		this.name = 'PracticeBlockedRequestError';
		this.request = request;
		Object.setPrototypeOf(this, PracticeBlockedRequestError.prototype);
	}
}

const MAX_RECORDED = 500;

type FetchInput = Parameters<typeof fetch>[0];
type FetchInit = Parameters<typeof fetch>[1];

const isRequestLike = (input: unknown): input is Request =>
	typeof input === 'object' &&
	input !== null &&
	typeof (input as Request).url === 'string' &&
	typeof (input as Request).clone === 'function';

const methodOf = (input: FetchInput, init?: FetchInit): string => {
	const raw =
		init?.method !== undefined
			? init.method
			: isRequestLike(input)
				? input.method
				: 'GET';
	return typeof raw === 'string' ? raw.toUpperCase() : String(raw);
};

const urlOf = (input: FetchInput): string | undefined => {
	if (typeof input === 'string') {
		return input;
	}
	if (isRequestLike(input)) {
		return input.url;
	}
	return typeof (input as URL)?.href === 'string'
		? (input as URL).href
		: undefined;
};

// undefined = could not be read safely (stream, form data, used request ...).
const readFetchBody = async (
	input: FetchInput,
	init?: FetchInit
): Promise<string | undefined> => {
	try {
		if (init?.body !== undefined && init.body !== null) {
			if (typeof init.body === 'string') {
				return init.body;
			}
			return init.body instanceof URLSearchParams
				? init.body.toString()
				: undefined;
		}
		if (isRequestLike(input)) {
			if (input.bodyUsed) {
				return undefined;
			}
			const text = await input.clone().text();
			return text.length <= MAX_ALLOWLISTED_BODY_LENGTH
				? text
				: undefined;
		}
		return undefined;
	} catch (_error) {
		return undefined;
	}
};

type AnyFunction = (...args: any[]) => any;

interface XhrMeta {
	method: string;
	url: string;
	async: boolean;
}

export const createNetworkGuard = (
	options: NetworkGuardOptions
): NetworkGuard => {
	const config: RequestPolicyConfig = {
		allowedTourIds: [...options.allowedTourIds],
		tutorialProgressUrl: options.tutorialProgressUrl,
		tokenRefreshUrl: options.tokenRefreshUrl
	};
	const blocked: BlockedRequest[] = [];
	const allowed: RecordedRequest[] = [];
	let blockedTotal = 0;
	let allowedTotal = 0;
	let active = false;
	let restore: (() => void) | null = null;

	const push = <T>(list: T[], entry: T) => {
		list.push(entry);
		if (list.length > MAX_RECORDED) {
			list.shift();
		}
	};

	const recordBlocked = (
		channel: GuardChannel,
		method: string,
		url: string | undefined,
		reason: BlockReason
	): BlockedRequest => {
		const request: BlockedRequest = {
			method,
			url: redactUrl(url),
			channel,
			reason
		};
		blockedTotal++;
		push(blocked, request);
		try {
			options.onBlocked?.(request);
		} catch (_error) {
			// A broken observer must not turn a blocked write into a crash.
		}
		return request;
	};

	const recordAllowed = (method: string, url: string) => {
		allowedTotal++;
		push(allowed, { method, url: redactUrl(url), channel: 'fetch' });
	};

	const install = () => {
		if (active) {
			return;
		}
		active = true;

		const originalFetch = globalThis.fetch;
		const guardedFetch = ((input: FetchInput, init?: FetchInit) => {
			if (!active) {
				return originalFetch.call(globalThis, input, init);
			}
			const method = methodOf(input, init);
			if (isSafeMethod(method)) {
				return originalFetch.call(globalThis, input, init);
			}
			const url = urlOf(input);
			const entry =
				url === undefined
					? null
					: findAllowlistCandidate(method, url, config);
			if (entry === null) {
				const reason = isParseableUrl(url)
					? 'default-deny'
					: 'unparseable-url';
				return Promise.reject(
					new PracticeBlockedRequestError(
						recordBlocked('fetch', method, url, reason)
					)
				);
			}
			return readFetchBody(input, init).then((bodyText) => {
				if (bodyMatchesAllowlistEntry(entry, bodyText, config)) {
					recordAllowed(method, url);
					return originalFetch.call(globalThis, input, init);
				}
				throw new PracticeBlockedRequestError(
					recordBlocked('fetch', method, url, 'body-rejected')
				);
			});
		}) as typeof fetch;
		globalThis.fetch = guardedFetch;

		const xhrProto =
			typeof XMLHttpRequest !== 'undefined'
				? XMLHttpRequest.prototype
				: undefined;
		const originalOpen = xhrProto?.open as AnyFunction;
		const originalSend = xhrProto?.send as AnyFunction;
		const xhrMeta = new WeakMap<XMLHttpRequest, XhrMeta>();
		const guardedOpen = function (
			this: XMLHttpRequest,
			method: string,
			url: string | URL,
			...rest: unknown[]
		) {
			xhrMeta.set(this, {
				method: String(method).toUpperCase(),
				url: String(url),
				async: rest[0] !== false
			});
			return originalOpen.apply(this, [method, url, ...rest]);
		};
		const guardedSend = function (this: XMLHttpRequest, body?: unknown) {
			if (!active) {
				return originalSend.call(this, body);
			}
			const meta = xhrMeta.get(this);
			// An XHR opened before install has no recorded method: fail closed.
			if (meta && isSafeMethod(meta.method)) {
				return originalSend.call(this, body);
			}
			const request = recordBlocked(
				'xhr',
				meta?.method ?? 'UNKNOWN',
				meta?.url,
				'default-deny'
			);
			if (meta && !meta.async) {
				throw new DOMException(
					new PracticeBlockedRequestError(request).message,
					'NetworkError'
				);
			}
			// Look like a network error: DONE with status 0, then the events.
			const xhr = this;
			setTimeout(() => {
				Object.defineProperty(xhr, 'readyState', {
					value: 4,
					configurable: true
				});
				Object.defineProperty(xhr, 'status', {
					value: 0,
					configurable: true
				});
				['readystatechange', 'error', 'loadend'].forEach((type) =>
					xhr.dispatchEvent(
						typeof ProgressEvent === 'function'
							? new ProgressEvent(type)
							: new Event(type)
					)
				);
			}, 0);
		};
		if (xhrProto) {
			xhrProto.open = guardedOpen as typeof xhrProto.open;
			xhrProto.send = guardedSend as typeof xhrProto.send;
		}

		const nav = typeof navigator !== 'undefined' ? navigator : undefined;
		const originalBeacon = nav?.sendBeacon;
		const beaconWasOwn =
			nav !== undefined &&
			Object.prototype.hasOwnProperty.call(nav, 'sendBeacon');
		const guardedBeacon = function (
			url: string | URL,
			data?: BodyInit | null
		) {
			if (!active) {
				return originalBeacon.call(nav, url, data);
			}
			recordBlocked('beacon', 'POST', String(url), 'default-deny');
			return false;
		};
		const defineBeacon = (value: unknown) =>
			Object.defineProperty(nav, 'sendBeacon', {
				value,
				configurable: true,
				writable: true
			});
		if (nav && typeof originalBeacon === 'function') {
			defineBeacon(guardedBeacon);
		}

		restore = () => {
			// Unwrap only what is still ours; an outer patch stays in charge.
			if (globalThis.fetch === guardedFetch) {
				globalThis.fetch = originalFetch;
			}
			if (xhrProto) {
				if (xhrProto.open === guardedOpen) {
					xhrProto.open = originalOpen as typeof xhrProto.open;
				}
				if (xhrProto.send === guardedSend) {
					xhrProto.send = originalSend as typeof xhrProto.send;
				}
			}
			if (nav && typeof originalBeacon === 'function') {
				if (nav.sendBeacon !== guardedBeacon) {
					return;
				}
				if (beaconWasOwn) {
					defineBeacon(originalBeacon);
				} else {
					delete (nav as { sendBeacon?: unknown }).sendBeacon;
				}
			}
		};
	};

	const uninstall = () => {
		if (!active) {
			return;
		}
		active = false;
		restore?.();
		restore = null;
	};

	return {
		install,
		uninstall,
		get isInstalled() {
			return active;
		},
		counter: () => ({ blocked: blockedTotal, allowed: allowedTotal }),
		get blockedRequests() {
			return blocked.slice();
		},
		get allowedRequests() {
			return allowed.slice();
		}
	};
};
