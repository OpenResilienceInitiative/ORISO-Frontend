// @vitest-environment oriso-jsdom
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { CalendarSidebar } from './CalendarSidebar';
import type { CalendarEntry } from './calendarModel';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, options?: { name?: string }) =>
			options?.name ? `${key}:${options.name}` : key,
		i18n: { language: 'de' }
	})
}));

afterEach(cleanup);

// Monday 16 November 2026, 09:50.
const NOW = new Date(2026, 10, 16, 9, 50);
const at = (hour: number) => new Date(2026, 10, 16, hour).toISOString();
const APPOINTMENT: CalendarEntry = {
	id: 'a1',
	type: 'appointment',
	kind: 'video',
	title: 'mutige_eule',
	sessionId: 4402,
	start: at(11),
	end: at(12),
	ownerId: 'me'
};
const GROUP: CalendarEntry = {
	id: 'g1',
	type: 'group',
	kind: 'video',
	title: 'Gruppe Nord',
	start: at(14),
	end: at(15),
	ownerId: 'me'
};

const sidebar = (
	props: Partial<React.ComponentProps<typeof CalendarSidebar>>
) =>
	render(
		<CalendarSidebar
			ownerId="me"
			consultant
			now={NOW}
			entries={[APPOINTMENT, GROUP]}
			colleagues={[]}
			conversations={[{ sessionId: 4402, username: 'mutige_eule' }]}
			workingHours={[]}
			onlyFacets={[]}
			hiddenFacets={[]}
			onToggleFacet={() => undefined}
			onHighlightFacet={() => undefined}
			kindsMenuOpen={false}
			onOpenKinds={() => undefined}
			openProposals={[]}
			onOpenEntry={() => undefined}
			onShowEntry={() => undefined}
			shownColleagues={[]}
			{...props}
		/>
	);

describe('CalendarSidebar — "Als Nächstes" (Frank, prototype v15)', () => {
	it('has no extra chat button: "Zum Chat" is in the entry menu (Frank *4)', () => {
		sidebar({});
		expect(
			screen.queryByRole('button', { name: /calendar\.upcomingChat/ })
		).toBeNull();
	});

	it('opens its actions on click; "Zum Termin" there jumps (Frank, 2026-11-16)', () => {
		const onOpenEntry = vi.fn();
		const onShowEntry = vi.fn();
		sidebar({ onOpenEntry, onShowEntry });
		fireEvent.click(
			document.querySelector(
				'[data-cy="calendar-upcoming-a1"]'
			) as HTMLElement
		);
		expect(onShowEntry).not.toHaveBeenCalled();
		expect(onOpenEntry).toHaveBeenCalledWith(
			APPOINTMENT,
			expect.any(HTMLElement)
		);
	});

	it('lists the next five, nearest at the bottom', () => {
		const later = Array.from({ length: 6 }, (_, i) => ({
			...APPOINTMENT,
			id: `n${i}`,
			start: at(10 + i),
			end: at(10 + i) // replaced below
		})).map((e, i) => ({ ...e, end: at(11 + i) }));
		sidebar({ entries: later });
		const rows = Array.from(
			document.querySelectorAll('[data-cy^="calendar-upcoming-n"]')
		).map((el) => el.getAttribute('data-cy'));
		expect(rows).toEqual([
			'calendar-upcoming-n4',
			'calendar-upcoming-n3',
			'calendar-upcoming-n2',
			'calendar-upcoming-n1',
			'calendar-upcoming-n0'
		]);
	});
});

describe('CalendarSidebar — pill cards and "Jetzt" (prototype v17)', () => {
	it('shows the next ones as the Gespräche pills above a draggable "Jetzt" (Frank, 2026-11-16)', () => {
		sidebar({});
		const pill = document.querySelector(
			'[data-cy="calendar-upcoming-a1"]'
		) as HTMLElement;
		expect(pill.className).toContain('tlp__entry');
		expect(pill.querySelector('.tlp__entryIcon')).not.toBeNull();
		expect(
			document.querySelector(
				'[data-cy="calendar-upcoming"] [data-cy="timeline-now"] [role="separator"]'
			)
		).not.toBeNull();
	});

	it('keeps the avatar and kind badge per row in the narrow rail', () => {
		sidebar({ mode: 'rail' });
		const card = document.querySelector(
			'[data-cy="calendar-upcoming-a1"]'
		) as HTMLElement;
		const avatar = card.querySelector(
			'.calendarSide__avatar'
		) as HTMLElement;
		expect(avatar.textContent).toBe('ME');
		expect(avatar.className).toMatch(/calAvatar--tone-\d/);
		expect(
			card.querySelector('.calendarSide__leadKind svg')
		).not.toBeNull();
		const group = document.querySelector(
			'[data-cy="calendar-upcoming-g1"]'
		) as HTMLElement;
		expect(group.querySelector('.calendarSide__avatar')).toBeNull();
		expect(group.querySelector('.calendarSide__kdot svg')).not.toBeNull();
	});

	it('puts "Jetzt" between "Als Nächstes" and quick entry', () => {
		sidebar({ onCreate: () => true });
		const now = document.querySelector('[data-cy="timeline-now"]')!;
		expect(now.textContent).toBe('calendar.side.now');
		const pill = document.querySelector(
			'[data-cy="calendar-upcoming-a1"]'
		)!;
		const quick = document.querySelector('#calendar-quick-panel')!;
		expect(
			pill.compareDocumentPosition(now) & Node.DOCUMENT_POSITION_FOLLOWING
		).toBeTruthy();
		expect(
			now.compareDocumentPosition(quick) &
				Node.DOCUMENT_POSITION_FOLLOWING
		).toBeTruthy();
	});

	it('folds quick entry behind the "+" beside "Jetzt" in the sheet', () => {
		const onQuickToggle = vi.fn();
		sidebar({ onCreate: () => true, variant: 'sheet', onQuickToggle });
		const toggle = document.querySelector(
			'[data-cy="calendar-now"] [data-cy="calendar-quick-toggle"]'
		) as HTMLElement;
		expect(toggle.getAttribute('aria-expanded')).toBe('false');
		fireEvent.click(toggle);
		expect(onQuickToggle).toHaveBeenCalled();
		expect(
			document
				.querySelector('#calendar-quick-panel')
				?.hasAttribute('hidden')
		).toBe(true);
	});

	it('shows the working hours as a line with "Ändern"', () => {
		const onWorkingHours = vi.fn();
		sidebar({ onWorkingHours, workingHoursSummary: 'Mo–Fr 08:00–18:00' });
		const change = screen.getByRole('button', {
			name: 'calendar.workingHours.change'
		});
		expect(change.getAttribute('data-cy')).toBe('calendar-working-hours');
		expect(change.closest('.calendarSide__work')?.textContent).toContain(
			'calendar.workingHours.summary'
		);
		fireEvent.click(change);
		expect(onWorkingHours).toHaveBeenCalled();
	});

	it('hands a search result to the calendar instead of opening it', () => {
		const onShowEntry = vi.fn();
		const onOpenEntry = vi.fn();
		sidebar({ onShowEntry, onOpenEntry });
		fireEvent.change(screen.getByRole('searchbox'), {
			target: { value: 'nord' }
		});
		fireEvent.click(
			document.querySelector(
				'[data-cy="calendar-search-g1"]'
			) as HTMLElement
		);
		expect(onShowEntry).toHaveBeenCalledWith(GROUP);
		expect(onOpenEntry).not.toHaveBeenCalled();
		expect(
			document.querySelector('[data-cy="calendar-search-g1"]')
		).toBeNull();
	});

	it('finds only what the display filter shows (review 4589304604)', () => {
		sidebar({ onlyFacets: ['phone'] });
		fireEvent.change(screen.getByRole('searchbox'), {
			target: { value: 'nord' }
		});
		expect(
			document.querySelector('[data-cy="calendar-search-g1"]')
		).toBeNull();
		expect(screen.getByText('calendar.search.empty')).toBeTruthy();
		cleanup();
		sidebar({ hiddenFacets: ['group'] });
		fireEvent.change(screen.getByRole('searchbox'), {
			target: { value: 'nord' }
		});
		expect(
			document.querySelector('[data-cy="calendar-search-g1"]')
		).toBeNull();
		cleanup();
		sidebar({ onlyFacets: ['group'] });
		fireEvent.change(screen.getByRole('searchbox'), {
			target: { value: 'nord' }
		});
		expect(
			document.querySelector('[data-cy="calendar-search-g1"]')
		).not.toBeNull();
	});
});
