// @vitest-environment oriso-jsdom
import * as React from 'react';
import { act, cleanup, render } from '@testing-library/react';
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';
import { CalendarPager, DWELL_MS, SWIPE_IDLE_MS } from './CalendarPager';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

beforeEach(() => {
	vi.useFakeTimers();
});
afterEach(() => {
	cleanup();
	vi.useRealTimers();
	vi.restoreAllMocks();
});

const swipe = (el: Element, deltaX: number) =>
	el.dispatchEvent(
		new WheelEvent('wheel', { deltaX, deltaY: 0, cancelable: true })
	);

describe('CalendarPager — trackpad swipe (review 4574775693)', () => {
	it('pages once for a swipe that keeps scrolling past one second', () => {
		const onPage = vi.fn();
		render(
			<CalendarPager onPage={onPage} data-cy="pager">
				<div />
			</CalendarPager>
		);
		const pager = document.querySelector('[data-cy="pager"]') as Element;
		// 1.2 s of continuous scrolling, one event every 40 ms.
		for (let t = 0; t < 1200; t += 40) {
			act(() => {
				swipe(pager, 30);
			});
			act(() => {
				vi.advanceTimersByTime(40);
			});
		}
		expect(onPage).toHaveBeenCalledTimes(1);
		// Quiet wheel ends the swipe; the next swipe pages again.
		act(() => {
			vi.advanceTimersByTime(SWIPE_IDLE_MS + 10);
		});
		act(() => {
			swipe(pager, 80);
		});
		expect(onPage).toHaveBeenCalledTimes(2);
	});
});

describe('CalendarPager — edge dwell while dragging (review 4574775698)', () => {
	const bounds = {
		left: 300,
		right: 1000,
		top: 100,
		bottom: 700,
		width: 700,
		height: 600,
		x: 300,
		y: 100,
		toJSON: () => ({})
	} as DOMRect;

	const dragAt = (clientX: number, clientY: number) => {
		vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
			bounds
		);
		const onPage = vi.fn();
		render(
			<CalendarPager onPage={onPage} dragging data-cy="pager">
				<div />
			</CalendarPager>
		);
		act(() => {
			document.dispatchEvent(
				new MouseEvent('mousemove', { clientX, clientY })
			);
		});
		act(() => {
			vi.advanceTimersByTime(DWELL_MS + 50);
		});
		return onPage;
	};

	it('pages when resting at the left edge of the grid', () => {
		expect(dragAt(320, 400)).toHaveBeenCalledWith(-1);
	});

	it('does not page over the sidebar left of the grid', () => {
		expect(dragAt(200, 400)).not.toHaveBeenCalled();
	});

	it('does not page below the grid', () => {
		expect(dragAt(320, 760)).not.toHaveBeenCalled();
	});
});
