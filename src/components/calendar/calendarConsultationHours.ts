/**
 * Sprechstunden (ORISO-Frontend#2287): the weekly windows advice seekers can
 * book themselves, separate from the working hours, and the three booking
 * settings. The dialog edits the first window of each weekday and keeps any
 * further ones; UserService checks the same limits again.
 */
import type { CalendarConsultationHoursDTO } from '../../api/apiCalendar';
import {
	isTime,
	minutesOf,
	WEEKDAYS_MONDAY_FIRST,
	type WorkingHours
} from './calendarWorkingHours';

export type SlotMinutes = 30 | 60;

export interface ConsultationSettings {
	/** A booking outside the notice period is confirmed at once. */
	autoAccept: boolean;
	/** Inside this many days before the start a booking is a request. */
	noticeDays: number;
	slotMinutes: SlotMinutes;
}

export interface ConsultationHours extends ConsultationSettings {
	windows: WorkingHours;
}

export const DEFAULT_CONSULTATION_SETTINGS: ConsultationSettings = {
	autoAccept: true,
	noticeDays: 1,
	slotMinutes: 60
};

export const MAX_NOTICE_DAYS = 30;

/** Where a day starts when it is switched on. */
export const DEFAULT_CONSULTATION_DAY = { start: '09:00', end: '12:00' };

export const isNoticeDays = (value: number) =>
	Number.isInteger(value) && value >= 0 && value <= MAX_NOTICE_DAYS;

const isSlotMinutes = (value: unknown): value is SlotMinutes =>
	value === 30 || value === 60;

const validWindow = (w: { weekday: number; start: string; end: string }) =>
	Number.isInteger(w.weekday) &&
	w.weekday >= 0 &&
	w.weekday <= 6 &&
	isTime(w.start) &&
	isTime(w.end) &&
	minutesOf(w.end) > minutesOf(w.start);

/** UserService's answer with its defaults; malformed parts are left out. */
export const consultationHoursFromApi = (
	dto: Partial<CalendarConsultationHoursDTO> | undefined
): ConsultationHours => ({
	windows: (dto?.windows ?? [])
		.filter(validWindow)
		.map(({ weekday, start, end }) => ({ weekday, start, end })),
	autoAccept: dto?.autoAccept ?? DEFAULT_CONSULTATION_SETTINGS.autoAccept,
	noticeDays:
		typeof dto?.noticeDays === 'number' && isNoticeDays(dto.noticeDays)
			? dto.noticeDays
			: DEFAULT_CONSULTATION_SETTINGS.noticeDays,
	slotMinutes: isSlotMinutes(dto?.slotMinutes)
		? dto.slotMinutes
		: DEFAULT_CONSULTATION_SETTINGS.slotMinutes
});

export interface ConsultationDayRow {
	weekday: number;
	enabled: boolean;
	start: string;
	end: string;
}

/** One row per weekday, Monday first; a day is on when it has a window. */
export const consultationRows = (windows: WorkingHours): ConsultationDayRow[] =>
	WEEKDAYS_MONDAY_FIRST.map((weekday) => {
		const window = windows.find((w) => w.weekday === weekday);
		return window
			? { weekday, enabled: true, start: window.start, end: window.end }
			: { weekday, enabled: false, ...DEFAULT_CONSULTATION_DAY };
	});

/** The weekdays switched on whose end is not after their start. */
export const invalidConsultationRows = (rows: ConsultationDayRow[]) =>
	rows.filter((r) => r.enabled && !validWindow(r)).map((r) => r.weekday);

/**
 * The weekdays whose edited window overlaps a further stored window of the
 * same day; UserService refuses overlapping windows of one day.
 */
export const overlappingConsultationRows = (
	rows: ConsultationDayRow[],
	stored: WorkingHours
) =>
	rows
		.filter(
			(r) =>
				r.enabled &&
				validWindow(r) &&
				stored
					.filter((w) => w.weekday === r.weekday)
					.slice(1)
					.some(
						(w) =>
							minutesOf(w.start) < minutesOf(r.end) &&
							minutesOf(w.end) > minutesOf(r.start)
					)
		)
		.map((r) => r.weekday);

/**
 * The whole set UserService stores. The dialog edits the first window of a
 * weekday; further windows of a day that stays on are kept as stored, so a
 * save never drops a window the dialog does not show (UserService allows
 * several per weekday that do not overlap).
 */
export const consultationHoursToApi = (
	rows: ConsultationDayRow[],
	settings: ConsultationSettings,
	stored: WorkingHours = []
): ConsultationHours => ({
	windows: rows
		.filter((r) => r.enabled)
		.flatMap(({ weekday, start, end }) => [
			{ weekday, start, end },
			...stored.filter((w) => w.weekday === weekday).slice(1)
		])
		.sort(
			(a, b) =>
				a.weekday - b.weekday || minutesOf(a.start) - minutesOf(b.start)
		),
	autoAccept: settings.autoAccept,
	noticeDays: settings.noticeDays,
	slotMinutes: settings.slotMinutes
});
