// @vitest-environment oriso-jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { subscribeToTourEvent } from '../components/productTour/tourEvents';
import type { useLiveChatAvailable } from '../utils/liveChatToggle';
import {
	enterPracticeMode,
	exitPracticeMode,
	getPracticeNetworkGuard,
	restartPracticeMode
} from './practiceMode';
import {
	getPracticeLiveChatAvailable,
	setPracticeLiveChatAvailable,
	usePracticeLiveChatAvailability
} from './practiceLiveChatAvailability';
import { PRACTICE_TOUR_EVENTS } from './practiceTourEvents';

type Availability = ReturnType<typeof useLiveChatAvailable>;

const TOUR = 'consultant-live-chat';
const realState = {
	loading: false,
	pending: false,
	error: false,
	lostReason: null
};
/** The real hook's answer: available, with a real setter that must stay unused. */
const real = (active = true): Availability => [
	active,
	vi.fn(async () => undefined),
	realState
];
const macrotask = () =>
	act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));

describe('practice live-chat availability', () => {
	afterEach(() => {
		cleanup();
		exitPracticeMode();
	});

	it('passes the real availability through outside practice', () => {
		const realAvailability = real(true);
		const { result } = renderHook(() =>
			usePracticeLiveChatAvailability(realAvailability)
		);
		expect(result.current).toBe(realAvailability);
	});

	it('starts off in practice even when the counsellor is really available', () => {
		enterPracticeMode({ tourId: TOUR });
		const { result } = renderHook(() =>
			usePracticeLiveChatAvailability(real(true))
		);
		expect(result.current[0]).toBe(false);
		expect(result.current[2]).toEqual(realState);
	});

	it('switches only the practice state: the real setter, the network and storage stay untouched', async () => {
		const fetchSpy = vi.spyOn(window, 'fetch');
		const setItem = vi.spyOn(Storage.prototype, 'setItem');
		const removeItem = vi.spyOn(Storage.prototype, 'removeItem');
		enterPracticeMode({ tourId: TOUR });
		const realAvailability = real(false);
		const { result } = renderHook(() =>
			usePracticeLiveChatAvailability(realAvailability)
		);

		await act(() => result.current[1](true));
		expect(result.current[0]).toBe(true);
		expect(getPracticeLiveChatAvailable()).toBe(true);
		await act(() => result.current[1](false));
		expect(result.current[0]).toBe(false);

		expect(realAvailability[1]).not.toHaveBeenCalled();
		expect(fetchSpy).not.toHaveBeenCalled();
		// Not even a request the guard had to stop.
		expect(getPracticeNetworkGuard()?.counter()).toEqual({
			blocked: 0,
			allowed: 0
		});
		expect(setItem).not.toHaveBeenCalled();
		expect(removeItem).not.toHaveBeenCalled();
	});

	it('tells the tour once, a macrotask after switching on, so the control navigates first', async () => {
		const seen = vi.fn();
		const off = subscribeToTourEvent(
			PRACTICE_TOUR_EVENTS.liveChatAvailable,
			seen
		);
		enterPracticeMode({ tourId: TOUR });

		act(() => setPracticeLiveChatAvailable(true));
		expect(seen).not.toHaveBeenCalled();
		await macrotask();
		expect(seen).toHaveBeenCalledTimes(1);

		// Already on: no second event; switching off says nothing.
		act(() => setPracticeLiveChatAvailable(true));
		act(() => setPracticeLiveChatAvailable(false));
		await macrotask();
		expect(seen).toHaveBeenCalledTimes(1);

		// On and off again before the macrotask, or on in a run that ended:
		// nothing to tell.
		act(() => setPracticeLiveChatAvailable(true));
		act(() => setPracticeLiveChatAvailable(false));
		act(() => setPracticeLiveChatAvailable(true));
		act(() => exitPracticeMode());
		await macrotask();
		expect(seen).toHaveBeenCalledTimes(1);
		off();
	});

	it('is discarded on exit and on restart; the real state shows again', () => {
		enterPracticeMode({ tourId: TOUR });
		const realAvailability = real(true);
		const { result } = renderHook(() =>
			usePracticeLiveChatAvailability(realAvailability)
		);
		act(() => setPracticeLiveChatAvailable(true));
		expect(result.current[0]).toBe(true);

		act(() => restartPracticeMode());
		expect(result.current[0]).toBe(false);

		act(() => setPracticeLiveChatAvailable(true));
		act(() => exitPracticeMode());
		expect(result.current).toBe(realAvailability);
		expect(getPracticeLiveChatAvailable()).toBe(false);

		act(() => enterPracticeMode({ tourId: TOUR }));
		expect(result.current[0]).toBe(false);
	});

	it('ignores a switch outside practice', () => {
		setPracticeLiveChatAvailable(true);
		expect(getPracticeLiveChatAvailable()).toBe(false);
		enterPracticeMode({ tourId: TOUR });
		expect(getPracticeLiveChatAvailable()).toBe(false);
	});
});
