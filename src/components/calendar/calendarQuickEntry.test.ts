import { describe, expect, it } from 'vite-plus/test';
import {
	fieldsFromEntry,
	nearestDuration,
	parseQuickEntry,
	quickEntryGaps,
	rangeFromFields
} from './calendarQuickEntry';

// Monday 16 November 2026, 09:50.
const now = new Date(2026, 10, 16, 9, 50);
const at = (day: number, h: number, m = 0) => new Date(2026, 10, day, h, m);
const conversations = [
	{ sessionId: 4401, username: 'ruhiges_yak' },
	{ sessionId: 4402, username: 'mutige_eule' }
];

describe('parseQuickEntry', () => {
	it('reads weekday, hour and kind in German', () => {
		const entry = parseQuickEntry('Do 14 Uhr Video', { now });
		expect(entry).toEqual({
			kind: 'video',
			start: at(19, 14),
			end: at(19, 15)
		});
	});

	it('reads the free-hour pills in both languages', () => {
		expect(parseQuickEntry('morgen 9:00', { now }).start).toEqual(
			at(17, 9)
		);
		expect(parseQuickEntry('tomorrow 9:00', { now }).start).toEqual(
			at(17, 9)
		);
		expect(parseQuickEntry('Mi 9:00', { now }).start).toEqual(at(18, 9));
		expect(parseQuickEntry('Wed 09:00', { now }).start).toEqual(at(18, 9));
	});

	it('reads a range, a date and a conversation', () => {
		expect(
			parseQuickEntry('18.11. 10-11:30 Telefon mutige', {
				now,
				conversations
			})
		).toEqual({
			kind: 'phone',
			start: at(18, 10),
			end: at(18, 11, 30),
			sessionId: 4402
		});
	});

	it('gives a chat half an hour and moves a past hour to tomorrow', () => {
		const entry = parseQuickEntry('8 Uhr chat', { now });
		expect(entry.start).toEqual(at(17, 8));
		expect(entry.end).toEqual(at(17, 8, 30));
	});

	it('understands pm and a picked kind', () => {
		const entry = parseQuickEntry('tomorrow 2pm', { now, kind: 'blocker' });
		expect(entry.kind).toBe('blocker');
		expect(entry.start).toEqual(at(17, 14));
	});
});

describe('quickEntryGaps', () => {
	it('names what is missing', () => {
		expect(quickEntryGaps({})).toEqual(['when', 'kind']);
		expect(
			quickEntryGaps({ kind: 'video', start: at(17, 9), end: at(17, 10) })
		).toEqual(['who']);
		expect(
			quickEntryGaps({
				kind: 'blocker',
				start: at(17, 9),
				end: at(17, 10)
			})
		).toEqual([]);
	});
});

describe('quick entry fields', () => {
	it('prefills only what the line names', () => {
		expect(fieldsFromEntry({})).toEqual({});
		expect(fieldsFromEntry({ start: at(19, 14), end: at(19, 15) })).toEqual(
			{ date: '2026-11-19', time: '14:00', duration: 60 }
		);
		// 14:00–15:20 is closest to 90 minutes.
		expect(
			fieldsFromEntry({ start: at(19, 14), end: at(19, 15, 20) }).duration
		).toBe(90);
		expect(fieldsFromEntry({ start: at(19, 14) })).toEqual({
			date: '2026-11-19',
			time: '14:00'
		});
	});

	it('saves from the fields, with the chosen duration', () => {
		expect(
			rangeFromFields({ date: '2026-11-19', time: '14:00', duration: 45 })
		).toEqual({ start: at(19, 14), end: at(19, 14, 45) });
		expect(
			rangeFromFields({ date: '2026-11-19', time: '' })
		).toBeUndefined();
		expect(rangeFromFields({ time: '14:00' })).toBeUndefined();
	});

	it('rounds a typed length to the nearest choice', () => {
		expect(nearestDuration(20)).toBe(30);
		expect(nearestDuration(50)).toBe(45);
		expect(nearestDuration(120)).toBe(90);
	});
});
