// @vitest-environment oriso-jsdom
/**
 * Who is shown (prototype v17): the header names "ich" and the shown
 * colleagues and opens "Kalender anzeigen"; that menu groups colleagues by
 * Beratungsstelle; the people bar appears only while someone is shown or
 * was shown lately.
 */
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
// Controls by role and name, so a lost name or role fails the test
// (review 4589304569); avatars and layout keep their structural selectors.
const who = () =>
	screen.getByRole('button', { name: /calendar\.people\.label/ });
const openPeopleMenu = () => fireEvent.click(who());
const chip = (name: RegExp) => screen.getByRole('button', { name });
const menuPerson = (name: RegExp) =>
	screen.getByRole('menuitemcheckbox', { name });
const KAYA = /A\. Kaya/;

describe('CalendarPage — colleagues with the same name (test finding C12)', () => {
	it('names the Beratungsstelle on chips whose names repeat', () => {
		const twins: Colleague[] = [
			{
				id: 'bart1',
				displayName: 'Bart Simpson',
				agencyName: 'Beratungsstelle Nord',
				relation: 'sameAgency'
			},
			{
				id: 'bart2',
				displayName: 'Bart Simpson',
				agencyName: 'Beratungsstelle Süd',
				relation: 'sameTenant'
			},
			{
				id: 'lisa',
				displayName: 'Lisa Simpson',
				agencyName: 'Beratungsstelle Nord',
				relation: 'sameAgency'
			}
		];
		page({ colleagues: twins });
		expect(cy('calendar-person-bart1')?.textContent).toContain(
			'Beratungsstelle Nord'
		);
		expect(cy('calendar-person-bart2')?.textContent).toContain(
			'Beratungsstelle Süd'
		);
		// A unique name needs no second hint.
		expect(cy('calendar-person-lisa')?.textContent).not.toContain(
			'Beratungsstelle'
		);
	});
});

describe('CalendarPage — shown colleagues survive a reload (test finding C20)', () => {
	it('shows the same colleagues switched on after a reload', () => {
		page();
		openPeopleMenu();
		fireEvent.click(menuPerson(KAYA));
		cleanup();
		const shown = vi.fn();
		page({ onShownColleaguesChange: shown });
		expect(chip(KAYA).getAttribute('aria-pressed')).toBe('true');
		expect(shown).toHaveBeenCalledWith(['kaya']);
	});

	it('drops a remembered colleague who is no longer in reach', () => {
		page();
		openPeopleMenu();
		fireEvent.click(menuPerson(KAYA));
		cleanup();
		const shown = vi.fn();
		page({
			colleagues: COLLEAGUES.filter((c) => c.id !== 'kaya'),
			onShownColleaguesChange: shown
		});
		expect(shown).not.toHaveBeenCalledWith(['kaya']);
		expect(screen.queryByRole('button', { name: KAYA })).toBeNull();
	});

	it('starts with nobody shown once every colleague was hidden again', () => {
		page();
		openPeopleMenu();
		fireEvent.click(menuPerson(KAYA));
		fireEvent.click(menuPerson(KAYA));
		cleanup();
		const shown = vi.fn();
		page({ onShownColleaguesChange: shown });
		expect(shown).not.toHaveBeenCalled();
	});
});

describe('CalendarPage — who is shown (prototype v17)', () => {
	it('shows no people bar while nobody is shown or was shown lately', () => {
		page({ colleagues: [] });
		expect(cy('calendar-people-bar')).toBeNull();
		cleanup();
		// Before anyone was shown, the first colleagues stand in as the
		// ones shown lately: dashed chips, one click shows them.
		page();
		expect(cy('calendar-people-bar')).not.toBeNull();
		expect(chip(KAYA).className).toContain('calendarStage__person--off');
		fireEvent.click(chip(KAYA));
		expect(chip(KAYA).getAttribute('aria-pressed')).toBe('true');
		expect(chip(/^calendar\.people\.me/).getAttribute('data-cy')).toBe(
			'calendar-person-me'
		);
		// Hidden again, A. Kaya stays as a dashed chip.
		fireEvent.click(chip(KAYA));
		expect(chip(KAYA).className).toContain('calendarStage__person--off');
	});

	it('names "ich" and the shown colleagues in the header, and says "Termine"', () => {
		page();
		const header = who();
		expect(header.getAttribute('data-cy')).toBe('calendar-who');
		expect(header.textContent).toContain('navigation.booking.events');
		expect(header.querySelectorAll('.calendarStage__avatar')).toHaveLength(
			1
		);
		expect(header.querySelector('.calAvatar--me')!.textContent).toBe(
			'calendar.people.meAvatar'
		);
		cleanup();
		page({ initialShownColleagues: ['kaya', 'weber'] });
		const shared = who();
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
		const own = menuPerson(
			/navigation\.booking\.events/
		) as HTMLButtonElement;
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
		fireEvent.click(
			screen.getByRole('menuitem', {
				name: /calendar\.people\.wholeAgency/
			})
		);
		expect(onShownColleaguesChange).toHaveBeenLastCalledWith([
			'kaya',
			'osei'
		]);
		// The menu stays open; Escape closes it and the bar is in reach.
		fireEvent.keyDown(document.activeElement ?? document.body, {
			key: 'Escape'
		});
		const pressed = (name: RegExp) =>
			chip(name).getAttribute('aria-pressed');
		expect([
			pressed(KAYA),
			pressed(/K\. Osei/),
			pressed(/J\. Weber/)
		]).toEqual(['true', 'true', 'false']);
	});

	it('offers "Kolleg:innen wählen" in an empty "Nebeneinander"', () => {
		page({ initialView: 'split' });
		const own = document.querySelector('.calendarSplit__avatar')!;
		expect(own.className).toContain('calAvatar--me');
		expect(own.textContent).toBe('calendar.people.meAvatar');
		fireEvent.click(
			screen.getByRole('button', { name: 'calendar.split.choose' })
		);
		expect(menuPerson(/navigation\.booking\.events/)).toBeTruthy();
		fireEvent.click(menuPerson(KAYA));
		expect(
			screen.queryByRole('button', { name: 'calendar.split.choose' })
		).toBeNull();
	});

	it('opens "Nebeneinander" from the menu', () => {
		page();
		openPeopleMenu();
		fireEvent.click(
			screen.getByRole('menuitem', { name: /calendar\.people\.split/ })
		);
		expect(cy('calendar-view-menu')!.textContent).toContain(
			'calendar.views.split'
		);
	});
});
