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

/** One time window of a day, as the form edits it. */
export interface ConsultationWindow {
	start: string;
	end: string;
}

/**
 * One weekday in the form (FE#2494 *2b): on or off, with as many windows
 * as the counsellor adds with "+". UserService stores several windows per
 * weekday as long as they do not overlap.
 */
export interface ConsultationDay {
	weekday: number;
	enabled: boolean;
	windows: ConsultationWindow[];
}

/** One day per weekday, Monday first; a day is on when it has a window. */
export const consultationDays = (windows: WorkingHours): ConsultationDay[] =>
	WEEKDAYS_MONDAY_FIRST.map((weekday) => {
		const own = windows
			.filter((w) => w.weekday === weekday)
			.sort((a, b) => minutesOf(a.start) - minutesOf(b.start))
			.map(({ start, end }) => ({ start, end }));
		return own.length
			? { weekday, enabled: true, windows: own }
			: { weekday, enabled: false, windows: [DEFAULT_CONSULTATION_DAY] };
	});

const pad = (n: number) => String(n).padStart(2, '0');
const timeOf = (minutes: number) =>
	`${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;

/**
 * The window "+" adds: right after the day's last one, two hours long and
 * at most until midnight; on a full evening, before the first one.
 */
export const nextConsultationWindow = (
	windows: ConsultationWindow[]
): ConsultationWindow => {
	const last = Math.max(0, ...windows.map((w) => minutesOf(w.end)));
	if (last <= 22 * 60)
		return {
			start: timeOf(last),
			end: timeOf(Math.min(last + 120, 23 * 60 + 45))
		};
	const first = Math.min(...windows.map((w) => minutesOf(w.start)));
	return { start: timeOf(Math.max(0, first - 120)), end: timeOf(first) };
};

/** The weekdays switched on with a window whose end is not after its start. */
export const invalidConsultationDays = (days: ConsultationDay[]) =>
	days
		.filter(
			(d) =>
				d.enabled &&
				d.windows.some(
					(w) => !validWindow({ weekday: d.weekday, ...w })
				)
		)
		.map((d) => d.weekday);

/** The weekdays switched on whose windows overlap each other. */
export const overlappingConsultationDays = (days: ConsultationDay[]) =>
	days
		.filter((d) => {
			if (!d.enabled) return false;
			const sorted = d.windows
				.filter((w) => validWindow({ weekday: d.weekday, ...w }))
				.sort((a, b) => minutesOf(a.start) - minutesOf(b.start));
			return sorted.some(
				(w, i) =>
					i > 0 && minutesOf(w.start) < minutesOf(sorted[i - 1].end)
			);
		})
		.map((d) => d.weekday);

/** The whole set UserService stores: every window of the days that are on. */
export const consultationHoursToApi = (
	days: ConsultationDay[],
	settings: ConsultationSettings
): ConsultationHours => ({
	windows: days
		.filter((d) => d.enabled)
		.flatMap(({ weekday, windows }) =>
			windows.map(({ start, end }) => ({ weekday, start, end }))
		)
		.sort(
			(a, b) =>
				a.weekday - b.weekday || minutesOf(a.start) - minutesOf(b.start)
		),
	autoAccept: settings.autoAccept,
	noticeDays: settings.noticeDays,
	slotMinutes: settings.slotMinutes
});

/**
 * A one-off Sprechzeit (FE#2494 *2b, Frank 23 Nov): a free stretch the
 * counsellor releases at short notice from the calendar, bookable until
 * `noticeMinutes` before its start, whatever the weekly notice says.
 */
export interface OneOffConsultation {
	/** Set once UserService stored it. */
	id?: string;
	start: Date;
	end: Date;
	noticeMinutes: number;
	/** Released over a Sperrzeit the counsellor was warned about. */
	overBlocker?: boolean;
}

/** UserService's `CalendarConsultationOnceDTO` as the calendar keeps it. */
export const oneOffFromApi = (dto: {
	id: string;
	start: string;
	end: string;
	noticeMinutes: number;
	overBlocker: boolean;
}): OneOffConsultation => ({
	id: dto.id,
	start: new Date(dto.start),
	end: new Date(dto.end),
	noticeMinutes: dto.noticeMinutes,
	overBlocker: dto.overBlocker
});

/** "Buchbar bis …" for a one-off Sprechzeit, in minutes before the start. */
export const ONE_OFF_NOTICE_MINUTES = [0, 30, 60, 120, 720, 1440] as const;
export const DEFAULT_ONE_OFF_NOTICE = 60;

/** A one-off save refused: it lies over a Sperrzeit and was not released over it. */
export const isConsultationOnceOverBlocker = (error: unknown) =>
	error instanceof Response &&
	error.status === 409 &&
	error.headers.get('X-Reason') === 'CONSULTATION_ONCE_OVER_BLOCKER';
