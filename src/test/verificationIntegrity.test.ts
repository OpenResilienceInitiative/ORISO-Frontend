// @vitest-environment oriso-jsdom
import { describe, expect, it, vi } from 'vite-plus/test';
import { captureStorybookAnimationCleanup } from '../../.storybook/storybookAnimationCleanup';
import { createVerificationRecorder } from '../../.storybook/verificationIntegrity';
import {
	beginStoryVerification,
	finishStoryVerification,
	recordUnexpectedRequest
} from '../../.storybook/verification';

describe('ordinary Storybook integrity', () => {
	it('requires exact kind, message and count, including a missing expected error', () => {
		const expected = [
			{ kind: 'console-error' as const, message: 'expected', count: 1 }
		];
		const missing = createVerificationRecorder(expected);
		expect(() => missing.assertComplete()).toThrow(
			'expected 1, received 0'
		);
		const correct = createVerificationRecorder(expected);
		correct.record('console-error', 'expected');
		expect(() => correct.assertComplete()).not.toThrow();
		correct.record('console-error', 'expected');
		expect(() => correct.assertComplete()).toThrow(
			'expected 1, received 2'
		);
	});
	it('fails a caught unexpected request rather than treating it as an empty fixture', () => {
		const finish = beginStoryVerification();
		expect(() =>
			recordUnexpectedRequest(
				new Request('https://api.storybook.test/service/unconfigured')
			)
		).toThrow('Unexpected product API');
		expect(finish).toThrow('unexpected-request');
	});
	it('retains transient fallback evidence and restores both storages and root/body attributes', () => {
		localStorage.setItem('integrity-original', 'local');
		sessionStorage.setItem('integrity-original', 'session');
		const finish = beginStoryVerification();
		localStorage.clear();
		sessionStorage.clear();
		document.documentElement.setAttribute('data-integrity-test', 'dirty');
		document.body.setAttribute('data-integrity-test', 'dirty');
		const fallback = document.createElement('div');
		fallback.dataset.sbNeedsData = 'true';
		document.body.append(fallback);
		fallback.remove();
		expect(finish).toThrow('fallback');
		expect(localStorage.getItem('integrity-original')).toBe('local');
		expect(sessionStorage.getItem('integrity-original')).toBe('session');
		expect(
			document.documentElement.hasAttribute('data-integrity-test')
		).toBe(false);
		expect(document.body.hasAttribute('data-integrity-test')).toBe(false);
		localStorage.removeItem('integrity-original');
		sessionStorage.removeItem('integrity-original');
	});
});

// Prepared during the source-only lease interval; capture red before implementing.
describe('same-test story completion', () => {
	it('awaits owned asynchronous cleanup and records declared needs-data as failed evidence', async () => {
		const cleanup = vi.fn(async () => {
			await Promise.resolve();
		});
		const evidence: unknown[] = [];
		beginStoryVerification([], {
			id: 'declared',
			declaredNeedsData: true,
			cleanup
		});
		const panel = document.createElement('div');
		panel.dataset.sbNeedsData = 'true';
		document.body.append(panel);
		try {
			await expect(
				finishStoryVerification((value) => evidence.push(value))
			).rejects.toThrow('fallback');
		} finally {
			panel.remove();
		}
		expect(cleanup).toHaveBeenCalledTimes(1);
		expect(evidence).toEqual([
			expect.objectContaining({
				storyId: 'declared',
				classification: 'declared-needs-data'
			})
		]);
		await finishStoryVerification();
		expect(cleanup).toHaveBeenCalledTimes(1);
	});
	it('retains both the verification failure and an owned cleanup failure', async () => {
		beginStoryVerification([], {
			cleanup: async () => {
				throw new Error('controlled-cleanup-error');
			}
		});
		const fallback = document.createElement('div');
		fallback.dataset.storyFallback = 'true';
		document.body.append(fallback);
		try {
			await expect(finishStoryVerification()).rejects.toThrow(
				/fallback[\s\S]*controlled-cleanup-error/
			);
		} finally {
			fallback.remove();
		}
	});

	it('does not rethrow a reported failure from later Storybook safety cleanup', async () => {
		const finish = beginStoryVerification([
			{ kind: 'console-error', message: 'missing', count: 1 }
		]);
		await expect(finish.complete()).rejects.toThrow(
			'expected 1, received 0'
		);
		await expect(finish.complete()).resolves.toBeUndefined();
	});
	it('captures errors and restores state after awaited owned cleanup', async () => {
		const originalError = console.error;
		const originalFetch = globalThis.fetch;
		beginStoryVerification([], {
			cleanup: async () => {
				await Promise.resolve();
				console.error('controlled-late-cleanup-console');
				document.documentElement.setAttribute(
					'data-cleanup-dirty',
					'true'
				);
				document.body.setAttribute('data-cleanup-dirty', 'true');
				localStorage.setItem('cleanup-dirty', 'local');
				sessionStorage.setItem('cleanup-dirty', 'session');
				globalThis.fetch = async () => new Response('dirty');
			}
		});
		await expect(finishStoryVerification()).rejects.toThrow(
			'console-error: controlled-late-cleanup-console'
		);
		expect(console.error).toBe(originalError);
		expect(globalThis.fetch).toBe(originalFetch);
		expect(
			document.documentElement.hasAttribute('data-cleanup-dirty')
		).toBe(false);
		expect(document.body.hasAttribute('data-cleanup-dirty')).toBe(false);
		expect(localStorage.getItem('cleanup-dirty')).toBeNull();
		expect(sessionStorage.getItem('cleanup-dirty')).toBeNull();
	});
	it('retains a locally caught unexpected request during awaited cleanup', async () => {
		beginStoryVerification([], {
			cleanup: async () => {
				await Promise.resolve();
				try {
					recordUnexpectedRequest(
						new Request(
							'https://api.storybook.test/service/cleanup-unexpected'
						)
					);
				} catch {
					/* The story catches its request failure; the guard must retain it. */
				}
			}
		});
		await expect(finishStoryVerification()).rejects.toThrow(
			'unexpected-request: GET https://api.storybook.test/service/cleanup-unexpected'
		);
	});
});

const pinnedPauseStyle = `*, *:before, *:after {
    animation-delay: 0s !important;
    animation-direction: reverse !important;
    animation-play-state: paused !important;
    transition: none !important;
  }`;

describe('current-test pinned Storybook animation style ownership', () => {
	it('keeps pause styles through awaited cleanup and releases only new exact nodes after failed verification', async () => {
		const existing = document.createElement('style');
		existing.textContent = pinnedPauseStyle;
		const unrelated = document.createElement('style');
		unrelated.textContent = '.existing-fixture { color: red; }';
		document.head.append(existing, unrelated);
		const owned = document.createElement('style');
		owned.textContent = pinnedPauseStyle;
		const newUnrelated = document.createElement('style');
		newUnrelated.textContent = '.new-fixture { color: blue; }';
		let ownedDuringCleanup = false;
		const finish = beginStoryVerification([], {
			cleanup: async () => {
				await Promise.resolve();
				ownedDuringCleanup = owned.isConnected;
			}
		});
		document.head.append(owned, newUnrelated);
		const fallback = document.createElement('div');
		fallback.dataset.storyFallback = '';
		document.body.append(fallback);
		try {
			await expect(finish.complete()).rejects.toThrow('fallback');
			expect(ownedDuringCleanup).toBe(true);
			expect(owned.isConnected).toBe(false);
			expect(existing.isConnected).toBe(true);
			expect(unrelated.isConnected).toBe(true);
			expect(newUnrelated.isConnected).toBe(true);
			await expect(finish.complete()).resolves.toBeUndefined();
			expect(existing.isConnected).toBe(true);
		} finally {
			existing.remove();
			unrelated.remove();
			owned.remove();
			newUnrelated.remove();
			fallback.remove();
		}
	});
});

it('drains pending pause nodes and isolates idempotent cleanup from the next story', async () => {
	const release = captureStorybookAnimationCleanup();
	const pending = document.createElement('style');
	pending.textContent = pinnedPauseStyle;
	document.head.append(pending);
	release();
	expect(pending.isConnected).toBe(false);
	const first = beginStoryVerification();
	await first.complete();
	const second = beginStoryVerification();
	const later = document.createElement('style');
	later.textContent = pinnedPauseStyle;
	document.head.append(later);
	try {
		await first.complete();
		expect(later.isConnected).toBe(true);
		await second.complete();
		expect(later.isConnected).toBe(false);
		release();
	} finally {
		later.remove();
	}
});
