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
			shownColleagues={[]}
			{...props}
		/>
	);

describe('CalendarSidebar — "Als Nächstes" (Frank, prototype v15)', () => {
	it('offers "Zum Chat mit …" beside an appointment that has a chat, and goes there', () => {
		const onOpenChat = vi.fn();
		const onOpenEntry = vi.fn();
		sidebar({ onOpenChat, onOpenEntry });
		const chat = screen.getByRole('button', {
			name: 'calendar.upcomingChat:mutige_eule'
		});
		fireEvent.click(chat);
		expect(onOpenChat).toHaveBeenCalledWith(APPOINTMENT);
		expect(onOpenEntry).not.toHaveBeenCalled();
		// One button only: the group date has no chat of its own.
		expect(
			screen.getAllByRole('button', { name: /calendar\.upcomingChat/ })
		).toHaveLength(1);
	});

	it('still opens the entry when the row itself is clicked', () => {
		const onOpenEntry = vi.fn();
		sidebar({ onOpenChat: vi.fn(), onOpenEntry });
		fireEvent.click(
			document.querySelector(
				'[data-cy="calendar-upcoming-a1"]'
			) as HTMLElement
		);
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
