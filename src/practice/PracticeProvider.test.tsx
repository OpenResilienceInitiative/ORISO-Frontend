// @vitest-environment jsdom
import React, { StrictMode, useEffect } from 'react';
import {
	act,
	cleanup,
	fireEvent,
	render,
	renderHook,
	screen
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { endpoints } from '../resources/scripts/endpoints';
import { PracticeBlockedRequestError } from './networkGuard';
import { exitPracticeMode, isPracticeMode } from './practiceMode';
import { PracticeProvider, usePractice } from './PracticeProvider';

const ACCEPT = 'consultant-practice-accept';
const SUPERVISION = 'consultant-practice-supervision';

const Probe = ({ tourId = ACCEPT }: { tourId?: string }) => {
	const practice = usePractice();
	return (
		<div>
			<span data-testid="state">{practice.state}</span>
			<span data-testid="is-practice">{String(practice.isPractice)}</span>
			<span data-testid="tour">{practice.tourId ?? ''}</span>
			<span data-testid="variant">{practice.variant ?? ''}</span>
			<span data-testid="run">{practice.runId ?? ''}</span>
			<button onClick={() => practice.enter({ tourId, variant: 'v1' })}>
				enter
			</button>
			<button onClick={practice.exit}>exit</button>
			<button onClick={practice.restart}>restart</button>
		</div>
	);
};

const text = (id: string) => screen.getByTestId(id).textContent;
const click = (name: string) =>
	act(() => {
		fireEvent.click(screen.getByText(name));
	});

describe('PracticeProvider and usePractice', () => {
	let realFetch: ReturnType<typeof vi.fn>;
	let originalFetch: typeof globalThis.fetch;

	beforeEach(() => {
		originalFetch = globalThis.fetch;
		realFetch = vi.fn(async () => new Response('{}', { status: 200 }));
		globalThis.fetch = realFetch as unknown as typeof fetch;
	});

	afterEach(() => {
		cleanup();
		exitPracticeMode();
		globalThis.fetch = originalFetch;
	});

	it('outside a provider reports "not practising" and refuses to enter', () => {
		const { result } = renderHook(() => usePractice());

		expect(result.current.state).toBe('inactive');
		expect(result.current.isPractice).toBe(false);
		expect(() => result.current.enter({ tourId: ACCEPT })).toThrow(
			/PracticeProvider/
		);
		expect(() => result.current.exit()).not.toThrow();
		expect(isPracticeMode()).toBe(false);
	});

	it('starts inactive and leaves the network alone', () => {
		render(
			<PracticeProvider>
				<Probe />
			</PracticeProvider>
		);

		expect(text('state')).toBe('inactive');
		expect(text('is-practice')).toBe('false');
		expect(globalThis.fetch).toBe(realFetch);
	});

	it('enter makes isPractice true, installs the guard and tells non-React code', async () => {
		render(
			<PracticeProvider>
				<Probe />
			</PracticeProvider>
		);

		click('enter');

		expect(text('state')).toBe('active');
		expect(text('is-practice')).toBe('true');
		expect(text('tour')).toBe(ACCEPT);
		expect(text('variant')).toBe('v1');
		expect(isPracticeMode()).toBe(true);
		await expect(
			globalThis.fetch('https://api.test.local/x', { method: 'POST' })
		).rejects.toBeInstanceOf(PracticeBlockedRequestError);
	});

	it('exit removes the guard and returns to inactive', async () => {
		render(
			<PracticeProvider>
				<Probe />
			</PracticeProvider>
		);
		click('enter');

		click('exit');

		expect(text('state')).toBe('inactive');
		expect(isPracticeMode()).toBe(false);
		expect(globalThis.fetch).toBe(realFetch);
	});

	it('restart begins a new run without ever dropping the guard', () => {
		render(
			<PracticeProvider>
				<Probe />
			</PracticeProvider>
		);
		click('enter');
		const guarded = globalThis.fetch;
		const firstRun = Number(text('run'));

		click('restart');

		expect(Number(text('run'))).toBe(firstRun + 1);
		expect(text('state')).toBe('active');
		expect(globalThis.fetch).toBe(guarded);
	});

	it('follows an exit triggered by non-React code (for example logout)', () => {
		render(
			<PracticeProvider>
				<Probe />
			</PracticeProvider>
		);
		click('enter');

		act(() => exitPracticeMode());

		expect(text('state')).toBe('inactive');
		expect(globalThis.fetch).toBe(realFetch);
	});

	it('refuses a tour that is not a practice tour and stays inactive', () => {
		const { result } = renderHook(() => usePractice(), {
			wrapper: PracticeProvider
		});

		expect(() =>
			result.current.enter({ tourId: 'consultant-walkthrough' })
		).toThrow(/practice tour/i);

		expect(result.current.state).toBe('inactive');
		expect(globalThis.fetch).toBe(realFetch);
	});

	it('uninstalls the guard when the provider unmounts while practising', () => {
		const { unmount } = render(
			<PracticeProvider>
				<Probe />
			</PracticeProvider>
		);
		click('enter');
		expect(isPracticeMode()).toBe(true);

		unmount();

		expect(isPracticeMode()).toBe(false);
		expect(globalThis.fetch).toBe(realFetch);
	});

	it('gives every consumer the same view, and stable callbacks', () => {
		const seen: Array<ReturnType<typeof usePractice>> = [];
		const Collector = () => {
			seen.push(usePractice());
			return null;
		};
		render(
			<PracticeProvider>
				<Probe />
				<Collector />
			</PracticeProvider>
		);
		click('enter');
		click('restart');

		const first = seen[0];
		const last = seen[seen.length - 1];
		expect(last.isPractice).toBe(true);
		expect(last.enter).toBe(first.enter);
		expect(last.exit).toBe(first.exit);
		expect(last.restart).toBe(first.restart);
	});

	describe('React StrictMode (double mount)', () => {
		const AutoEnter = ({ tourId }: { tourId: string }) => {
			const { enter } = usePractice();
			useEffect(() => {
				enter({ tourId });
			}, [enter, tourId]);
			return null;
		};

		it('ends with exactly one guard layer when a child enters on mount', () => {
			const { unmount } = render(
				<StrictMode>
					<PracticeProvider>
						<AutoEnter tourId={ACCEPT} />
						<Probe />
					</PracticeProvider>
				</StrictMode>
			);

			expect(text('state')).toBe('active');
			expect(isPracticeMode()).toBe(true);

			unmount();

			expect(isPracticeMode()).toBe(false);
			expect(globalThis.fetch).toBe(realFetch);
		});

		it('keeps an entered session across the simulated remount of a later click', () => {
			const { unmount } = render(
				<StrictMode>
					<PracticeProvider>
						<Probe tourId={SUPERVISION} />
					</PracticeProvider>
				</StrictMode>
			);

			click('enter');
			expect(text('tour')).toBe(SUPERVISION);
			click('exit');
			click('enter');
			unmount();

			expect(globalThis.fetch).toBe(realFetch);
		});
	});

	describe('T8 part 1: practice state lives in memory only', () => {
		const storageSnapshot = (storage: Storage) =>
			Array.from({ length: storage.length }, (_, i) => {
				const key = storage.key(i) as string;
				return [key, storage.getItem(key)];
			}).sort();

		let indexedDbOpen: ReturnType<typeof vi.fn>;
		let hadIndexedDb: boolean;
		let originalIndexedDb: unknown;

		beforeEach(() => {
			localStorage.setItem('real-setting', 'kept');
			sessionStorage.setItem('real-session', 'kept');
			indexedDbOpen = vi.fn();
			hadIndexedDb = 'indexedDB' in globalThis;
			originalIndexedDb = (globalThis as { indexedDB?: unknown })
				.indexedDB;
			Object.defineProperty(globalThis, 'indexedDB', {
				value: { open: indexedDbOpen, deleteDatabase: indexedDbOpen },
				configurable: true,
				writable: true
			});
		});

		afterEach(() => {
			localStorage.clear();
			sessionStorage.clear();
			if (hadIndexedDb) {
				Object.defineProperty(globalThis, 'indexedDB', {
					value: originalIndexedDb,
					configurable: true,
					writable: true
				});
			} else {
				delete (globalThis as { indexedDB?: unknown }).indexedDB;
			}
		});

		it('touches no localStorage, sessionStorage or IndexedDB from enter to exit and leaves both stores identical', async () => {
			const localBefore = storageSnapshot(localStorage);
			const sessionBefore = storageSnapshot(sessionStorage);
			const methods = [
				'getItem',
				'setItem',
				'removeItem',
				'clear',
				'key'
			];
			const spies = [localStorage, sessionStorage].flatMap((storage) =>
				methods.map((method) =>
					vi.spyOn(Object.getPrototypeOf(storage), method as never)
				)
			);

			render(
				<PracticeProvider>
					<Probe />
				</PracticeProvider>
			);
			click('enter');
			await globalThis
				.fetch('https://api.test.local/x', {
					method: 'POST',
					body: '{}'
				})
				.catch(() => undefined);
			await globalThis.fetch(endpoints.tutorialProgress, {
				method: 'PUT',
				body: JSON.stringify({ surface: 'frontend', tourId: ACCEPT })
			});
			click('restart');
			click('exit');

			const calls = spies.flatMap((spy) => spy.mock.calls);
			spies.forEach((spy) => spy.mockRestore());
			expect(calls).toEqual([]);
			expect(indexedDbOpen).not.toHaveBeenCalled();
			expect(storageSnapshot(localStorage)).toEqual(localBefore);
			expect(storageSnapshot(sessionStorage)).toEqual(sessionBefore);
		});
	});
});
