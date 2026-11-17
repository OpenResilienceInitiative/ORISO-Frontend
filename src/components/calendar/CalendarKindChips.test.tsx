// @vitest-environment oriso-jsdom
import * as React from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import type { CalendarEntry } from './calendarModel';
import { CalendarKindChips } from './CalendarSidebar';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: { language: 'de' }
	})
}));

afterEach(cleanup);

const PHONE: CalendarEntry = {
	id: 'a1',
	type: 'appointment',
	kind: 'phone',
	start: new Date(2026, 10, 16, 10).toISOString(),
	end: new Date(2026, 10, 16, 11).toISOString(),
	ownerId: 'me'
};

const chips = (
	props: Partial<React.ComponentProps<typeof CalendarKindChips>>
) => {
	render(
		<CalendarKindChips
			ownerId="me"
			now={new Date(2026, 10, 16, 9)}
			entries={[PHONE]}
			onlyFacets={[]}
			onToggleFacet={() => undefined}
			onHighlightFacet={() => undefined}
			{...props}
		/>
	);
	return Array.from(
		document.querySelectorAll<HTMLElement>('[data-cy^="calendar-filter-"]')
	);
};
const ids = (list: HTMLElement[]) =>
	list.map((chip) => chip.getAttribute('data-cy'));

describe('CalendarKindChips — five round chips, one kind at a time (prototype v17)', () => {
	it('always offers the five kinds, whatever the range holds', () => {
		expect(ids(chips({}))).toEqual([
			'calendar-filter-video',
			'calendar-filter-phone',
			'calendar-filter-onsite',
			'calendar-filter-chat',
			'calendar-filter-blocker'
		]);
	});

	it('keeps all five on offer while one kind is chosen (reviews 4574504546, 4574493851)', () => {
		const list = chips({ onlyFacets: ['video'] });
		expect(list).toHaveLength(5);
		expect(ids(list)).toContain('calendar-filter-video');
		expect(list[0].getAttribute('aria-pressed')).toBe('true');
	});

	it('names and counts the chosen kind only', () => {
		const list = chips({ onlyFacets: ['phone'] });
		const phone = list[1];
		expect(phone.getAttribute('aria-pressed')).toBe('true');
		expect(
			phone.querySelector('.calendarSide__kindChipCount')?.textContent
		).toBe('1');
		expect(
			list.filter((chip) =>
				chip.querySelector('.calendarSide__kindChipCount')
			)
		).toHaveLength(1);
		// Every chip still says which kind it is.
		expect(list[0].textContent).toBe('calendar.kinds.video');
		expect(list[4].textContent).toBe('calendar.blocker.menuItem');
	});

	it('switches the chosen kind off before choosing another', () => {
		let only: string[] = ['video', 'group'];
		const onToggleFacet = vi.fn((facet: string) => {
			only = only.includes(facet)
				? only.filter((f) => f !== facet)
				: [...only, facet];
		});
		const list = chips({
			onlyFacets: ['video', 'group'],
			onToggleFacet
		});
		fireEvent.click(list[1]);
		expect(only).toEqual(['phone']);
	});

	it('shows all again when the chosen chip is clicked once more', () => {
		const onToggleFacet = vi.fn();
		const list = chips({ onlyFacets: ['chat'], onToggleFacet });
		fireEvent.click(list[3]);
		expect(onToggleFacet.mock.calls).toEqual([['chat']]);
	});
});
