// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { endpoints } from '../resources/scripts/endpoints';
import { PracticeBlockedRequestError } from './networkGuard';
import {
	enterPracticeMode,
	exitPracticeMode,
	getPracticeNetworkGuard,
	getPracticeSnapshot,
	isPracticeMode,
	onPracticeBlocked,
	onPracticeExit,
	restartPracticeMode,
	subscribePractice
} from './practiceMode';
import { PRACTICE_TOUR_IDS } from './practiceTourIds';

const ACCEPT = 'consultant-practice-accept';
const SUPERVISION = 'consultant-practice-supervision';

const progressBody = (tourId: string) =>
	JSON.stringify({
		surface: 'frontend',
		tourId,
		tourVersion: 1,
		status: 'in_progress'
	});

describe('practice mode (module-level core)', () => {
	let realFetch: ReturnType<typeof vi.fn>;
	let originalFetch: typeof globalThis.fetch;

	beforeEach(() => {
		originalFetch = globalThis.fetch;
		realFetch = vi.fn(async () => new Response('{}', { status: 200 }));
		globalThis.fetch = realFetch as unknown as typeof fetch;
	});

	afterEach(() => {
		exitPracticeMode();
		globalThis.fetch = originalFetch;
	});

	it('knows the two practice tours of the spec', () => {
		expect([...PRACTICE_TOUR_IDS]).toEqual([ACCEPT, SUPERVISION]);
	});

	it('is inactive until entered, and exit returns to inactive', () => {
		expect(isPracticeMode()).toBe(false);
		expect(getPracticeSnapshot()).toEqual({
			status: 'inactive',
			session: null
		});

		enterPracticeMode({ tourId: ACCEPT, variant: 'team-discussion' });
		expect(isPracticeMode()).toBe(true);
		expect(getPracticeSnapshot().session).toEqual({
			tourId: ACCEPT,
			variant: 'team-discussion',
			runId: expect.any(Number)
		});

		exitPracticeMode();
		expect(isPracticeMode()).toBe(false);
		expect(getPracticeSnapshot().session).toBeNull();
	});

	it('has the guard in place before it reports practice mode, and removes it on exit', async () => {
		let wrappedWhenActive = false;
		const unsubscribe = subscribePractice(() => {
			if (isPracticeMode()) {
				wrappedWhenActive = globalThis.fetch !== realFetch;
			}
		});

		enterPracticeMode({ tourId: ACCEPT });
		unsubscribe();
		expect(wrappedWhenActive).toBe(true);
		await expect(
			globalThis.fetch('https://api.test.local/x', { method: 'POST' })
		).rejects.toBeInstanceOf(PracticeBlockedRequestError);

		exitPracticeMode();
		expect(globalThis.fetch).toBe(realFetch);
		await globalThis.fetch('https://api.test.local/x', { method: 'POST' });
		expect(realFetch).toHaveBeenCalledTimes(1);
	});

	it('refuses an unknown tour id and installs nothing (fail closed)', () => {
		expect(() =>
			enterPracticeMode({ tourId: 'consultant-walkthrough' })
		).toThrow(/practice tour/i);
		expect(() => enterPracticeMode({ tourId: '' })).toThrow();
		expect(isPracticeMode()).toBe(false);
		expect(globalThis.fetch).toBe(realFetch);
	});

	it('does not start practice when the guard cannot be installed', () => {
		const send = XMLHttpRequest.prototype.send;
		Object.defineProperty(XMLHttpRequest.prototype, 'send', {
			value: send,
			writable: false,
			configurable: true
		});
		try {
			expect(() => enterPracticeMode({ tourId: ACCEPT })).toThrow();
			expect(isPracticeMode()).toBe(false);
			expect(getPracticeNetworkGuard()).toBeNull();
			expect(globalThis.fetch).toBe(realFetch);
		} finally {
			Object.defineProperty(XMLHttpRequest.prototype, 'send', {
				value: send,
				writable: true,
				configurable: true
			});
		}
	});

	describe('allowlist wired to the real endpoints', () => {
		it('lets the progress PUT of the running tour through, and no other tour', async () => {
			enterPracticeMode({ tourId: ACCEPT });

			await globalThis.fetch(endpoints.tutorialProgress, {
				method: 'PUT',
				body: progressBody(ACCEPT)
			});
			expect(realFetch).toHaveBeenCalledTimes(1);

			await expect(
				globalThis.fetch(endpoints.tutorialProgress, {
					method: 'PUT',
					body: progressBody(SUPERVISION)
				})
			).rejects.toBeInstanceOf(PracticeBlockedRequestError);
			await expect(
				globalThis.fetch(endpoints.tutorialProgress, {
					method: 'PUT',
					body: progressBody('consultant-walkthrough')
				})
			).rejects.toBeInstanceOf(PracticeBlockedRequestError);
		});

		it('lets the token refresh through and keeps the password grant blocked', async () => {
			enterPracticeMode({ tourId: ACCEPT });

			await globalThis.fetch(endpoints.keycloakAccessToken, {
				method: 'POST',
				body: 'refresh_token=x&client_id=app&grant_type=refresh_token'
			});
			expect(realFetch).toHaveBeenCalledTimes(1);

			await expect(
				globalThis.fetch(endpoints.keycloakAccessToken, {
					method: 'POST',
					body: 'username=u&password=p&client_id=app&grant_type=password'
				})
			).rejects.toBeInstanceOf(PracticeBlockedRequestError);
		});
	});

	describe('entering again and restarting', () => {
		it('switches the allowed tour in place and starts a new run, without re-wrapping fetch', async () => {
			enterPracticeMode({ tourId: ACCEPT });
			const wrapped = globalThis.fetch;
			const firstRun = getPracticeSnapshot().session.runId;

			enterPracticeMode({ tourId: SUPERVISION });

			expect(globalThis.fetch).toBe(wrapped);
			expect(getPracticeSnapshot().session.tourId).toBe(SUPERVISION);
			expect(getPracticeSnapshot().session.runId).toBeGreaterThan(
				firstRun
			);
			await expect(
				globalThis.fetch(endpoints.tutorialProgress, {
					method: 'PUT',
					body: progressBody(ACCEPT)
				})
			).rejects.toBeInstanceOf(PracticeBlockedRequestError);
			await globalThis.fetch(endpoints.tutorialProgress, {
				method: 'PUT',
				body: progressBody(SUPERVISION)
			});
		});

		it('restart starts a new run of the same tour, never leaves the guard and keeps the count', async () => {
			enterPracticeMode({ tourId: ACCEPT, variant: 'v' });
			const wrapped = globalThis.fetch;
			const { runId } = getPracticeSnapshot().session;
			await globalThis
				.fetch('https://api.test.local/x', { method: 'POST' })
				.catch(() => undefined);

			restartPracticeMode();

			expect(globalThis.fetch).toBe(wrapped);
			expect(getPracticeSnapshot().session).toEqual({
				tourId: ACCEPT,
				variant: 'v',
				runId: runId + 1
			});
			expect(getPracticeNetworkGuard().counter().blocked).toBe(1);
		});

		it('exit and restart are no-ops while inactive', () => {
			const listener = vi.fn();
			const unsubscribe = subscribePractice(listener);
			exitPracticeMode();
			restartPracticeMode();
			unsubscribe();
			expect(listener).not.toHaveBeenCalled();
			expect(isPracticeMode()).toBe(false);
		});

		it('never reuses a run id across sessions', () => {
			enterPracticeMode({ tourId: ACCEPT });
			const a = getPracticeSnapshot().session.runId;
			exitPracticeMode();
			enterPracticeMode({ tourId: ACCEPT });
			expect(getPracticeSnapshot().session.runId).toBeGreaterThan(a);
		});
	});

	describe('subscriptions', () => {
		it('notifies on enter, restart and exit, and keeps the snapshot identity between changes', () => {
			const listener = vi.fn();
			const unsubscribe = subscribePractice(listener);

			enterPracticeMode({ tourId: ACCEPT });
			expect(listener).toHaveBeenCalledTimes(1);
			const snapshot = getPracticeSnapshot();
			expect(getPracticeSnapshot()).toBe(snapshot);

			restartPracticeMode();
			expect(listener).toHaveBeenCalledTimes(2);
			expect(getPracticeSnapshot()).not.toBe(snapshot);

			exitPracticeMode();
			expect(listener).toHaveBeenCalledTimes(3);

			unsubscribe();
			enterPracticeMode({ tourId: ACCEPT });
			expect(listener).toHaveBeenCalledTimes(3);
		});

		it('lets a throwing subscriber neither stop the others nor break enter and exit', () => {
			const other = vi.fn();
			const offBroken = subscribePractice(() => {
				throw new Error('subscriber bug');
			});
			const offOther = subscribePractice(other);

			expect(() => enterPracticeMode({ tourId: ACCEPT })).not.toThrow();
			expect(() => exitPracticeMode()).not.toThrow();

			offBroken();
			offOther();
			expect(other).toHaveBeenCalledTimes(2);
			expect(isPracticeMode()).toBe(false);
			expect(globalThis.fetch).toBe(realFetch);
		});

		it('reports blocked requests to onPracticeBlocked listeners until they unsubscribe', async () => {
			const seen: string[] = [];
			const off = onPracticeBlocked((request) =>
				seen.push(`${request.method} ${request.url}`)
			);
			enterPracticeMode({ tourId: ACCEPT });

			await globalThis
				.fetch('https://api.test.local/a', { method: 'DELETE' })
				.catch(() => undefined);
			off();
			await globalThis
				.fetch('https://api.test.local/b', { method: 'DELETE' })
				.catch(() => undefined);

			expect(seen).toEqual(['DELETE https://api.test.local/a']);
		});
	});

	describe('layers on top of the guard', () => {
		it('runs registered teardowns newest first, before the guard is removed', () => {
			enterPracticeMode({ tourId: ACCEPT });
			const order: string[] = [];
			onPracticeExit(() =>
				order.push(
					`first (guard still on: ${globalThis.fetch !== realFetch})`
				)
			);
			onPracticeExit(() => order.push('second'));

			exitPracticeMode();

			expect(order).toEqual(['second', 'first (guard still on: true)']);
			expect(globalThis.fetch).toBe(realFetch);
		});

		it('removes the guard even if a teardown throws, and still runs the others', () => {
			enterPracticeMode({ tourId: ACCEPT });
			const ran = vi.fn();
			onPracticeExit(ran);
			onPracticeExit(() => {
				throw new Error('layer bug');
			});

			expect(() => exitPracticeMode()).not.toThrow();

			expect(ran).toHaveBeenCalledTimes(1);
			expect(globalThis.fetch).toBe(realFetch);
			expect(isPracticeMode()).toBe(false);
		});

		it('forgets teardowns that were unsubscribed or already ran', () => {
			enterPracticeMode({ tourId: ACCEPT });
			const removed = vi.fn();
			const kept = vi.fn();
			onPracticeExit(removed)();
			onPracticeExit(kept);

			exitPracticeMode();
			enterPracticeMode({ tourId: ACCEPT });
			exitPracticeMode();

			expect(removed).not.toHaveBeenCalled();
			expect(kept).toHaveBeenCalledTimes(1);
		});

		it('refuses to register a teardown while inactive', () => {
			expect(() => onPracticeExit(() => undefined)).toThrow(/active/i);
		});
	});
});
