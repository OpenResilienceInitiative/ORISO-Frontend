// @vitest-environment jsdom
import React, { useEffect } from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getTourHostHooks } from '../components/productTour/tourHostHooks';
import { PracticeLayer } from './PracticeLayer';
import {
	enterPracticeMode,
	exitPracticeMode,
	isPracticeMode
} from './practiceMode';
import { usePractice } from './PracticeProvider';

afterEach(() => {
	cleanup();
	exitPracticeMode();
});

const Probe = () => {
	const { isPractice } = usePractice();
	return <p data-testid="probe">{String(isPractice)}</p>;
};

describe('PracticeLayer', () => {
	it('registers the host hooks of both practice tours at app start, and removes them again', () => {
		const { unmount } = render(
			<PracticeLayer>
				<Probe />
			</PracticeLayer>
		);
		expect(getTourHostHooks('consultant-practice-accept')).toBeDefined();
		expect(
			getTourHostHooks('consultant-practice-supervision')
		).toBeDefined();

		unmount();

		expect(getTourHostHooks('consultant-practice-accept')).toBeUndefined();
		expect(
			getTourHostHooks('consultant-practice-supervision')
		).toBeUndefined();
	});

	it('adds nothing to the page while practice is off: no markup, no fetch patch, no request, no storage', async () => {
		const pageFetch = vi.fn(async () => new Response('{}'));
		window.fetch = pageFetch as typeof window.fetch;
		const setItem = vi.spyOn(Storage.prototype, 'setItem');
		const page = <main data-testid="app">app</main>;
		const plain = render(page).container.innerHTML;
		cleanup();

		const view = render(<PracticeLayer>{page}</PracticeLayer>);
		await act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));

		expect(view.container.innerHTML).toBe(plain);
		expect(window.fetch).toBe(pageFetch);
		expect(pageFetch).not.toHaveBeenCalled();
		expect(setItem).not.toHaveBeenCalled();
		expect(isPracticeMode()).toBe(false);
		setItem.mockRestore();
	});

	it('provides practice state to everything below it', () => {
		render(
			<PracticeLayer>
				<Probe />
			</PracticeLayer>
		);
		expect(screen.getByTestId('probe').textContent).toBe('false');

		act(() => enterPracticeMode({ tourId: 'consultant-practice-accept' }));

		expect(screen.getByTestId('probe').textContent).toBe('true');
	});

	it('does not remount what it wraps when practice starts or ends (navigation must not either)', () => {
		const mounted = vi.fn();
		const Mount = () => {
			useEffect(mounted, []);
			return null;
		};
		render(
			<PracticeLayer>
				<Mount />
			</PracticeLayer>
		);

		act(() => enterPracticeMode({ tourId: 'consultant-practice-accept' }));
		act(() => exitPracticeMode());

		expect(mounted).toHaveBeenCalledTimes(1);
	});

	it('ends practice when the authenticated app goes away', async () => {
		const { unmount } = render(
			<PracticeLayer>
				<Probe />
			</PracticeLayer>
		);
		act(() => enterPracticeMode({ tourId: 'consultant-practice-accept' }));

		unmount();
		await act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));

		expect(isPracticeMode()).toBe(false);
	});
});
