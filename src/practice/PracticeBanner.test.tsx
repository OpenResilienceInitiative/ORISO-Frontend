// @vitest-environment jsdom
import React from 'react';
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen
} from '@testing-library/react';
import { createStore, Provider } from 'jotai';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tourLaunchRequestAtom } from '../components/productTour/tourLaunchState';
import type { TourDefinition } from '../components/productTour/types';
import {
	enterPracticeMode,
	exitPracticeMode,
	isPracticeMode
} from './practiceMode';
import { PracticeProvider } from './PracticeProvider';
import { practiceTourProgressAtom } from './usePracticeTourProgress';
import { PracticeBanner } from './PracticeBanner';

vi.mock('react-i18next', async () => {
	const { makeTranslate } = await import('./practiceTestTranslate');
	const t = makeTranslate({
		'tour.practice.accept.title': 'Anfrage annehmen'
	});
	return { useTranslation: () => ({ t, i18n: { language: 'de' } }) };
});

const ACCEPT = 'consultant-practice-accept';
const tours: TourDefinition[] = [
	{
		id: ACCEPT,
		version: 1,
		surface: 'frontend',
		audiences: ['consultant'],
		titleKey: 'tour.practice.accept.title',
		summaryKey: 'tour.practice.accept.summary',
		steps: []
	}
];

const VIEWPORT = { width: 1024, height: 768 };
const BANNER_SIZE = { width: 480, height: 64 };

const bannerEl = () => screen.getByTestId('practice-banner');
const handle = () => screen.getByRole('button', { name: /verschieben/i });
const pos = () => ({
	left: parseFloat(bannerEl().style.left),
	top: parseFloat(bannerEl().style.top)
});

const renderBanner = () => {
	const store = createStore();
	enterPracticeMode({ tourId: ACCEPT });
	const utils = render(
		<Provider store={store}>
			<PracticeProvider>
				<PracticeBanner tours={tours} />
			</PracticeProvider>
		</Provider>
	);
	return { store, ...utils };
};

// jsdom has no PointerEvent; a MouseEvent with a pointer id carries what the
// handle reads (button, client position).
class TestPointerEvent extends MouseEvent {
	pointerId: number;

	constructor(type: string, init: MouseEventInit & { pointerId?: number }) {
		super(type, init);
		this.pointerId = init.pointerId ?? 0;
	}
}

beforeEach(() => {
	vi.stubGlobal('PointerEvent', TestPointerEvent);
	window.innerWidth = VIEWPORT.width;
	window.innerHeight = VIEWPORT.height;
	// jsdom lays nothing out: the banner sits centred at the top until it is
	// moved, then wherever `left`/`top` put it.
	vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
		function (this: HTMLElement) {
			const left = this.style.left.endsWith('px')
				? parseFloat(this.style.left)
				: (VIEWPORT.width - BANNER_SIZE.width) / 2;
			const top = this.style.top ? parseFloat(this.style.top) : 16;
			return {
				left,
				top,
				right: left + BANNER_SIZE.width,
				bottom: top + BANNER_SIZE.height,
				width: BANNER_SIZE.width,
				height: BANNER_SIZE.height,
				x: left,
				y: top,
				toJSON: () => ({})
			};
		}
	);
});

afterEach(() => {
	cleanup();
	exitPracticeMode();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe('PracticeBanner', () => {
	it('shows nothing while practice is off', () => {
		render(
			<Provider store={createStore()}>
				<PracticeProvider>
					<PracticeBanner tours={tours} />
				</PracticeProvider>
			</Provider>
		);

		expect(screen.queryByTestId('practice-banner')).toBeNull();
	});

	it('names the flow and carries the permanent practice note, as a status', () => {
		renderBanner();

		expect(screen.getByRole('status', { name: 'Übungsmodus' })).toBe(
			bannerEl()
		);
		expect(screen.getByText('Anfrage annehmen')).toBeTruthy();
		expect(screen.getByText(/Übungsfall, keine echten Daten/)).toBeTruthy();
	});

	it('shows "Schritt i von N" from the running tour and follows it', () => {
		const { store } = renderBanner();
		act(() =>
			store.set(practiceTourProgressAtom, {
				tourId: ACCEPT,
				stepIndex: 2,
				stepCount: 6
			})
		);
		expect(screen.getByText(/Schritt 3 von 6/)).toBeTruthy();

		act(() =>
			store.set(practiceTourProgressAtom, {
				tourId: ACCEPT,
				stepIndex: 4,
				stepCount: 5
			})
		);
		expect(screen.getByText(/Schritt 5 von 5/)).toBeTruthy();
	});

	it('shows no progress for a run it does not know yet', () => {
		const { store } = renderBanner();
		expect(screen.queryByText(/Schritt/)).toBeNull();

		act(() =>
			store.set(practiceTourProgressAtom, {
				tourId: 'consultant-practice-supervision',
				stepIndex: 0,
				stepCount: 4
			})
		);
		expect(screen.queryByText(/Schritt/)).toBeNull();
	});

	it('cannot be dismissed: no close button, Escape leaves it up', () => {
		renderBanner();

		fireEvent.keyDown(bannerEl(), { key: 'Escape' });
		fireEvent.keyDown(document.body, { key: 'Escape' });

		expect(
			screen.queryByRole('button', { name: /schließen|close/i })
		).toBeNull();
		expect(screen.getByTestId('practice-banner')).toBeTruthy();
	});

	it('sits above the tour overlay (53) and below modals (1300)', () => {
		renderBanner();

		const zIndex = Number(bannerEl().style.zIndex);
		expect(zIndex).toBeGreaterThan(53);
		expect(zIndex).toBeLessThan(1300);
	});

	describe('End practice', () => {
		it('stops the tour host and leaves practice mode once the practice views drained', async () => {
			const { store } = renderBanner();
			store.set(tourLaunchRequestAtom, {
				tourId: ACCEPT,
				mode: 'start',
				requestedAt: 1
			});

			fireEvent.click(
				screen.getByRole('button', { name: 'Übung beenden' })
			);

			expect(store.get(tourLaunchRequestAtom)).toBeNull();
			expect(screen.queryByTestId('practice-banner')).toBeNull();
			await act(
				() => new Promise<void>((resolve) => setTimeout(resolve, 0))
			);
			expect(isPracticeMode()).toBe(false);
		});
	});

	describe('Restart', () => {
		// The host restarts the run as end + enter; that new run resets the
		// fixtures (PracticeFlow.integration.test.tsx).
		it('asks the host for a fresh run of the same tour', () => {
			const { store } = renderBanner();
			store.set(tourLaunchRequestAtom, {
				tourId: ACCEPT,
				mode: 'start',
				requestedAt: 5
			});

			fireEvent.click(
				screen.getByRole('button', { name: 'Neu starten' })
			);

			expect(store.get(tourLaunchRequestAtom)).toEqual({
				tourId: ACCEPT,
				mode: 'restart',
				requestedAt: expect.any(Number)
			});
			expect(
				store.get(tourLaunchRequestAtom)!.requestedAt
			).toBeGreaterThan(5);
		});

		it('always remounts the run, even for two restarts in the same millisecond', () => {
			vi.spyOn(Date, 'now').mockReturnValue(1000);
			const { store } = renderBanner();
			const button = screen.getByRole('button', { name: 'Neu starten' });

			fireEvent.click(button);
			const first = store.get(tourLaunchRequestAtom)!.requestedAt;
			fireEvent.click(button);
			const second = store.get(tourLaunchRequestAtom)!.requestedAt;

			expect(second).toBeGreaterThan(first);
		});

		it('stays in practice mode', () => {
			renderBanner();

			fireEvent.click(
				screen.getByRole('button', { name: 'Neu starten' })
			);

			expect(isPracticeMode()).toBe(true);
		});
	});

	describe('moving it', () => {
		const drag = (from: [number, number], to: [number, number]) => {
			fireEvent.pointerDown(handle(), {
				button: 0,
				pointerId: 1,
				clientX: from[0],
				clientY: from[1]
			});
			fireEvent.pointerMove(handle(), {
				pointerId: 1,
				clientX: to[0],
				clientY: to[1]
			});
			fireEvent.pointerUp(handle(), { pointerId: 1 });
		};

		it('follows the pointer when the handle is dragged', () => {
			renderBanner();
			const start = { left: 272, top: 16 };

			drag([300, 40], [350, 140]);

			expect(pos()).toEqual({
				left: start.left + 50,
				top: start.top + 100
			});
		});

		it('stops following once the pointer is released', () => {
			renderBanner();
			drag([300, 40], [350, 140]);
			const after = pos();

			fireEvent.pointerMove(handle(), {
				pointerId: 1,
				clientX: 900,
				clientY: 700
			});

			expect(pos()).toEqual(after);
		});

		it('keeps the whole banner inside the viewport while dragging', () => {
			renderBanner();

			drag([300, 40], [5000, 5000]);
			expect(pos()).toEqual({
				left: VIEWPORT.width - 8 - BANNER_SIZE.width,
				top: VIEWPORT.height - 8 - BANNER_SIZE.height
			});

			drag([300, 40], [-5000, -5000]);
			expect(pos()).toEqual({ left: 8, top: 8 });
		});

		it('moves with the arrow keys, 16 px a step, larger with Shift', () => {
			renderBanner();
			handle().focus();

			fireEvent.keyDown(handle(), { key: 'ArrowDown' });
			expect(pos()).toEqual({ left: 272, top: 32 });

			fireEvent.keyDown(handle(), { key: 'ArrowRight' });
			expect(pos()).toEqual({ left: 288, top: 32 });

			fireEvent.keyDown(handle(), { key: 'ArrowRight', shiftKey: true });
			expect(pos()).toEqual({ left: 352, top: 32 });
		});

		it('does not let the arrow keys push it out of the viewport', () => {
			renderBanner();

			fireEvent.keyDown(handle(), { key: 'ArrowUp' });
			fireEvent.keyDown(handle(), { key: 'ArrowUp' });
			for (let press = 0; press < 5; press += 1) {
				fireEvent.keyDown(handle(), {
					key: 'ArrowLeft',
					shiftKey: true
				});
			}

			expect(pos()).toEqual({ left: 8, top: 8 });
		});

		it('pulls it back into view when the window shrinks', () => {
			renderBanner();
			for (let press = 0; press < 4; press += 1) {
				fireEvent.keyDown(handle(), {
					key: 'ArrowRight',
					shiftKey: true
				});
			}
			expect(pos().left).toBe(528);

			window.innerWidth = 700;
			act(() => {
				window.dispatchEvent(new Event('resize'));
			});

			expect(pos().left).toBe(700 - 8 - BANNER_SIZE.width);
		});

		it('ignores keys that are not arrows', () => {
			renderBanner();

			fireEvent.keyDown(handle(), { key: 'a' });
			fireEvent.keyDown(handle(), { key: 'Enter' });

			expect(bannerEl().style.left).toBe('50%');
		});
	});
});
