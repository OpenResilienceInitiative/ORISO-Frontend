import { describe, expect, it } from 'vite-plus/test';
import {
	consultationHoursFromApi,
	consultationHoursToApi,
	consultationRows,
	invalidConsultationRows,
	isNoticeDays
} from './calendarConsultationHours';

describe('Sprechstunden (FE#2287)', () => {
	it('fills the defaults the backend uses when nothing is set', () => {
		expect(consultationHoursFromApi(undefined)).toEqual({
			windows: [],
			autoAccept: true,
			noticeDays: 1,
			slotMinutes: 60
		});
		expect(
			consultationHoursFromApi({
				windows: [{ weekday: 2, start: '09:00', end: '12:00' }],
				autoAccept: false,
				noticeDays: 3,
				slotMinutes: 30
			})
		).toEqual({
			windows: [{ weekday: 2, start: '09:00', end: '12:00' }],
			autoAccept: false,
			noticeDays: 3,
			slotMinutes: 30
		});
	});

	it('leaves malformed windows and an unknown slot length out', () => {
		expect(
			consultationHoursFromApi({
				windows: [
					{ weekday: 9, start: '09:00', end: '12:00' },
					{ weekday: 1, start: '12:00', end: '09:00' }
				],
				slotMinutes: 45 as never
			})
		).toMatchObject({ windows: [], slotMinutes: 60 });
	});

	it('gives one row per weekday, Monday first, on where a window is set', () => {
		const rows = consultationRows([
			{ weekday: 3, start: '14:00', end: '16:00' }
		]);
		expect(rows.map((r) => r.weekday)).toEqual([1, 2, 3, 4, 5, 6, 0]);
		expect(rows.find((r) => r.weekday === 3)).toEqual({
			weekday: 3,
			enabled: true,
			start: '14:00',
			end: '16:00'
		});
		expect(rows.find((r) => r.weekday === 1)?.enabled).toBe(false);
	});

	it('sends only the days that are on, with the three settings', () => {
		const rows = consultationRows([]).map((r) =>
			r.weekday === 2
				? { ...r, enabled: true, start: '10:00', end: '11:30' }
				: r
		);
		expect(
			consultationHoursToApi(rows, {
				autoAccept: false,
				noticeDays: 2,
				slotMinutes: 30
			})
		).toEqual({
			windows: [{ weekday: 2, start: '10:00', end: '11:30' }],
			autoAccept: false,
			noticeDays: 2,
			slotMinutes: 30
		});
	});

	it('keeps a second window of a weekday the dialog does not show (review on FE#2298)', () => {
		const stored = [
			{ weekday: 1, start: '09:00', end: '11:00' },
			{ weekday: 1, start: '14:00', end: '16:00' },
			{ weekday: 3, start: '09:00', end: '10:00' },
			{ weekday: 3, start: '15:00', end: '16:00' }
		];
		// Monday's first window is edited, Wednesday is switched off.
		const rows = consultationRows(stored).map((r) =>
			r.weekday === 1
				? { ...r, end: '12:00' }
				: r.weekday === 3
					? { ...r, enabled: false }
					: r
		);
		expect(
			consultationHoursToApi(
				rows,
				{ autoAccept: true, noticeDays: 1, slotMinutes: 60 },
				stored
			).windows
		).toEqual([
			{ weekday: 1, start: '09:00', end: '12:00' },
			{ weekday: 1, start: '14:00', end: '16:00' }
		]);
	});

	it('names the days whose end is not after the start', () => {
		const rows = consultationRows([]).map((r) =>
			r.weekday === 4
				? { ...r, enabled: true, start: '12:00', end: '12:00' }
				: r
		);
		expect(invalidConsultationRows(rows)).toEqual([4]);
	});

	it('accepts 0 to 30 whole notice days', () => {
		expect([0, 1, 30].every(isNoticeDays)).toBe(true);
		expect([-1, 31, 1.5, Number.NaN].some(isNoticeDays)).toBe(false);
	});
});
