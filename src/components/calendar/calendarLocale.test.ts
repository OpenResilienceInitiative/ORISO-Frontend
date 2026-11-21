import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vite-plus/test';
import { calendarLocale, fullCalendarLocale } from './calendarLocale';

describe('calendarLocale', () => {
	it('maps every app language to its own Intl locale', () => {
		expect(calendarLocale('de')).toBe('de-DE');
		expect(calendarLocale('de@informal')).toBe('de-DE');
		expect(calendarLocale('en')).toBe('en-GB');
		expect(calendarLocale('fr')).toBe('fr-FR');
		expect(calendarLocale('ru')).toBe('ru-RU');
		expect(calendarLocale('tr')).toBe('tr-TR');
		expect(calendarLocale('ti')).toBe('ti-ER');
	});

	it('falls back to German for an unknown or missing language', () => {
		expect(calendarLocale('xx')).toBe('de-DE');
		expect(calendarLocale(undefined)).toBe('de-DE');
	});

	it('falls back to English when the runtime lacks the language data', () => {
		const supported = vi
			.spyOn(Intl.DateTimeFormat, 'supportedLocalesOf')
			.mockReturnValue([]);
		expect(calendarLocale('ti')).toBe('en-GB');
		supported.mockRestore();
	});

	it('formats French weekdays in French, not German', () => {
		const monday = new Date(2026, 10, 16);
		expect(
			new Intl.DateTimeFormat(calendarLocale('fr'), {
				weekday: 'short'
			}).format(monday)
		).toBe('lun.');
	});
});

describe('fullCalendarLocale', () => {
	it('uses FullCalendar locale data for the supported languages', () => {
		expect(fullCalendarLocale('de@informal')).toBe('de');
		expect(fullCalendarLocale('en')).toBe('en-gb');
		expect(fullCalendarLocale('fr')).toBe('fr');
		expect(fullCalendarLocale('ru')).toBe('ru');
		expect(fullCalendarLocale('tr')).toBe('tr');
	});

	it('gives Tigrinya and unknown languages an explicit fallback', () => {
		expect(fullCalendarLocale('ti')).toBe('en-gb');
		expect(fullCalendarLocale('xx')).toBe('de');
	});
});

describe('one locale policy for the calendar', () => {
	it('leaves the choice of Intl locale to calendarLocale', () => {
		const folder = resolve(process.cwd(), 'src/components/calendar');
		const offenders = readdirSync(folder)
			.filter(
				(file) =>
					/\.tsx?$/.test(file) &&
					!/\.(test|stories)\.tsx?$/.test(file) &&
					file !== 'calendarLocale.ts'
			)
			.filter((file) =>
				/['"](de-DE|en-GB)['"]/.test(
					readFileSync(resolve(folder, file), 'utf8')
				)
			);
		expect(offenders).toEqual([]);
	});
});
