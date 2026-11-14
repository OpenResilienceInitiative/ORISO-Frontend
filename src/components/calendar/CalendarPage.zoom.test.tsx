// @vitest-environment oriso-jsdom
/**
 * Zoom (Frank, prototype v15): − and + at the right end of the date bar
 * change the height of half an hour; Ctrl + wheel (trackpad pinch), Safari's
 * gestures and two fingers zoom smoothly. Not in month and list.
 */
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { CalendarPage } from './CalendarPage';
import type { CalendarViewName } from './calendarViews';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: { language: 'de' }
	})
}));

if (typeof window.ResizeObserver === 'undefined')
	window.ResizeObserver = class {
		observe() {}
		unobserve() {}
		disconnect() {}
	} as unknown as typeof ResizeObserver;
if (!HTMLElement.prototype.scrollTo)
	HTMLElement.prototype.scrollTo = () => undefined;

afterEach(() => {
	cleanup();
	localStorage.clear();
});

const NOW = new Date(2026, 10, 16, 9, 0);

const page = (initialView: CalendarViewName) =>
	render(
		<CalendarPage
			role="consultant"
			ownerId="me"
			now={NOW}
			entries={[]}
			initialView={initialView}
			onCreate={() => true}
			onSaveWorkingHours={() => true}
		/>
	);

const zoomGroup = () =>
	screen.queryByRole('group', { name: 'calendar.zoomLabel' });
const zoomIn = () => screen.getByRole('button', { name: 'calendar.zoomIn' });
const zoomOut = () => screen.getByRole('button', { name: 'calendar.zoomOut' });

/** Pixels per hour in "Nebeneinander", from where its hour lines sit. */
const hourPx = () => {
	const lines = document.querySelectorAll<HTMLElement>(
		'.calendarSplit__line'
	);
	return parseFloat(lines[1].style.top) - parseFloat(lines[0].style.top);
};
const splitBody = () =>
	document.querySelector<HTMLElement>('.calendarSplit__body')!;

/** Two fingers, `gap` pixels apart vertically. */
const touch = (type: string, gap: number) => {
	const event = new Event(type, { bubbles: true, cancelable: true });
	const touches = [
		{ clientX: 100, clientY: 200 },
		{ clientX: 100, clientY: 200 + gap }
	];
	Object.defineProperty(event, 'touches', { value: touches });
	fireEvent(splitBody(), event);
	return event;
};

describe('CalendarPage — zoom', () => {
	it.each<CalendarViewName>([
		'day',
		'threeDays',
		'workWeek',
		'week',
		'split'
	])('offers − and + in the %s view', (view) => {
		page(view);
		expect(zoomGroup()).not.toBeNull();
	});

	it.each<CalendarViewName>(['month', 'list'])(
		'has no zoom in the %s view',
		(view) => {
			page(view);
			expect(zoomGroup()).toBeNull();
		}
	);

	it("steps from today's height, side by side as well, and stops at 18 and 96", () => {
		page('split');
		expect(hourPx()).toBe(48);
		fireEvent.click(zoomIn());
		expect(hourPx()).toBe(60);
		fireEvent.click(zoomOut());
		expect(hourPx()).toBe(44);
		fireEvent.click(zoomOut());
		expect(hourPx()).toBe(36);
		expect((zoomOut() as HTMLButtonElement).disabled).toBe(true);
		for (let i = 0; i < 6; i++) fireEvent.click(zoomIn());
		expect(hourPx()).toBe(192);
		expect((zoomIn() as HTMLButtonElement).disabled).toBe(true);
	});

	it('zooms with a trackpad pinch (Ctrl + wheel) and leaves the plain wheel alone', () => {
		page('split');
		const plain = new WheelEvent('wheel', {
			deltaY: -40,
			bubbles: true,
			cancelable: true
		});
		fireEvent(splitBody(), plain);
		expect(hourPx()).toBe(48);
		expect(plain.defaultPrevented).toBe(false);
		const pinch = new WheelEvent('wheel', {
			deltaY: -20,
			ctrlKey: true,
			bubbles: true,
			cancelable: true
		});
		fireEvent(splitBody(), pinch);
		// 24 · e^0.2 = 29.3 px per half hour.
		expect(hourPx()).toBeCloseTo(58.6, 1);
		expect(pinch.defaultPrevented).toBe(true);
	});

	it("zooms with Safari's pinch gesture, relative to where it started", () => {
		page('split');
		fireEvent(
			splitBody(),
			new Event('gesturestart', { bubbles: true, cancelable: true })
		);
		const change = (scale: number) => {
			const event = new Event('gesturechange', {
				bubbles: true,
				cancelable: true
			});
			Object.assign(event, { scale, clientY: 200 });
			fireEvent(splitBody(), event);
		};
		change(1.5);
		expect(hourPx()).toBe(72);
		change(2);
		expect(hourPx()).toBe(96);
		fireEvent(splitBody(), new Event('gestureend', { bubbles: true }));
	});

	it('zooms with two fingers on a touch screen', () => {
		page('split');
		touch('touchstart', 100);
		const move = touch('touchmove', 150);
		expect(hourPx()).toBe(72);
		expect(move.defaultPrevented).toBe(true);
		touch('touchend', 150);
	});
});
