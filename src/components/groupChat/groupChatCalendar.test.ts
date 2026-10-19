// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	buildNeutralGroupChatCalendar,
	downloadNeutralGroupChatIcs
} from './groupChatCalendar';

describe('buildNeutralGroupChatCalendar', () => {
	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
		delete (URL as unknown as Record<string, unknown>).createObjectURL;
		delete (URL as unknown as Record<string, unknown>).revokeObjectURL;
	});

	it('creates content-neutral ICS and provider URLs', () => {
		const calendar = buildNeutralGroupChatCalendar({
			start: new Date('2026-08-04T18:00:00Z'),
			durationMinutes: 60,
			title: 'Online appointment',
			defaultTitle: 'Online appointment',
			eventId: 'series-42-occurrence-3'
		});

		expect(calendar.ics).toContain('SUMMARY:Online appointment');
		expect(calendar.ics).not.toMatch(/support|oriso|sucht/i);
		expect(calendar.googleUrl).toContain('calendar.google.com');
		expect(calendar.outlookUrl).toContain('outlook.live.com');
	});

	it('exports the dates a series has left, bounded and on its wall clock', () => {
		const input = {
			// Tuesday 18:00 in Berlin, five days before the DST change.
			start: new Date('2026-10-20T16:00:00Z'),
			durationMinutes: 90,
			title: 'Online appointment',
			defaultTitle: 'Online appointment',
			eventId: 'group-7'
		};
		const single = buildNeutralGroupChatCalendar(input);
		const series = buildNeutralGroupChatCalendar({
			...input,
			series: { repeat: 'BIWEEKLY', count: 3, timeZone: 'Europe/Berlin' }
		});

		// Three concrete dates, no open-ended rule: 18:00 local is 16:00 UTC
		// in summer time and 17:00 UTC after it.
		expect(series.ics.match(/^DTSTART:.*$/gm)).toEqual([
			'DTSTART:20261020T160000Z',
			'DTSTART:20261103T170000Z',
			'DTSTART:20261117T170000Z'
		]);
		expect(series.ics).not.toContain('RRULE');
		expect(single.ics.match(/^DTSTART:.*$/gm)).toHaveLength(1);
		// Google expands the rule in the group's zone, and COUNT ends it.
		const google = new URL(series.googleUrl).searchParams;
		expect(google.get('recur')).toBe(
			'RRULE:FREQ=WEEKLY;INTERVAL=2;COUNT=3'
		);
		expect(google.get('ctz')).toBe('Europe/Berlin');
		expect(google.get('dates')).toBe('20261020T180000/20261020T193000');
		expect(new URL(single.googleUrl).searchParams.get('recur')).toBeNull();
		// Outlook's web link cannot carry a rule; a single date would lie.
		expect(series.outlookUrl).toBeNull();
		// A series must not replace the single date already in a calendar.
		const uids = (ics: string) => ics.match(/^UID:.*$/gm) ?? [];
		expect(new Set(uids(series.ics)).size).toBe(3);
		expect(uids(series.ics)).not.toContain(uids(single.ics)[0]);
	});

	it('names every interval as a bounded rule', () => {
		const google = (repeat: 'QUARTERLY' | 'YEARLY' | 'DAILY') =>
			new URL(
				buildNeutralGroupChatCalendar({
					start: new Date('2026-01-06T17:00:00Z'),
					durationMinutes: 60,
					title: '',
					defaultTitle: 'Online appointment',
					eventId: 'group-7',
					series: { repeat, count: 4, timeZone: 'Not/AZone' }
				}).googleUrl
			).searchParams.get('recur');
		expect(google('QUARTERLY')).toBe(
			'RRULE:FREQ=MONTHLY;INTERVAL=3;COUNT=4'
		);
		expect(google('YEARLY')).toBe('RRULE:FREQ=YEARLY;COUNT=4');
		expect(google('DAILY')).toBe('RRULE:FREQ=DAILY;COUNT=4');
	});

	it('keeps a month-end series on the last day of short months', () => {
		const recur = (start: string, repeat: 'MONTHLY' | 'YEARLY') =>
			new URL(
				buildNeutralGroupChatCalendar({
					start: new Date(start),
					durationMinutes: 60,
					title: '',
					defaultTitle: 'Online appointment',
					eventId: 'group-7',
					series: { repeat, count: 3, timeZone: 'Europe/Berlin' }
				}).googleUrl
			).searchParams.get('recur');
		// 31 January 18:00 in Berlin: 28 February next, not March.
		expect(recur('2027-01-31T17:00:00Z', 'MONTHLY')).toBe(
			'RRULE:FREQ=MONTHLY;BYMONTHDAY=31,-1;BYSETPOS=1;COUNT=3'
		);
		expect(recur('2028-02-29T17:00:00Z', 'YEARLY')).toBe(
			'RRULE:FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=29,-1;BYSETPOS=1;COUNT=3'
		);
		expect(recur('2027-01-28T17:00:00Z', 'MONTHLY')).toBe(
			'RRULE:FREQ=MONTHLY;COUNT=3'
		);
		// The file carries the dates themselves: 31 Jan, 28 Feb, 31 Mar.
		const ics = buildNeutralGroupChatCalendar({
			start: new Date('2027-01-31T17:00:00Z'),
			durationMinutes: 60,
			title: '',
			defaultTitle: 'Online appointment',
			eventId: 'group-7',
			series: { repeat: 'MONTHLY', count: 3, timeZone: 'Europe/Berlin' }
		}).ics;
		expect(ics.match(/^DTSTART:.*$/gm)).toEqual([
			'DTSTART:20270131T170000Z',
			'DTSTART:20270228T170000Z',
			'DTSTART:20270331T160000Z'
		]);
	});

	it('escapes CRLF and punctuation without injecting ICS fields', () => {
		const calendar = buildNeutralGroupChatCalendar({
			start: new Date('2026-08-04T18:00:00Z'),
			durationMinutes: 60,
			title: 'Private, meeting; note\r\nLOCATION:leak',
			defaultTitle: 'Online appointment',
			eventId: 'series-42-occurrence-3'
		});

		expect(calendar.ics).toContain(
			'SUMMARY:Private\\, meeting\\; note\\nLOCATION:leak'
		);
		expect(calendar.ics).not.toContain('\r\nLOCATION:leak');
	});

	it('creates stable, distinct UIDs for different Series occurrences', () => {
		const input = {
			start: new Date('2026-08-04T18:00:00Z'),
			durationMinutes: 60,
			title: 'Online appointment',
			defaultTitle: 'Online appointment'
		};
		const first = buildNeutralGroupChatCalendar({
			...input,
			eventId: 'series-42-occurrence-3'
		});
		const repeated = buildNeutralGroupChatCalendar({
			...input,
			eventId: 'series-42-occurrence-3'
		});
		const second = buildNeutralGroupChatCalendar({
			...input,
			eventId: 'series-43-occurrence-3'
		});

		expect(first.ics.match(/UID:(.+)/)?.[1]).toBe(
			repeated.ics.match(/UID:(.+)/)?.[1]
		);
		expect(first.ics.match(/UID:(.+)/)?.[1]).not.toBe(
			second.ics.match(/UID:(.+)/)?.[1]
		);
	});

	it.each([Number.NaN, Number.POSITIVE_INFINITY, -1])(
		'rejects an invalid duration boundary (%s)',
		(durationMinutes) => {
			expect(() =>
				buildNeutralGroupChatCalendar({
					start: new Date('2026-08-04T18:00:00Z'),
					durationMinutes,
					title: 'Online appointment',
					defaultTitle: 'Online appointment',
					eventId: 42
				})
			).toThrow(
				'Calendar duration must be a finite, non-negative number'
			);
		}
	);

	it('uses the localized default title and folds long UTF-8 summary lines', () => {
		const calendar = buildNeutralGroupChatCalendar({
			start: new Date('2026-08-04T18:00:00Z'),
			durationMinutes: 60,
			title: '',
			defaultTitle: `Online-Termin ${'🙂'.repeat(40)}`,
			eventId: 42
		});
		const summaryLines = calendar.ics
			.split('\r\n')
			.filter(
				(line, index, lines) =>
					line.startsWith('SUMMARY:') ||
					(index > 0 &&
						line.startsWith(' ') &&
						(lines[index - 1].startsWith('SUMMARY:') ||
							lines[index - 1].startsWith(' ')))
			);

		expect(summaryLines[0]).toContain('Online-Termin');
		expect(summaryLines.length).toBeGreaterThan(1);
		summaryLines.forEach((line) =>
			expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(
				75
			)
		);
	});

	it('attaches the temporary download link and revokes it after the click', () => {
		vi.useFakeTimers();
		const createObjectURL = vi.fn(() => 'blob:calendar');
		const revokeObjectURL = vi.fn();
		Object.defineProperty(URL, 'createObjectURL', {
			configurable: true,
			value: createObjectURL
		});
		Object.defineProperty(URL, 'revokeObjectURL', {
			configurable: true,
			value: revokeObjectURL
		});
		const appendChild = vi.spyOn(document.body, 'appendChild');
		const remove = vi
			.spyOn(HTMLAnchorElement.prototype, 'remove')
			.mockImplementation(() => undefined);
		vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
			() => undefined
		);

		downloadNeutralGroupChatIcs('BEGIN:VCALENDAR\r\nEND:VCALENDAR');
		vi.runAllTimers();

		expect(createObjectURL).toHaveBeenCalledOnce();
		expect(appendChild).toHaveBeenCalledWith(expect.any(HTMLAnchorElement));
		expect(remove).toHaveBeenCalledOnce();
		expect(revokeObjectURL).toHaveBeenCalledWith('blob:calendar');
	});
});
