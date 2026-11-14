// @vitest-environment oriso-jsdom
import * as React from 'react';
import { cleanup, render } from '@testing-library/react';
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
			hiddenFacets={[]}
			onToggleFacet={() => undefined}
			onHighlightFacet={() => undefined}
			{...props}
		/>
	);
	return Array.from(
		document.querySelectorAll('[data-cy^="calendar-filter-"]')
	).map((chip) => chip.getAttribute('data-cy'));
};

describe('CalendarKindChips — a selected kind stays (reviews 4574504546, 4574493851)', () => {
	it('keeps the video chip after the range holds only phone entries', () => {
		expect(chips({ onlyFacets: ['video'] })).toEqual([
			'calendar-filter-video',
			'calendar-filter-phone'
		]);
	});

	it('keeps a selected kind that the display filter hides', () => {
		expect(
			chips({ onlyFacets: ['phone'], hiddenFacets: ['phone'] })
		).toEqual(['calendar-filter-phone']);
	});
});
