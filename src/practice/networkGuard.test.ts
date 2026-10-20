// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	BlockedRequest,
	createNetworkGuard,
	NetworkGuard,
	PracticeBlockedRequestError
} from './networkGuard';

const USER_SERVICE = 'https://api.test.local';
const TUTORIAL_PROGRESS_URL = `${USER_SERVICE}/service/users/tutorials/progress`;
const TOKEN_URL =
	'https://auth.test.local/auth/realms/online-beratung/protocol/openid-connect/token';
const TOUR_ID = 'consultant-practice-accept';

const baseOptions = () => ({
	allowedTourIds: [TOUR_ID],
	tutorialProgressUrl: TUTORIAL_PROGRESS_URL,
	tokenRefreshUrl: TOKEN_URL
});

const progressBody = (overrides: Record<string, unknown> = {}) =>
	JSON.stringify({
		surface: 'frontend',
		tourId: TOUR_ID,
		tourVersion: 1,
		status: 'in_progress',
		currentStepId: 'enquiry-list',
		...overrides
	});

const refreshBody =
	'refresh_token=abc.def.ghi&client_id=app&grant_type=refresh_token';

describe('NetworkGuard (default-deny for every non-GET request)', () => {
	let realFetch: ReturnType<typeof vi.fn>;
	let originalFetch: typeof globalThis.fetch;
	let guard: NetworkGuard;

	beforeEach(() => {
		originalFetch = globalThis.fetch;
		realFetch = vi.fn(async () => new Response('{}', { status: 200 }));
		globalThis.fetch = realFetch as unknown as typeof fetch;
		guard = createNetworkGuard(baseOptions());
	});

	afterEach(() => {
		guard.uninstall();
		globalThis.fetch = originalFetch;
	});

	describe('fetch', () => {
		it.each(['POST', 'PUT', 'PATCH', 'DELETE'])(
			'blocks a %s, never reaches the network and counts it',
			async (method) => {
				guard.install();

				await expect(
					globalThis.fetch(
						`${USER_SERVICE}/service/users/sessions/42`,
						{ method, body: '{"secret":"do-not-record"}' }
					)
				).rejects.toBeInstanceOf(PracticeBlockedRequestError);

				expect(realFetch).not.toHaveBeenCalled();
				expect(guard.counter()).toEqual({ blocked: 1, allowed: 0 });
				expect(guard.blockedRequests).toEqual([
					{
						method,
						url: `${USER_SERVICE}/service/users/sessions/42`,
						channel: 'fetch',
						reason: 'default-deny'
					}
				]);
				expect(JSON.stringify(guard.blockedRequests)).not.toContain(
					'do-not-record'
				);
			}
		);

		it.each(['GET', 'HEAD', 'OPTIONS', 'get'])(
			'lets a %s through untouched and does not count it',
			async (method) => {
				guard.install();
				const init = {
					method,
					headers: { Accept: 'application/json' }
				};

				const response = await globalThis.fetch(
					`${USER_SERVICE}/service/users/sessions`,
					init
				);

				expect(response.status).toBe(200);
				expect(realFetch).toHaveBeenCalledWith(
					`${USER_SERVICE}/service/users/sessions`,
					init
				);
				expect(guard.counter()).toEqual({ blocked: 0, allowed: 0 });
			}
		);

		it('treats a request without a method as GET', async () => {
			guard.install();
			await globalThis.fetch(`${USER_SERVICE}/service/users/sessions`);
			expect(realFetch).toHaveBeenCalledTimes(1);
			expect(guard.counter().blocked).toBe(0);
		});

		it.each(['post', 'patch', 'TRACE', 'CUSTOM'])(
			'blocks the method %s (anything that is not GET, HEAD or OPTIONS)',
			async (method) => {
				guard.install();
				await expect(
					globalThis.fetch(`${USER_SERVICE}/x`, { method })
				).rejects.toBeInstanceOf(PracticeBlockedRequestError);
				expect(realFetch).not.toHaveBeenCalled();
			}
		);

		it('reads the method of a Request object, and lets init.method win', async () => {
			guard.install();
			const post = new Request(`${USER_SERVICE}/x`, {
				method: 'POST',
				body: 'x'
			});

			await expect(globalThis.fetch(post)).rejects.toBeInstanceOf(
				PracticeBlockedRequestError
			);
			await expect(
				globalThis.fetch(new Request(`${USER_SERVICE}/x`), {
					method: 'DELETE'
				})
			).rejects.toBeInstanceOf(PracticeBlockedRequestError);
			expect(realFetch).not.toHaveBeenCalled();

			await globalThis.fetch(post, { method: 'GET' });
			expect(realFetch).toHaveBeenCalledTimes(1);
		});

		it('blocks a write whose URL cannot be parsed or read (fail closed)', async () => {
			guard.install();

			await expect(
				globalThis.fetch('http://', { method: 'POST' })
			).rejects.toBeInstanceOf(PracticeBlockedRequestError);
			await expect(
				globalThis.fetch({} as unknown as string, { method: 'POST' })
			).rejects.toBeInstanceOf(PracticeBlockedRequestError);

			expect(realFetch).not.toHaveBeenCalled();
			expect(guard.blockedRequests.map((r) => r.reason)).toEqual([
				'unparseable-url',
				'unparseable-url'
			]);
		});

		it('rejects with a plain Error, not a TypeError (the OTLP exporter retries those)', async () => {
			guard.install();
			const error = await globalThis
				.fetch(`${USER_SERVICE}/x`, { method: 'POST' })
				.catch((e) => e);
			expect(error).toBeInstanceOf(PracticeBlockedRequestError);
			expect(error).toBeInstanceOf(Error);
			expect(error).not.toBeInstanceOf(TypeError);
			expect(error.name).toBe('PracticeBlockedRequestError');
		});
	});

	describe('allowlist (a): tutorial progress of the running practice tour', () => {
		const put = (body: unknown, url = TUTORIAL_PROGRESS_URL) =>
			globalThis.fetch(url, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: body as string
			});

		it('lets the PUT through when it carries exactly the running tour id', async () => {
			guard.install();

			await put(progressBody());

			expect(realFetch).toHaveBeenCalledTimes(1);
			expect(guard.counter()).toEqual({ blocked: 0, allowed: 1 });
			expect(guard.allowedRequests).toEqual([
				{ method: 'PUT', url: TUTORIAL_PROGRESS_URL, channel: 'fetch' }
			]);
		});

		it.each([
			[
				'another tour id',
				progressBody({ tourId: 'consultant-walkthrough' })
			],
			[
				'a tour id that only starts like it',
				progressBody({ tourId: `${TOUR_ID}-x` })
			],
			['no tour id', progressBody({ tourId: undefined })],
			['a non-string tour id', progressBody({ tourId: [TOUR_ID] })],
			['the admin surface', progressBody({ surface: 'admin' })],
			['no surface', progressBody({ surface: undefined })],
			['a body that is not JSON', 'tourId=consultant-practice-accept'],
			['a JSON array', JSON.stringify([{ tourId: TOUR_ID }])],
			['JSON null', 'null'],
			['an empty body', ''],
			[
				'a body that is far too large',
				progressBody({ pad: 'x'.repeat(20_000) })
			]
		])('blocks the PUT with %s', async (_label, body) => {
			guard.install();

			await expect(put(body)).rejects.toBeInstanceOf(
				PracticeBlockedRequestError
			);

			expect(realFetch).not.toHaveBeenCalled();
			expect(guard.blockedRequests[0].reason).toBe('body-rejected');
		});

		it.each([
			['a body that cannot be read (Blob)', new Blob([progressBody()])],
			['a body that cannot be read (FormData)', new FormData()],
			['a missing body', undefined]
		])('fails closed on %s', async (_label, body) => {
			guard.install();
			await expect(put(body)).rejects.toBeInstanceOf(
				PracticeBlockedRequestError
			);
			expect(realFetch).not.toHaveBeenCalled();
		});

		it.each([
			['POST instead of PUT', 'POST', TUTORIAL_PROGRESS_URL],
			['PATCH instead of PUT', 'PATCH', TUTORIAL_PROGRESS_URL],
			['DELETE instead of PUT', 'DELETE', TUTORIAL_PROGRESS_URL],
			[
				'a query string',
				'PUT',
				`${TUTORIAL_PROGRESS_URL}?surface=frontend`
			],
			['a fragment', 'PUT', `${TUTORIAL_PROGRESS_URL}#x`],
			['a trailing slash', 'PUT', `${TUTORIAL_PROGRESS_URL}/`],
			['a sub path', 'PUT', `${TUTORIAL_PROGRESS_URL}/other`],
			[
				'another host',
				'PUT',
				'https://evil.test.local/service/users/tutorials/progress'
			]
		])('blocks %s even with a valid body', async (_label, method, url) => {
			guard.install();
			await expect(
				globalThis.fetch(url, { method, body: progressBody() })
			).rejects.toBeInstanceOf(PracticeBlockedRequestError);
			expect(realFetch).not.toHaveBeenCalled();
		});

		it('reads the body of a Request object without consuming it', async () => {
			guard.install();
			const request = new Request(TUTORIAL_PROGRESS_URL, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: progressBody()
			});

			await globalThis.fetch(request);

			expect(realFetch).toHaveBeenCalledWith(request, undefined);
			expect(request.bodyUsed).toBe(false);
			expect(guard.counter().allowed).toBe(1);
		});

		it('blocks a Request with another tour id, and one whose body was already consumed', async () => {
			guard.install();
			const wrongTour = new Request(TUTORIAL_PROGRESS_URL, {
				method: 'PUT',
				body: progressBody({ tourId: 'consultant-walkthrough' })
			});
			const consumed = new Request(TUTORIAL_PROGRESS_URL, {
				method: 'PUT',
				body: progressBody()
			});
			await consumed.text();

			await expect(globalThis.fetch(wrongTour)).rejects.toBeInstanceOf(
				PracticeBlockedRequestError
			);
			await expect(globalThis.fetch(consumed)).rejects.toBeInstanceOf(
				PracticeBlockedRequestError
			);
			expect(realFetch).not.toHaveBeenCalled();
		});

		it('allows several tour ids when configured with them, and none otherwise', async () => {
			guard = createNetworkGuard({
				...baseOptions(),
				allowedTourIds: ['a', 'b']
			});
			guard.install();
			await put(progressBody({ tourId: 'a' }));
			await put(progressBody({ tourId: 'b' }));
			await expect(put(progressBody())).rejects.toBeInstanceOf(
				PracticeBlockedRequestError
			);

			guard.uninstall();
			guard = createNetworkGuard({
				...baseOptions(),
				allowedTourIds: []
			});
			guard.install();
			await expect(put(progressBody())).rejects.toBeInstanceOf(
				PracticeBlockedRequestError
			);
		});
	});

	describe('changing the running tour while installed', () => {
		it('swaps the allowed tour ids without touching the fetch chain', async () => {
			guard.install();
			const wrapped = globalThis.fetch;
			const put = (tourId: string) =>
				globalThis.fetch(TUTORIAL_PROGRESS_URL, {
					method: 'PUT',
					body: progressBody({ tourId })
				});
			await put(TOUR_ID);

			guard.setAllowedTourIds(['consultant-practice-supervision']);

			await expect(put(TOUR_ID)).rejects.toBeInstanceOf(
				PracticeBlockedRequestError
			);
			await put('consultant-practice-supervision');
			expect(globalThis.fetch).toBe(wrapped);
		});
	});

	describe('allowlist (b): identity-provider token refresh', () => {
		const post = (body: string, url = TOKEN_URL) =>
			globalThis.fetch(url, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded'
				},
				body
			});

		it('lets the refresh grant through', async () => {
			guard.install();

			await post(refreshBody);

			expect(realFetch).toHaveBeenCalledTimes(1);
			expect(guard.counter()).toEqual({ blocked: 0, allowed: 1 });
		});

		it('lets the refresh grant through as a Request object (as the app sends it)', async () => {
			guard.install();
			const request = new Request(TOKEN_URL, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded'
				},
				body: refreshBody
			});

			await globalThis.fetch(request);

			expect(realFetch).toHaveBeenCalledTimes(1);
			expect(request.bodyUsed).toBe(false);
		});

		it.each([
			[
				'the password grant',
				'username=a&password=b&client_id=app&grant_type=password'
			],
			[
				'a refresh grant that also carries credentials',
				`${refreshBody}&password=b`
			],
			[
				'a refresh grant that also carries a username',
				`${refreshBody}&username=a`
			],
			['two grant types', `${refreshBody}&grant_type=password`],
			[
				'another client',
				'refresh_token=x&client_id=admin&grant_type=refresh_token'
			],
			['a body without grant', 'refresh_token=x&client_id=app'],
			['an empty body', '']
		])('blocks %s on the same URL', async (_label, body) => {
			guard.install();
			await expect(post(body)).rejects.toBeInstanceOf(
				PracticeBlockedRequestError
			);
			expect(realFetch).not.toHaveBeenCalled();
		});

		it('blocks a refresh-looking POST to any other URL', async () => {
			guard.install();
			await expect(
				post(refreshBody, `${USER_SERVICE}/service/users/data`)
			).rejects.toBeInstanceOf(PracticeBlockedRequestError);
			await expect(
				post(refreshBody, `${TOKEN_URL}?x=1`)
			).rejects.toBeInstanceOf(PracticeBlockedRequestError);
			expect(realFetch).not.toHaveBeenCalled();
		});

		it('blocks a PUT with the refresh grant (method must match too)', async () => {
			guard.install();
			await expect(
				globalThis.fetch(TOKEN_URL, {
					method: 'PUT',
					body: refreshBody
				})
			).rejects.toBeInstanceOf(PracticeBlockedRequestError);
		});
	});

	describe('XMLHttpRequest', () => {
		let originalOpen: typeof XMLHttpRequest.prototype.open;
		let originalSend: typeof XMLHttpRequest.prototype.send;
		let openSpy: ReturnType<typeof vi.fn>;
		let sendSpy: ReturnType<typeof vi.fn>;

		beforeEach(() => {
			originalOpen = XMLHttpRequest.prototype.open;
			originalSend = XMLHttpRequest.prototype.send;
			openSpy = vi.fn();
			sendSpy = vi.fn();
			XMLHttpRequest.prototype.open =
				openSpy as unknown as typeof originalOpen;
			XMLHttpRequest.prototype.send =
				sendSpy as unknown as typeof originalSend;
		});

		afterEach(() => {
			guard.uninstall();
			XMLHttpRequest.prototype.open = originalOpen;
			XMLHttpRequest.prototype.send = originalSend;
		});

		it('passes a GET through to the real open and send', () => {
			guard.install();
			const xhr = new XMLHttpRequest();

			xhr.open('GET', `${USER_SERVICE}/x`, true);
			xhr.send();

			expect(openSpy).toHaveBeenCalledWith(
				'GET',
				`${USER_SERVICE}/x`,
				true
			);
			expect(sendSpy).toHaveBeenCalledTimes(1);
			expect(guard.counter().blocked).toBe(0);
		});

		it('blocks a POST: never sends, ends as a network error and counts it', async () => {
			guard.install();
			const xhr = new XMLHttpRequest();
			const events: string[] = [];
			xhr.onerror = () => events.push('error');
			xhr.onloadend = () => events.push('loadend');
			xhr.onreadystatechange = () =>
				events.push(`state${xhr.readyState}`);

			xhr.open('POST', `${USER_SERVICE}/upload?token=secret`);
			xhr.send('payload');
			await new Promise((resolve) => setTimeout(resolve, 5));

			expect(sendSpy).not.toHaveBeenCalled();
			expect(events).toEqual(['state4', 'error', 'loadend']);
			expect(xhr.status).toBe(0);
			expect(guard.blockedRequests).toEqual([
				{
					method: 'POST',
					url: `${USER_SERVICE}/upload`,
					channel: 'xhr',
					reason: 'default-deny'
				}
			]);
		});

		it('gives XHR no allowlist: even the tutorial-progress PUT is blocked', async () => {
			guard.install();
			const xhr = new XMLHttpRequest();
			xhr.open('PUT', TUTORIAL_PROGRESS_URL);
			xhr.send(progressBody());
			await new Promise((resolve) => setTimeout(resolve, 5));
			expect(sendSpy).not.toHaveBeenCalled();
			expect(guard.counter().blocked).toBe(1);
		});

		it('throws a NetworkError for a blocked synchronous request', () => {
			guard.install();
			const xhr = new XMLHttpRequest();
			xhr.open('DELETE', `${USER_SERVICE}/x`, false);
			expect(() => xhr.send()).toThrow(
				expect.objectContaining({ name: 'NetworkError' })
			);
			expect(sendSpy).not.toHaveBeenCalled();
		});

		it('fails closed for a request opened before install (method unknown)', async () => {
			const xhr = new XMLHttpRequest();
			xhr.open('GET', `${USER_SERVICE}/x`);
			guard.install();
			xhr.send();
			await new Promise((resolve) => setTimeout(resolve, 5));
			expect(sendSpy).not.toHaveBeenCalled();
			expect(guard.blockedRequests[0].method).toBe('UNKNOWN');
		});
	});

	describe('navigator.sendBeacon', () => {
		let beacon: ReturnType<typeof vi.fn>;

		beforeEach(() => {
			beacon = vi.fn(() => true);
			Object.defineProperty(navigator, 'sendBeacon', {
				value: beacon,
				configurable: true,
				writable: true
			});
		});

		afterEach(() => {
			guard.uninstall();
			delete (navigator as { sendBeacon?: unknown }).sendBeacon;
		});

		it('returns false, never sends and counts the beacon as a POST', () => {
			guard.install();

			const queued = navigator.sendBeacon(
				`${USER_SERVICE}/beacon?x=1`,
				'data'
			);

			expect(queued).toBe(false);
			expect(beacon).not.toHaveBeenCalled();
			expect(guard.blockedRequests).toEqual([
				{
					method: 'POST',
					url: `${USER_SERVICE}/beacon`,
					channel: 'beacon',
					reason: 'default-deny'
				}
			]);
		});

		it('works in environments without sendBeacon', () => {
			delete (navigator as { sendBeacon?: unknown }).sendBeacon;
			guard.install();
			expect(
				(navigator as { sendBeacon?: unknown }).sendBeacon
			).toBeUndefined();
			guard.uninstall();
			expect(
				(navigator as { sendBeacon?: unknown }).sendBeacon
			).toBeUndefined();
		});
	});

	describe('install and uninstall', () => {
		it('restores the exact originals of fetch, XHR and sendBeacon', () => {
			const originalOpen = XMLHttpRequest.prototype.open;
			const originalSend = XMLHttpRequest.prototype.send;
			const originalBeacon = vi.fn(() => true);
			Object.defineProperty(navigator, 'sendBeacon', {
				value: originalBeacon,
				configurable: true,
				writable: true
			});

			guard.install();
			expect(globalThis.fetch).not.toBe(realFetch);
			expect(XMLHttpRequest.prototype.open).not.toBe(originalOpen);
			expect(XMLHttpRequest.prototype.send).not.toBe(originalSend);
			expect(navigator.sendBeacon).not.toBe(originalBeacon);
			expect(guard.isInstalled).toBe(true);

			guard.uninstall();
			expect(globalThis.fetch).toBe(realFetch);
			expect(XMLHttpRequest.prototype.open).toBe(originalOpen);
			expect(XMLHttpRequest.prototype.send).toBe(originalSend);
			expect(navigator.sendBeacon).toBe(originalBeacon);
			expect(guard.isInstalled).toBe(false);

			delete (navigator as { sendBeacon?: unknown }).sendBeacon;
		});

		it('removes an inherited sendBeacon patch instead of leaving an own property', () => {
			const proto = Object.getPrototypeOf(navigator);
			const original = vi.fn(() => true);
			Object.defineProperty(proto, 'sendBeacon', {
				value: original,
				configurable: true,
				writable: true
			});

			guard.install();
			guard.uninstall();

			expect(
				Object.prototype.hasOwnProperty.call(navigator, 'sendBeacon')
			).toBe(false);
			expect(navigator.sendBeacon).toBe(original);
			delete proto.sendBeacon;
		});

		it('lets writes through again after uninstall', async () => {
			guard.install();
			guard.uninstall();

			await globalThis.fetch(`${USER_SERVICE}/x`, { method: 'POST' });

			expect(realFetch).toHaveBeenCalledTimes(1);
			expect(guard.counter().blocked).toBe(0);
		});

		it('is idempotent: a second install does not stack, a second uninstall does nothing', async () => {
			guard.install();
			const wrapped = globalThis.fetch;
			guard.install();
			expect(globalThis.fetch).toBe(wrapped);

			guard.uninstall();
			guard.uninstall();
			expect(globalThis.fetch).toBe(realFetch);
		});

		it('can be installed again after an uninstall', async () => {
			guard.install();
			guard.uninstall();
			guard.install();

			await expect(
				globalThis.fetch(`${USER_SERVICE}/x`, { method: 'POST' })
			).rejects.toBeInstanceOf(PracticeBlockedRequestError);
		});

		it('rolls back completely and throws when a patch cannot be applied (fail closed)', () => {
			const originalOpen = XMLHttpRequest.prototype.open;
			const originalSend = XMLHttpRequest.prototype.send;
			Object.defineProperty(XMLHttpRequest.prototype, 'send', {
				value: originalSend,
				writable: false,
				configurable: true
			});

			try {
				expect(() => guard.install()).toThrow();

				expect(guard.isInstalled).toBe(false);
				expect(globalThis.fetch).toBe(realFetch);
				expect(XMLHttpRequest.prototype.open).toBe(originalOpen);
			} finally {
				Object.defineProperty(XMLHttpRequest.prototype, 'send', {
					value: originalSend,
					writable: true,
					configurable: true
				});
			}
		});

		it('does not clobber an outer patch on uninstall and then only passes through', async () => {
			guard.install();
			const guarded = globalThis.fetch;
			const outer = vi.fn((input, init) => guarded(input, init));
			globalThis.fetch = outer as unknown as typeof fetch;

			// While installed, the guard still sees what the outer patch lets through.
			await expect(
				globalThis.fetch(`${USER_SERVICE}/x`, { method: 'POST' })
			).rejects.toBeInstanceOf(PracticeBlockedRequestError);

			guard.uninstall();

			expect(globalThis.fetch).toBe(outer);
			await globalThis.fetch(`${USER_SERVICE}/x`, { method: 'POST' });
			expect(realFetch).toHaveBeenCalledTimes(1);
		});
	});

	describe('observability of blocked requests', () => {
		it('calls onBlocked synchronously with method, redacted URL, channel and reason', async () => {
			const seen: BlockedRequest[] = [];
			guard = createNetworkGuard({
				...baseOptions(),
				onBlocked: (request) => seen.push(request)
			});
			guard.install();

			const pending = globalThis.fetch(
				`https://user:pw@api.test.local/x?token=secret#frag`,
				{ method: 'POST' }
			);
			expect(seen).toHaveLength(1);
			await pending.catch(() => undefined);

			expect(seen[0]).toEqual({
				method: 'POST',
				url: 'https://api.test.local/x',
				channel: 'fetch',
				reason: 'default-deny'
			});
			expect(JSON.stringify(guard.blockedRequests)).not.toMatch(
				/secret|pw|frag/
			);
		});

		it('still blocks when the onBlocked callback throws', async () => {
			guard = createNetworkGuard({
				...baseOptions(),
				onBlocked: () => {
					throw new Error('observer bug');
				}
			});
			guard.install();

			await expect(
				globalThis.fetch(`${USER_SERVICE}/x`, { method: 'POST' })
			).rejects.toBeInstanceOf(PracticeBlockedRequestError);
			expect(guard.counter().blocked).toBe(1);
		});

		it('keeps counting after the recorded list is full', async () => {
			guard.install();
			for (let i = 0; i < 520; i++) {
				await globalThis
					.fetch(`${USER_SERVICE}/x/${i}`, { method: 'POST' })
					.catch(() => undefined);
			}
			expect(guard.counter().blocked).toBe(520);
			expect(guard.blockedRequests).toHaveLength(500);
			expect(guard.blockedRequests[499].url).toBe(
				`${USER_SERVICE}/x/519`
			);
		});

		it('returns snapshots: mutating them does not change the guard', async () => {
			guard.install();
			await globalThis
				.fetch(`${USER_SERVICE}/x`, { method: 'POST' })
				.catch(() => undefined);
			(guard.blockedRequests as BlockedRequest[]).length = 0;
			expect(guard.blockedRequests).toHaveLength(1);
		});
	});
});
