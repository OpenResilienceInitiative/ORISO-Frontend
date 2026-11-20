// @vitest-environment node
import { describe, expect, it } from 'vite-plus/test';
import { rangeTitleOf, viewOfFcType, FC_VIEW } from './calendarViews';

/** A day of November 2026 (or of `month`), at midnight. */
const nov = (day: number, month = 10) => new Date(2026, month, day);

describe('the range title above the grid (prototype v17)', () => {
	it('names the work week from Monday to Friday', () => {
		// FullCalendar's work week runs Monday to Monday with the weekend
		// hidden; the title still ends on Friday.
		expect(rangeTitleOf('workWeek', nov(16), nov(23), 'de-DE')).toBe(
			'16.–20. November 2026'
		);
	});

	it('names the full week, three days and the list by their days', () => {
		expect(rangeTitleOf('week', nov(16), nov(23), 'de-DE')).toBe(
			'16.–22. November 2026'
		);
		expect(rangeTitleOf('threeDays', nov(16), nov(19), 'de-DE')).toBe(
			'16.–18. November 2026'
		);
		expect(rangeTitleOf('list', nov(16), nov(30), 'de-DE')).toBe(
			'16.–29. November 2026'
		);
	});

	it('names both months when the range crosses into the next', () => {
		// Intl sets thin spaces around the dash.
		expect(
			rangeTitleOf('workWeek', nov(30), nov(7, 11), 'de-DE').replace(
				/\s/g,
				' '
			)
		).toBe('30. November – 4. Dezember 2026');
	});

	it('writes one day out in full', () => {
		expect(rangeTitleOf('day', nov(16), nov(17), 'de-DE')).toBe(
			'Montag, 16. November 2026'
		);
		// "Nebeneinander" with one day is a day as well.
		expect(rangeTitleOf('split', nov(16), nov(17), 'de-DE')).toBe(
			'Montag, 16. November 2026'
		);
	});

	it('names the month and its year', () => {
		expect(rangeTitleOf('month', nov(1), nov(1, 11), 'de-DE')).toBe(
			'November 2026'
		);
	});

	it('follows the app language', () => {
		const title = rangeTitleOf('day', nov(16), nov(17), 'en-GB');
		expect(title).toContain('Monday');
		expect(title).toContain('16 November 2026');
	});

	it("finds the view of FullCalendar's view type", () => {
		expect(viewOfFcType(FC_VIEW.workWeek)).toBe('workWeek');
		expect(viewOfFcType('somethingElse')).toBeUndefined();
	});
});
