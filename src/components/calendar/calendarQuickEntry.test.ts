import { describe, expect, it } from 'vite-plus/test';
import de from '../../resources/i18n/de/common.json';
import en from '../../resources/i18n/en/common.json';
import fr from '../../resources/i18n/fr/common.json';
import ru from '../../resources/i18n/ru/common.json';
import ti from '../../resources/i18n/ti/common.json';
import tr from '../../resources/i18n/tr/common.json';
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
			sessionId: 4402,
			endGiven: true
		});
	});

	it('rejects minutes past 59 instead of rolling them over (review 4574775701)', () => {
		expect(parseQuickEntry('morgen 9:90 blocker', { now }).start).toBe(
			undefined
		);
		expect(
			parseQuickEntry('morgen 9:00-10:75 blocker', { now }).end
		).toBe(undefined);
	});

	it('prefers the exact username and refuses an ambiguous part (review 4574775704)', () => {
		const owls = [
			{ sessionId: 1, username: 'mutige_eule' },
			{ sessionId: 2, username: 'eule' },
			{ sessionId: 3, username: 'stille_eule' }
		];
		expect(
			parseQuickEntry('morgen 10 Video eule', { now, conversations: owls })
				.sessionId
		).toBe(2);
		expect(
			parseQuickEntry('morgen 10 Video mutige', {
				now,
				conversations: owls
			}).sessionId
		).toBe(1);
		expect(
			parseQuickEntry('morgen 10 Video _eule', {
				now,
				conversations: owls.filter((c) => c.sessionId !== 2)
			}).sessionId
		).toBeUndefined();
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
		expect(
			fieldsFromEntry({
				start: at(19, 14),
				end: at(19, 15),
				endGiven: true
			})
		).toEqual({ date: '2026-11-19', time: '14:00', duration: 60 });
		// 14:00–15:20 is closest to 90 minutes.
		expect(
			fieldsFromEntry({
				start: at(19, 14),
				end: at(19, 15, 20),
				endGiven: true
			}).duration
		).toBe(90);
		expect(fieldsFromEntry({ start: at(19, 14) })).toEqual({
			date: '2026-11-19',
			time: '14:00'
		});
	});

	it('keeps the chosen duration when the line names only a start (review 4574775708)', () => {
		const typed = parseQuickEntry('morgen 14 Uhr', { now });
		expect(fieldsFromEntry(typed)).toEqual({
			date: '2026-11-17',
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

describe('quick entry placeholder examples (review 4574779949)', () => {
	const LANGUAGES = { de, en, fr, ru, ti, tr } as Record<
		string,
		{
			calendar: {
				quick: { placeholder: string };
				kinds: Record<string, string>;
			};
		}
	>;
	/** Languages whose weekday names the parser does not read. */
	const OTHER = { fr: 'fr-FR', ru: 'ru-RU', ti: 'ti-ER', tr: 'tr-TR' };
	const words = (text: string) =>
		text
			.toLowerCase()
			.split(/[\s,]+/)
			.map((w) => w.replace(/\.$/, ''))
			.filter(Boolean);

	it.each(Object.entries(OTHER))(
		'%s names no weekday the parser cannot read',
		(language, locale) => {
			const names = [15, 16, 17, 18, 19, 20, 21].flatMap((day) =>
				(['short', 'long'] as const).map((weekday) =>
					new Intl.DateTimeFormat(locale, { weekday })
						.format(new Date(2026, 10, day))
						.toLowerCase()
						.replace(/\.$/, '')
				)
			);
			const example = words(
				LANGUAGES[language].calendar.quick.placeholder
			);
			expect(example.filter((w) => names.includes(w))).toEqual([]);
		}
	);

	it.each(Object.keys(LANGUAGES))(
		'%s names only kinds the parser reads, at 14:00',
		(language) => {
			const { placeholder } = LANGUAGES[language].calendar.quick;
			const parsed = parseQuickEntry(placeholder, { now });
			expect(parsed.start?.getHours()).toBe(14);
			Object.entries(LANGUAGES[language].calendar.kinds)
				.filter(([, label]) =>
					words(placeholder).includes(label.toLowerCase())
				)
				.forEach(([kind]) => expect(parsed.kind).toBe(kind));
		}
	);
});
