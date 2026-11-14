import { describe, expect, it } from 'vite-plus/test';
import {
	DEFAULT_PAUSE,
	MAX_WORKING_HOURS_WINDOWS,
	clampEdge,
	gripEdges,
	dialogWorkingHours,
	exceedsWindowLimit,
	dayEdgesOf,
	dayExceptionsFromApi,
	effectiveDay,
	exceptionWindowsToApi,
	groupWorkingHours,
	invalidRows,
	invalidPauses,
	isPauseValid,
	isWithinWorkingHours,
	moveEdge,
	normalizeWindows,
	offRangesOf,
	rowsToWorkingHours,
	withWeekdayWindows,
	workingHoursFromApi,
	workingHoursToApi,
	workingHoursToRows,
	workingPlanFromApi,
	workingPlanToApi,
	type WorkingHours,
	type WorkingPlan
} from './calendarWorkingHours';

const MON_FRI: WorkingHours = [1, 2, 3, 4, 5].map((weekday) => ({
	weekday,
	start: '08:00',
	end: '18:00'
}));

describe('calendarWorkingHours', () => {
	it('reads the windows sorted and drops malformed ones', () => {
		expect(
			workingHoursFromApi({
				windows: [
					{ weekday: 3, start: '09:00', end: '12:00' },
					{ weekday: 1, start: '13:00', end: '17:00' },
					{ weekday: 1, start: '08:00', end: '12:00' },
					{ weekday: 7, start: '08:00', end: '12:00' },
					{ weekday: 2, start: '8:00', end: '12:00' },
					{ weekday: 4, start: '12:00', end: '11:00' }
				]
			})
		).toEqual([
			{ weekday: 1, start: '08:00', end: '12:00' },
			{ weekday: 1, start: '13:00', end: '17:00' },
			{ weekday: 3, start: '09:00', end: '12:00' }
		]);
	});

	it('treats a missing body or list as no working hours', () => {
		expect(workingHoursFromApi(undefined)).toEqual([]);
		expect(workingHoursFromApi({})).toEqual([]);
	});

	it('writes the body UserService expects, Sunday numbered 0', () => {
		expect(
			workingHoursToApi([
				{ weekday: 0, start: '10:00', end: '12:00' },
				{ weekday: 6, start: '10:00', end: '12:00' }
			])
		).toEqual({
			windows: [
				{ weekday: 0, start: '10:00', end: '12:00' },
				{ weekday: 6, start: '10:00', end: '12:00' }
			]
		});
		expect(workingHoursToApi([])).toEqual({ windows: [] });
	});

	it('refuses more windows than UserService takes instead of cutting a day (review 5906218044)', () => {
		const full: WorkingHours = [0, 1, 2, 3, 4, 5, 6].flatMap((weekday) => [
			{ weekday, start: '08:00', end: '12:00' },
			{ weekday, start: '13:00', end: '18:00' }
		]);
		expect(full).toHaveLength(MAX_WORKING_HOURS_WINDOWS);
		expect(exceedsWindowLimit(full)).toBe(false);
		const over = [...full, { weekday: 0, start: '19:00', end: '20:00' }];
		expect(exceedsWindowLimit(over)).toBe(true);
		expect(() => workingHoursToApi(over)).toThrow(RangeError);
	});

	it('knows whether a range lies inside the hours', () => {
		// 16 November 2026 is a Monday, the 21st a Saturday.
		const at = (d: number, h: number, m = 0) => new Date(2026, 10, d, h, m);
		expect(isWithinWorkingHours(at(16, 9), at(16, 10), MON_FRI)).toBe(true);
		expect(isWithinWorkingHours(at(16, 17), at(16, 18), MON_FRI)).toBe(
			true
		);
		expect(isWithinWorkingHours(at(16, 17), at(16, 19), MON_FRI)).toBe(
			false
		);
		expect(isWithinWorkingHours(at(21, 9), at(21, 10), MON_FRI)).toBe(
			false
		);
		expect(isWithinWorkingHours(at(21, 9), at(21, 10), [])).toBe(true);
	});

	it('turns hours into one dialog row per weekday, Monday first', () => {
		const rows = workingHoursToRows(MON_FRI);
		expect(rows.map((r) => r.weekday)).toEqual([1, 2, 3, 4, 5, 6, 0]);
		expect(rows.filter((r) => r.enabled)).toHaveLength(5);
		expect(rows[5]).toEqual({
			weekday: 6,
			enabled: false,
			start: '08:00',
			end: '18:00',
			pause: { enabled: false, start: '12:00', end: '13:00' }
		});
	});

	it('spans two windows of one day in its row', () => {
		const rows = workingHoursToRows([
			{ weekday: 2, start: '08:00', end: '12:00' },
			{ weekday: 2, start: '13:00', end: '17:30' }
		]);
		expect(rows[1]).toEqual({
			weekday: 2,
			enabled: true,
			start: '08:00',
			end: '17:30',
			pause: { enabled: true, start: '12:00', end: '13:00' }
		});
	});

	it('turns the rows back into windows and flags reversed times', () => {
		const rows = workingHoursToRows(MON_FRI);
		rows[0] = { ...rows[0], end: '07:00' };
		expect(invalidRows(rows)).toEqual([1]);
		expect(rowsToWorkingHours(rows).map((w) => w.weekday)).toEqual([
			2, 3, 4, 5
		]);
	});

	it('groups equal days for the summary line', () => {
		expect(groupWorkingHours(MON_FRI)).toEqual([
			{
				weekdays: [1, 2, 3, 4, 5],
				start: '08:00',
				end: '18:00',
				contiguous: true
			}
		]);
		expect(
			groupWorkingHours([
				{ weekday: 1, start: '08:00', end: '12:00' },
				{ weekday: 3, start: '08:00', end: '12:00' }
			])[0].contiguous
		).toBe(false);
	});
});

describe('a pause per weekday (Frank, prototype v15)', () => {
	const week = (from: string, to: string, gap?: [string, string]) =>
		[1, 2, 3, 4, 5].flatMap((weekday) =>
			gap
				? [
						{ weekday, start: from, end: gap[0] },
						{ weekday, start: gap[1], end: to }
					]
				: [{ weekday, start: from, end: to }]
		);
	const pauses = (hours: WorkingHours) =>
		workingHoursToRows(hours).map((r) => r.pause);

	it('comes on at 12:00–13:00 for every day before any hours are set', () => {
		expect(pauses([])).toEqual(Array(7).fill(DEFAULT_PAUSE));
	});

	it('reads each day its own pause from the gap between its two windows', () => {
		const stored: WorkingHours = [
			{ weekday: 1, start: '08:00', end: '12:00' },
			{ weekday: 1, start: '13:00', end: '18:00' },
			{ weekday: 2, start: '08:00', end: '12:30' },
			{ weekday: 2, start: '13:15', end: '17:00' },
			{ weekday: 5, start: '08:00', end: '12:00' }
		];
		const [mon, tue, , , fri] = pauses(stored);
		expect(mon).toEqual({ enabled: true, start: '12:00', end: '13:00' });
		expect(tue).toEqual({ enabled: true, start: '12:30', end: '13:15' });
		expect(fri.enabled).toBe(false);
	});

	it("cuts only that day's pause out of that day", () => {
		const rows = workingHoursToRows(week('08:00', '17:00'));
		rows[0] = {
			...rows[0],
			pause: { enabled: true, start: '12:00', end: '12:45' }
		};
		rows[3] = {
			...rows[3],
			pause: { enabled: true, start: '13:00', end: '14:00' }
		};
		expect(
			rowsToWorkingHours(rows).filter((w) =>
				[1, 2, 4].includes(w.weekday)
			)
		).toEqual([
			{ weekday: 1, start: '08:00', end: '12:00' },
			{ weekday: 1, start: '12:45', end: '17:00' },
			{ weekday: 2, start: '08:00', end: '17:00' },
			{ weekday: 4, start: '08:00', end: '13:00' },
			{ weekday: 4, start: '14:00', end: '17:00' }
		]);
	});

	it('wants a pause inside the working time that ends after it starts', () => {
		const [row] = workingHoursToRows(week('08:00', '17:00'));
		const at = (start: string, end: string) => ({
			...row,
			pause: { enabled: true, start, end }
		});
		expect(isPauseValid(at('12:00', '13:00'))).toBe(true);
		expect(isPauseValid(at('13:00', '12:00'))).toBe(false);
		expect(isPauseValid(at('07:30', '08:30'))).toBe(false);
		expect(isPauseValid(at('16:30', '17:30'))).toBe(false);
		expect(
			isPauseValid({
				...row,
				pause: { ...DEFAULT_PAUSE, enabled: false }
			})
		).toBe(true);
		expect(invalidPauses([at('13:00', '12:00'), row])).toEqual([1]);
	});

	it('keeps the stored windows of days the dialog did not change (review 4574775742)', () => {
		const stored: WorkingHours = [
			{ weekday: 1, start: '08:00', end: '12:00' },
			{ weekday: 1, start: '13:00', end: '18:00' },
			{ weekday: 2, start: '08:00', end: '12:30' },
			{ weekday: 2, start: '13:30', end: '18:00' },
			// Three windows: more than one row can show.
			{ weekday: 4, start: '08:00', end: '10:00' },
			{ weekday: 4, start: '11:00', end: '12:00' },
			{ weekday: 4, start: '14:00', end: '18:00' }
		];
		const rows = workingHoursToRows(stored);
		expect(dialogWorkingHours(stored, rows)).toEqual(stored);
		// Changing Wednesday leaves the other days as they were.
		const edited = rows.map((r) =>
			r.weekday === 3
				? {
						...r,
						enabled: true,
						start: '09:00',
						end: '17:00',
						pause: { ...DEFAULT_PAUSE, enabled: false }
					}
				: r
		);
		expect(dialogWorkingHours(stored, edited)).toEqual([
			...stored.slice(0, 4),
			{ weekday: 3, start: '09:00', end: '17:00' },
			...stored.slice(4)
		]);
	});

	it('changes the pause of one day only', () => {
		const stored = week('08:00', '18:00', ['12:00', '13:00']);
		const rows = workingHoursToRows(stored).map((r) =>
			r.weekday === 2
				? {
						...r,
						pause: { enabled: true, start: '12:30', end: '13:30' }
					}
				: r
		);
		const saved = dialogWorkingHours(stored, rows);
		expect(saved.filter((w) => w.weekday === 2)).toEqual([
			{ weekday: 2, start: '08:00', end: '12:30' },
			{ weekday: 2, start: '13:30', end: '18:00' }
		]);
		expect(saved.filter((w) => w.weekday === 1)).toEqual([
			{ weekday: 1, start: '08:00', end: '12:00' },
			{ weekday: 1, start: '13:00', end: '18:00' }
		]);
	});

	it('round-trips a week with pauses through the dialog rows', () => {
		const stored = week('08:00', '18:00', ['12:00', '13:00']);
		expect(rowsToWorkingHours(workingHoursToRows(stored))).toEqual(
			stored.sort((a, b) => a.weekday - b.weekday)
		);
	});
});

// --- One date: exceptions, holidays, grips (contract v1.2) ---

const day = (d: number) => new Date(2026, 10, d);
const LUNCH_WEEK: WorkingHours = [1, 2, 3, 4, 5].flatMap((weekday) => [
	{ weekday, start: '08:00', end: '12:00' },
	{ weekday, start: '13:00', end: '18:00' }
]);

describe('calendarWorkingHours — working plan', () => {
	it('reads region and exceptions from UserService and sends both fields back', () => {
		const plan = workingPlanFromApi({
			windows: [{ weekday: 1, start: '08:00', end: '18:00' }],
			holidayRegion: 'SN',
			exceptions: [
				{
					date: '2026-11-16',
					windows: [
						{ start: '13:00', end: '18:00' },
						{ start: '07:30', end: '12:00' },
						{ start: '11:00', end: '11:30' }
					]
				},
				{ date: 'not a date', windows: [] },
				{ date: '2026-11-17', windows: [] }
			]
		});
		expect(plan.holidayRegion).toBe('SN');
		expect(plan.exceptions).toEqual({
			// sorted, the overlapping one dropped
			'2026-11-16': [
				{ start: '07:30', end: '12:00' },
				{ start: '13:00', end: '18:00' }
			],
			'2026-11-17': []
		});
		expect(workingPlanToApi(plan)).toEqual({
			windows: [{ weekday: 1, start: '08:00', end: '18:00' }],
			holidayRegion: 'SN'
		});
		expect(
			workingPlanFromApi({ windows: [], holidayRegion: 'XX' as never })
		).toEqual({ hours: [], exceptions: {}, holidayRegion: null });
		expect(workingPlanToApi({ hours: [] })).toEqual({
			windows: [],
			holidayRegion: null
		});
		expect(dayExceptionsFromApi(null)).toEqual({});
	});

	it('keeps at most four windows a date', () => {
		const five = ['07', '09', '11', '13', '15'].map((h) => ({
			start: `${h}:00`,
			end: `${h}:30`
		}));
		expect(normalizeWindows(five)).toHaveLength(4);
		expect(
			exceptionWindowsToApi([{ start: '18:00', end: '08:00' }])
		).toEqual([]);
	});

	it('takes the exception first, then the holiday, then the week', () => {
		const plan: WorkingPlan = {
			hours: LUNCH_WEEK,
			holidayRegion: 'SN',
			exceptions: { '2026-11-16': [{ start: '07:30', end: '18:00' }] }
		};
		expect(effectiveDay(day(16), plan)).toEqual({
			windows: [{ start: '07:30', end: '18:00' }],
			source: 'exception',
			holiday: undefined
		});
		// Buß- und Bettag in Saxony: the whole day off.
		const holiday = effectiveDay(day(18), plan);
		expect(holiday.source).toBe('holiday');
		expect(holiday.windows).toEqual([]);
		expect(holiday.holiday?.name).toBe('Buß- und Bettag');
		// Without a region the Wednesday is a normal working day.
		expect(
			effectiveDay(day(18), { ...plan, holidayRegion: null }).source
		).toBe('weekly');
		// An exception wins over the holiday.
		expect(
			effectiveDay(day(18), {
				...plan,
				exceptions: { '2026-11-18': [{ start: '09:00', end: '12:00' }] }
			}).source
		).toBe('exception');
		expect(effectiveDay(day(17), plan).windows).toHaveLength(2);
		expect(effectiveDay(day(17), []).source).toBe('none');
	});

	it('shades the day around its windows and marks where the grips sit', () => {
		expect(offRangesOf(day(17), LUNCH_WEEK)).toEqual([
			{ from: 0, to: 480, kind: 'off', edge: 'start' },
			{ from: 720, to: 780, kind: 'break' },
			{ from: 1080, to: 1440, kind: 'off', edge: 'end' }
		]);
		// Saturday: all day.
		expect(offRangesOf(day(21), LUNCH_WEEK)).toEqual([
			{ from: 0, to: 1440, kind: 'off' }
		]);
		// Nothing set: nothing shaded.
		expect(offRangesOf(day(17), [])).toEqual([]);
		expect(dayEdgesOf(day(17), LUNCH_WEEK)).toEqual(
			expect.objectContaining({
				start: '08:00',
				end: '18:00',
				exception: false
			})
		);
		expect(dayEdgesOf(day(21), LUNCH_WEEK)).toBeNull();
		expect(
			dayEdgesOf(day(16), {
				hours: LUNCH_WEEK,
				exceptions: { '2026-11-16': [{ start: '09:00', end: '17:00' }] }
			})?.exception
		).toBe(true);
	});

	it('moves an edge in quarter hours and keeps the lunch break', () => {
		const windows = [
			{ start: '08:00', end: '12:00' },
			{ start: '13:00', end: '18:00' }
		];
		expect(moveEdge(windows, 'start', '07:30')).toEqual([
			{ start: '07:30', end: '12:00' },
			{ start: '13:00', end: '18:00' }
		]);
		expect(moveEdge(windows, 'end', '16:45')).toEqual([
			{ start: '08:00', end: '12:00' },
			{ start: '13:00', end: '16:45' }
		]);
		// Past the break: the morning drops out.
		expect(moveEdge(windows, 'start', '13:30')).toEqual([
			{ start: '13:30', end: '18:00' }
		]);
		expect(moveEdge(windows, 'end', '11:00')).toEqual([
			{ start: '08:00', end: '11:00' }
		]);
		// At least an hour of work stays; snapped to 15 minutes.
		expect(moveEdge(windows, 'start', '17:50')).toEqual([
			{ start: '17:00', end: '18:00' }
		]);
		expect(clampEdge(windows, 'start', 7 * 60 + 52)).toBe(7 * 60 + 45);
		expect(clampEdge(windows, 'end', 23 * 60 + 59)).toBe(23 * 60 + 45);
		expect(clampEdge(windows, 'start', -30)).toBe(0);
		expect(moveEdge([], 'start', '08:00')).toEqual([]);
	});

	it('replaces the windows of one weekday', () => {
		expect(
			withWeekdayWindows(LUNCH_WEEK, 1, [
				{ start: '07:30', end: '12:00' },
				{ start: '13:00', end: '18:00' }
			]).filter((w) => w.weekday === 1)
		).toEqual([
			{ weekday: 1, start: '07:30', end: '12:00' },
			{ weekday: 1, start: '13:00', end: '18:00' }
		]);
		expect(withWeekdayWindows(LUNCH_WEEK, 2, [])).toHaveLength(8);
	});

	it('warns about the outside of exceptions and holidays too', () => {
		const at = (d: number, h: number) => new Date(2026, 10, d, h);
		const plan: WorkingPlan = {
			hours: LUNCH_WEEK,
			holidayRegion: 'SN',
			exceptions: { '2026-11-16': [{ start: '10:00', end: '14:00' }] }
		};
		expect(isWithinWorkingHours(at(16, 9), at(16, 10), plan)).toBe(false);
		expect(isWithinWorkingHours(at(16, 12), at(16, 13), plan)).toBe(true);
		expect(isWithinWorkingHours(at(18, 9), at(18, 10), plan)).toBe(false);
		expect(isWithinWorkingHours(at(17, 9), at(17, 10), plan)).toBe(true);
	});
});

describe('pause grips (Frank, prototype v15)', () => {
	const DAY = [
		{ start: '08:00', end: '12:00' },
		{ start: '13:00', end: '16:00' }
	];

	it('gives a day with two windows grips at both ends of its pause', () => {
		const edges = dayEdgesOf(new Date(2026, 10, 16), [
			{ weekday: 1, ...DAY[0] },
			{ weekday: 1, ...DAY[1] }
		]);
		expect(edges && gripEdges(edges)).toEqual([
			{ edge: 'start', time: '08:00' },
			{ edge: 'pauseStart', time: '12:00' },
			{ edge: 'pauseEnd', time: '13:00' },
			{ edge: 'end', time: '16:00' }
		]);
	});

	it('keeps the pause a quarter hour long and inside the working time', () => {
		expect(clampEdge(DAY, 'pauseStart', 13 * 60)).toBe(12 * 60 + 45);
		expect(clampEdge(DAY, 'pauseStart', 7 * 60)).toBe(8 * 60 + 15);
		expect(clampEdge(DAY, 'pauseEnd', 12 * 60)).toBe(12 * 60 + 15);
		expect(clampEdge(DAY, 'pauseEnd', 17 * 60)).toBe(15 * 60 + 45);
	});

	it('moves only the pause', () => {
		expect(moveEdge(DAY, 'pauseStart', '11:30')).toEqual([
			{ start: '08:00', end: '11:30' },
			{ start: '13:00', end: '16:00' }
		]);
		expect(moveEdge(DAY, 'pauseEnd', '13:30')).toEqual([
			{ start: '08:00', end: '12:00' },
			{ start: '13:30', end: '16:00' }
		]);
	});
});
