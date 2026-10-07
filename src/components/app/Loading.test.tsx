// @vitest-environment jsdom
import * as React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Loading } from './Loading';

describe('Loading', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		// Canvas is unavailable in jsdom; the real renderer handles that case.
		vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
			null
		);
	});

	afterEach(() => {
		cleanup();
		vi.restoreAllMocks();
		vi.useRealTimers();
	});

	it('delays a short load but keeps an ongoing operation visible', () => {
		render(<Loading label="Wird geladen" delayMs={200} />);
		expect(screen.queryByRole('status')).toBeNull();
		act(() => vi.advanceTimersByTime(200));
		expect(screen.getByRole('status').textContent).toBe('Wird geladen');
		act(() => vi.advanceTimersByTime(10000));
		expect(screen.getByRole('status').textContent).toBe('Wird geladen');
	});

	it('announces the visible label once with a decorative orbital animation', () => {
		const { container, rerender } = render(
			<Loading label="Wir schauen, wer gerade live ist …" delayMs={0} />
		);
		expect(screen.getAllByRole('status')).toHaveLength(1);
		expect(screen.getByRole('status').textContent).toBe(
			'Wir schauen, wer gerade live ist …'
		);
		expect(
			container.querySelector('canvas')?.closest('[aria-hidden="true"]')
		).not.toBeNull();
		rerender(
			<Loading label="Wir warten auf eine freie Stelle …" delayMs={0} />
		);
		expect(screen.getByRole('status').textContent).toBe(
			'Wir warten auf eine freie Stelle …'
		);
	});

	it('does not flash after a short operation has already finished', () => {
		const { unmount } = render(<Loading label="Wird geladen" />);
		unmount();
		act(() => vi.advanceTimersByTime(10000));
		expect(screen.queryByRole('status')).toBeNull();
	});
});
