// @vitest-environment oriso-jsdom
/**
 * Who is shown (prototype v17): the header names "ich" and the shown
 * colleagues and opens "Kalender anzeigen"; that menu groups colleagues by
 * Beratungsstelle; the people bar appears only while someone is shown or
 * was shown lately.
 */
import * as React from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { CalendarPage, type CalendarPageProps } from './CalendarPage';
import type { Colleague } from './calendarModel';

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

const COLLEAGUES: Colleague[] = [
	{
		id: 'kaya',
		displayName: 'A. Kaya',
		agencyName: 'Beratungsstelle Nord',
		agencyShort: 'BN',
		relation: 'sameAgency'
	},
	{
		id: 'weber',
		displayName: 'J. Weber',
		agencyName: 'Beratungsstelle Süd',
		agencyShort: 'BS',
		relation: 'sameTenant'
	},
	{
		id: 'osei',
		displayName: 'K. Osei',
		agencyName: 'Beratungsstelle Nord',
		agencyShort: 'BN',
		relation: 'sameAgency'
	}
];

const page = (props: Partial<CalendarPageProps> = {}) =>
	render(
		<CalendarPage
			role="consultant"
			ownerId="me"
			now={new Date(2026, 10, 16, 9)}
			entries={[]}
			colleagues={COLLEAGUES}
			{...props}
		/>
	);

const cy = (id: string) =>
	document.querySelector<HTMLElement>(`[data-cy="${id}"]`);
const openPeopleMenu = () => fireEvent.click(cy('calendar-who')!);

describe('CalendarPage — who is shown (prototype v17)', () => {
	it('shows no people bar while nobody is shown or was shown lately', () => {
		page({ colleagues: [] });
		expect(cy('calendar-people-bar')).toBeNull();
		cleanup();
		// Before anyone was shown, the first colleagues stand in as the
		// ones shown lately: dashed chips, one click shows them.
		page();
		expect(cy('calendar-people-bar')).not.toBeNull();
		expect(cy('calendar-person-kaya')!.className).toContain(
			'calendarStage__person--off'
		);
		fireEvent.click(cy('calendar-person-kaya')!);
		expect(cy('calendar-person-kaya')!.getAttribute('aria-pressed')).toBe(
			'true'
		);
		expect(cy('calendar-person-me')!.textContent).toContain(
			'calendar.people.me'
		);
		// Hidden again, A. Kaya stays as a dashed chip.
		fireEvent.click(cy('calendar-person-kaya')!);
		expect(cy('calendar-person-kaya')!.className).toContain(
			'calendarStage__person--off'
		);
	});

	it('names "ich" and the shown colleagues in the header, and says "Termine"', () => {
		page();
		const who = cy('calendar-who')!;
		expect(who.textContent).toContain('navigation.booking.events');
		expect(who.querySelectorAll('.calendarStage__avatar')).toHaveLength(1);
		expect(who.querySelector('.calAvatar--me')!.textContent).toBe(
			'calendar.people.meAvatar'
		);
		cleanup();
		page({ initialShownColleagues: ['kaya', 'weber'] });
		const shared = cy('calendar-who')!;
		expect(shared.textContent).toContain('calendar.header.shared');
		expect(
			Array.from(shared.querySelectorAll('.calendarStage__avatar')).map(
				(a) => a.textContent
			)
		).toEqual(['calendar.people.meAvatar', 'AK', 'JW']);
	});

	it('groups the colleagues by Beratungsstelle, after one’s own calendar', () => {
		page();
		openPeopleMenu();
		const own = cy('calendar-people-me') as HTMLButtonElement;
		expect(own.disabled).toBe(true);
		expect(own.getAttribute('aria-checked')).toBe('true');
		const labels = Array.from(
			document.querySelectorAll('.chatMenuDropdown__groupLabel')
		).map((l) => l.textContent);
		expect(labels).toEqual([
			'Beratungsstelle Nord · BN',
			'Beratungsstelle Süd · BS · calendar.people.sameTenant'
		]);
		const rows = Array.from(
			own
				.closest('[role="menu"]')!
				.querySelectorAll('[data-cy^="calendar-people-"]')
		).map((r) => r.getAttribute('data-cy'));
		expect(rows).toEqual([
			'calendar-people-me',
			'calendar-people-kaya',
			'calendar-people-osei',
			'calendar-people-weber',
			'calendar-people-whole-agency',
			'calendar-people-split'
		]);
	});

	it('shows the whole own Beratungsstelle at once', () => {
		const onShownColleaguesChange = vi.fn();
		page({ onShownColleaguesChange });
		openPeopleMenu();
		fireEvent.click(cy('calendar-people-whole-agency')!);
		expect(onShownColleaguesChange).toHaveBeenLastCalledWith([
			'kaya',
			'osei'
		]);
		const pressed = (id: string) =>
			cy(`calendar-person-${id}`)?.getAttribute('aria-pressed');
		expect([pressed('kaya'), pressed('osei'), pressed('weber')]).toEqual([
			'true',
			'true',
			'false'
		]);
	});

	it('offers "Kolleg:innen wählen" in an empty "Nebeneinander"', () => {
		page({ initialView: 'split' });
		const own = document.querySelector('.calendarSplit__avatar')!;
		expect(own.className).toContain('calAvatar--me');
		expect(own.textContent).toBe('calendar.people.meAvatar');
		const choose = cy('calendar-split-choose')!;
		expect(choose.textContent).toBe('calendar.split.choose');
		fireEvent.click(choose);
		expect(cy('calendar-people-me')).not.toBeNull();
		fireEvent.click(cy('calendar-people-kaya')!);
		expect(cy('calendar-split-choose')).toBeNull();
	});

	it('opens "Nebeneinander" from the menu', () => {
		page();
		openPeopleMenu();
		fireEvent.click(cy('calendar-people-split')!);
		expect(cy('calendar-view-menu')!.textContent).toContain(
			'calendar.views.split'
		);
	});
});
