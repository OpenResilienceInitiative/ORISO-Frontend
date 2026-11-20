export interface AppointmentData {
	title: string;
	date: string;
	duration: number;
	location: string;
	note?: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

// The appointment contract carries an ISO instant. Never infer a timezone
// from the viewer's browser for a legacy or malformed payload.
const ISO_INSTANT =
	/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/i;

/**
 * A real day of a real month, and a real time of day.
 *
 * `ISO_INSTANT` only checks the SHAPE, and `new Date` is lenient: V8 reads
 * `2026-02-30T09:00:00Z` as the 2nd of March rather than returning NaN. The
 * card then showed a date nobody wrote and the `.ics` export carried the
 * original impossible string on to a calendar that may well reject it.
 */
const isRealCalendarInstant = (value: string): boolean => {
	const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/.exec(
		value
	);
	if (!parts) return false;
	const [year, month, day, hours, minutes, seconds] = parts
		.slice(1)
		.map((part) => (part === undefined ? 0 : Number(part)));
	if (month < 1 || month > 12) return false;
	// Day 0 of the month after is the last day of this one, leap years and all.
	const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
	return (
		day >= 1 &&
		day <= daysInMonth &&
		hours <= 23 &&
		minutes <= 59 &&
		seconds <= 59
	);
};

export const parseAppointmentData = (data: string): AppointmentData | null => {
	let value: unknown;
	try {
		value = JSON.parse(data);
	} catch {
		return null;
	}

	if (
		!isRecord(value) ||
		typeof value.title !== 'string' ||
		value.title.trim().length === 0 ||
		typeof value.date !== 'string' ||
		!ISO_INSTANT.test(value.date) ||
		!isRealCalendarInstant(value.date) ||
		Number.isNaN(new Date(value.date).getTime()) ||
		typeof value.duration !== 'number' ||
		!Number.isFinite(value.duration) ||
		value.duration <= 0 ||
		Number.isNaN(
			new Date(
				new Date(value.date).getTime() + value.duration * 60 * 1000
			).getTime()
		) ||
		typeof value.location !== 'string' ||
		(value.note !== undefined && typeof value.note !== 'string')
	) {
		return null;
	}

	const appointment: AppointmentData = {
		title: value.title,
		date: value.date,
		duration: value.duration,
		location: value.location
	};
	if (typeof value.note === 'string') {
		appointment.note = value.note;
	}
	return appointment;
};
