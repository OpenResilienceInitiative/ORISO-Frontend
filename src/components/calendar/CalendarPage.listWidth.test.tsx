// @vitest-environment oriso-jsdom
/**
 * The left column sized like "Gespräche" (Frank, prototype v15): 420 px to
 * begin with, the grip of the session list, snaps to the rail (80), the
 * compact list (220) or 397–500, remembered per person.
 */
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { CalendarPage } from './CalendarPage';
import type { CalendarEntry } from './calendarModel';

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
const LATER: CalendarEntry = {
	id: 'a1',
	type: 'appointment',
	kind: 'video',
	title: 'mutige_eule',
	sessionId: 4402,
	start: new Date(2026, 10, 16, 11, 0).toISOString(),
	end: new Date(2026, 10, 16, 12, 0).toISOString(),
	ownerId: 'me'
};

const page = () =>
	render(
		<CalendarPage
			role="consultant"
			ownerId="me"
			now={NOW}
			entries={[LATER]}
			onCreate={() => true}
			onSaveWorkingHours={() => true}
		/>
	);
const frame = () =>
	document.querySelector<HTMLElement>('[data-cy="calendar-side-frame"]')!;
const grip = () =>
	screen.getByRole('separator', { name: 'calendar.side.resize' });
const quickPanel = () =>
	document.querySelector<HTMLElement>('#calendar-quick-panel')!;
const drag = (toX: number) => {
	fireEvent(
		grip(),
		new MouseEvent('pointerdown', {
			bubbles: true,
			button: 0,
			clientX: 420
		})
	);
	fireEvent(
		document,
		new MouseEvent('pointermove', { bubbles: true, clientX: toX })
	);
	fireEvent(document, new MouseEvent('pointerup', { bubbles: true }));
};

describe('CalendarPage — the list column, sized like "Gespräche"', () => {
	it('opens 420 px wide with the session-list grip, between rail and 500 px', () => {
		page();
		expect(frame().style.width).toBe('420px');
		expect(grip().classList).toContain('sessionsList__resizeHandle');
		expect(grip().getAttribute('aria-valuenow')).toBe('420');
		expect(grip().getAttribute('aria-valuemin')).toBe('80');
		expect(grip().getAttribute('aria-valuemax')).toBe('500');
	});

	it('keeps the grip on the column, outside the list that scrolls', () => {
		page();
		const list = document.querySelector('[data-cy="calendar-side"]')!;
		expect(grip().parentElement).toBe(frame());
		expect(list.contains(grip())).toBe(false);
	});

	it('folds to the rail on double-click: avatar and start time per appointment', () => {
		page();
		fireEvent.doubleClick(grip());
		expect(frame().style.width).toBe('80px');
		const row = document.querySelector(
			'[data-cy="calendar-upcoming-a1"]'
		) as HTMLElement;
		expect(row.querySelector('.calendarSide__avatar')?.textContent).toBe(
			'ME'
		);
		expect(row.querySelector('.calendarSide__railClock')?.textContent).toBe(
			'11:00'
		);
		expect(quickPanel().hidden).toBe(true);
		// And back out to the wide list.
		fireEvent.doubleClick(grip());
		expect(frame().style.width).toBe('397px');
		expect(quickPanel().hidden).toBe(false);
	});

	it('snaps a sideways drag to the compact list, without quick entry and working hours', () => {
		page();
		drag(250);
		expect(frame().style.width).toBe('220px');
		expect(quickPanel().hidden).toBe(true);
		expect(
			document.querySelector('[data-cy="calendar-working-hours"]')
		).toBeNull();
		// "+" opens the list wide again with the line ready.
		fireEvent.click(
			document.querySelector(
				'[data-cy="calendar-quick-widen"]'
			) as HTMLElement
		);
		expect(frame().style.width).toBe('420px');
		expect(document.activeElement).toBe(
			document.querySelector('[data-cy="calendar-quick-input"]')
		);
	});

	it('snaps a drag between compact and wide to the wide minimum', () => {
		page();
		drag(330);
		expect(frame().style.width).toBe('397px');
	});

	it('takes the keys of the grip and remembers the width per person', () => {
		const first = page();
		fireEvent.keyDown(grip(), { key: 'End' });
		expect(frame().style.width).toBe('500px');
		first.unmount();
		page();
		expect(frame().style.width).toBe('500px');
		fireEvent.keyDown(grip(), { key: 'ArrowLeft' });
		expect(frame().style.width).toBe('480px');
		fireEvent.keyDown(grip(), { key: 'Home' });
		expect(frame().style.width).toBe('80px');
	});
});
