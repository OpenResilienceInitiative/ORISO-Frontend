import { describe, expect, it } from 'vite-plus/test';
import {
	consultationHoursFromApi,
	consultationHoursToApi,
	consultationDays,
	DEFAULT_CONSULTATION_DAY,
	invalidConsultationDays,
	isNoticeDays,
	nextConsultationWindow,
	oneOffFromApi,
	overlappingConsultationDays
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

	it('gives one day per weekday, Monday first, with all its windows', () => {
		const days = consultationDays([
			{ weekday: 3, start: '14:00', end: '16:00' },
			{ weekday: 3, start: '09:00', end: '10:00' }
		]);
		expect(days.map((d) => d.weekday)).toEqual([1, 2, 3, 4, 5, 6, 0]);
		expect(days.find((d) => d.weekday === 3)).toEqual({
			weekday: 3,
			enabled: true,
			windows: [
				{ start: '09:00', end: '10:00' },
				{ start: '14:00', end: '16:00' }
			]
		});
		expect(days.find((d) => d.weekday === 1)).toEqual({
			weekday: 1,
			enabled: false,
			windows: [DEFAULT_CONSULTATION_DAY]
		});
	});

	it('sends every window of the days that are on, sorted, with the three settings', () => {
		const days = consultationDays([]).map((d) =>
			d.weekday === 2
				? {
						...d,
						enabled: true,
						windows: [
							{ start: '16:00', end: '18:00' },
							{ start: '10:00', end: '11:30' }
						]
					}
				: d
		);
		expect(
			consultationHoursToApi(days, {
				autoAccept: false,
				noticeDays: 2,
				slotMinutes: 30
			})
		).toEqual({
			windows: [
				{ weekday: 2, start: '10:00', end: '11:30' },
				{ weekday: 2, start: '16:00', end: '18:00' }
			],
			autoAccept: false,
			noticeDays: 2,
			slotMinutes: 30
		});
	});

	it('keeps every stored window of a day through an edit (review on FE#2298)', () => {
		const stored = [
			{ weekday: 1, start: '09:00', end: '11:00' },
			{ weekday: 1, start: '14:00', end: '16:00' },
			{ weekday: 3, start: '09:00', end: '10:00' },
			{ weekday: 3, start: '15:00', end: '16:00' }
		];
		// Monday's first window is edited, Wednesday is switched off.
		const days = consultationDays(stored).map((d) =>
			d.weekday === 1
				? {
						...d,
						windows: d.windows.map((w, i) =>
							i === 0 ? { ...w, end: '12:00' } : w
						)
					}
				: d.weekday === 3
					? { ...d, enabled: false }
					: d
		);
		expect(
			consultationHoursToApi(days, {
				autoAccept: true,
				noticeDays: 1,
				slotMinutes: 60
			}).windows
		).toEqual([
			{ weekday: 1, start: '09:00', end: '12:00' },
			{ weekday: 1, start: '14:00', end: '16:00' }
		]);
	});

	it('names the days with a window whose end is not after the start', () => {
		const days = consultationDays([]).map((d) =>
			d.weekday === 4
				? {
						...d,
						enabled: true,
						windows: [{ start: '12:00', end: '12:00' }]
					}
				: d
		);
		expect(invalidConsultationDays(days)).toEqual([4]);
	});

	it('names the days whose windows overlap', () => {
		const days = consultationDays([
			{ weekday: 2, start: '09:00', end: '12:00' },
			{ weekday: 2, start: '11:00', end: '13:00' },
			{ weekday: 4, start: '09:00', end: '10:00' },
			{ weekday: 4, start: '10:00', end: '11:00' }
		]);
		expect(overlappingConsultationDays(days)).toEqual([2]);
	});

	it('puts a new window after the last one of the day, or before the first late at night', () => {
		expect(
			nextConsultationWindow([{ start: '09:00', end: '12:00' }])
		).toEqual({ start: '12:00', end: '14:00' });
		expect(
			nextConsultationWindow([{ start: '20:00', end: '23:00' }])
		).toEqual({ start: '18:00', end: '20:00' });
	});

	it('accepts 0 to 30 whole notice days', () => {
		expect([0, 1, 30].every(isNoticeDays)).toBe(true);
		expect([-1, 31, 1.5, Number.NaN].some(isNoticeDays)).toBe(false);
	});

	it('reads a one-off Sprechzeit of UserService (FE#2494 *2b)', () => {
		expect(
			oneOffFromApi({
				id: 'o1',
				start: '2026-11-24T13:00:00Z',
				end: '2026-11-24T14:30:00Z',
				noticeMinutes: 30,
				overBlocker: true
			})
		).toEqual({
			id: 'o1',
			start: new Date('2026-11-24T13:00:00Z'),
			end: new Date('2026-11-24T14:30:00Z'),
			noticeMinutes: 30,
			overBlocker: true
		});
	});
});
