// @vitest-environment oriso-jsdom
import * as React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import type { CalendarEntry } from './calendarModel';
import { CalendarSplitView } from './CalendarSplitView';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: { language: 'de' }
	})
}));

afterEach(cleanup);

// jsdom has no element scrolling.
if (!HTMLElement.prototype.scrollTo)
	HTMLElement.prototype.scrollTo = () => undefined;

const MONDAY = new Date(2026, 10, 16);
const HOURS = { hours: [{ weekday: 1, start: '08:00', end: '16:00' }] };
/** A blocked time the display filter hides. */
const HIDDEN: CalendarEntry = {
	id: 'b1',
	type: 'blocker',
	start: new Date(2026, 10, 16, 9).toISOString(),
	end: new Date(2026, 10, 16, 12).toISOString(),
	ownerId: 'me'
};

const freeSpans = (container: HTMLElement) =>
	Array.from(
		container.querySelectorAll<HTMLElement>('.calendarSplit__free')
	).map((span) => [span.style.top, span.style.height]);

describe('CalendarSplitView — "alle frei"', () => {
	it('counts an entry the display filter hides as busy (review 4574733782)', () => {
		const { container } = render(
			<CalendarSplitView
				day={MONDAY}
				role="consultant"
				ownerId="me"
				colleagues={[]}
				entries={[]}
				busyEntries={[HIDDEN]}
				now={new Date(2026, 10, 16, 7)}
				workingPlan={HOURS}
			/>
		);
		// 08–09 and 12–16, at 48 px an hour from 07:00; not 08–16.
		expect(freeSpans(container)).toEqual([
			['48px', '48px'],
			['240px', '192px']
		]);
	});

	it('falls back to the shown entries without busy entries', () => {
		const { container } = render(
			<CalendarSplitView
				day={MONDAY}
				role="consultant"
				ownerId="me"
				colleagues={[]}
				entries={[HIDDEN]}
				now={new Date(2026, 10, 16, 7)}
				workingPlan={HOURS}
			/>
		);
		expect(freeSpans(container)).toHaveLength(2);
	});
});
