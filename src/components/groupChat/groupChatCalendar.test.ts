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
