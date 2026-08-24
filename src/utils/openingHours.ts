/**
 * Reader for the structured opening hours the admin panel writes.
 *
 * The admin stores slots as canonical JSON INSIDE the existing `openingHours`
 * string (ORISO-Admin decision "Option A", so no OpenAPI contract change). This
 * module is the read half: it turns that payload into human-readable text and
 * — just as important — passes anything else through untouched, because plenty
 * of Beratungsstellen still have their hours as hand-typed free text.
 *
 * Payload shape (mirrors `ORISO-Admin/src/utils/openingHours.ts`, version 1):
 *   { "version": 1, "openingHours": [{ fromDay, from, untilDay, until }, …] }
 * A weekday sits on BOTH edges, so a slot may legitimately cross midnight.
 */

const WEEKDAYS = [
	'MONDAY',
	'TUESDAY',
	'WEDNESDAY',
	'THURSDAY',
	'FRIDAY',
	'SATURDAY',
	'SUNDAY'
] as const;

type Weekday = (typeof WEEKDAYS)[number];

interface OpeningHoursSlot {
	fromDay: Weekday;
	from: string;
	untilDay: Weekday;
	until: string;
}

type Translate = (key: string, fallback?: string) => string;

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const WEEKDAY_FALLBACK: Record<Weekday, string> = {
	MONDAY: 'Monday',
	TUESDAY: 'Tuesday',
	WEDNESDAY: 'Wednesday',
	THURSDAY: 'Thursday',
	FRIDAY: 'Friday',
	SATURDAY: 'Saturday',
	SUNDAY: 'Sunday'
};

const isWeekday = (value: unknown): value is Weekday =>
	WEEKDAYS.includes(value as Weekday);

const isTime = (value: unknown): value is string =>
	typeof value === 'string' && TIME_PATTERN.test(value);

const toSlot = (entry: unknown): OpeningHoursSlot | null => {
	if (!entry || typeof entry !== 'object') {
		return null;
	}

	const { fromDay, from, untilDay, until } = entry as Record<string, unknown>;

	return isWeekday(fromDay) &&
		isTime(from) &&
		isWeekday(untilDay) &&
		isTime(until)
		? { fromDay, from, untilDay, until }
		: null;
};

const weekdayLabel = (day: Weekday, t: Translate): string =>
	t(`weekday.${day.toLowerCase()}`, WEEKDAY_FALLBACK[day]);

/**
 * Readable opening hours for display. Returns the input unchanged when it is
 * not a structured payload, so legacy free text keeps working — and returns an
 * empty string when the payload holds no usable slot, so raw JSON can never
 * reach the screen.
 */
export const formatOpeningHours = (
	value: string | undefined | null,
	t: Translate
): string => {
	const raw = (value ?? '').trim();

	if (raw === '') {
		return '';
	}

	let entries: unknown;

	try {
		entries = (JSON.parse(raw) as { openingHours?: unknown })?.openingHours;
	} catch {
		// Not our payload: hand the free text back exactly as it was entered.
		return raw;
	}

	if (!Array.isArray(entries)) {
		return '';
	}

	return entries
		.map(toSlot)
		.filter((slot): slot is OpeningHoursSlot => slot !== null)
		.map((slot) =>
			slot.fromDay === slot.untilDay
				? `${weekdayLabel(slot.fromDay, t)} ${slot.from}–${slot.until}`
				: `${weekdayLabel(slot.fromDay, t)} ${slot.from} – ${weekdayLabel(
						slot.untilDay,
						t
					)} ${slot.until}`
		)
		.join(' · ');
};
