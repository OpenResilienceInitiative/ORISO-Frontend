import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

interface GroupChatStartFields {
	startDateWithTime?: string;
	startDate?: string;
	startTime?: string;
	timezone?: string;
}

/** True when the value already carries a Z or ±HH:MM offset. */
const hasExplicitOffset = (value: string): boolean =>
	/[zZ]$/.test(value) || /[+-]\d{2}:?\d{2}$/.test(value);

export const getGroupChatPlannedStart = (
	item: GroupChatStartFields
): Date | null => {
	if (item.startDateWithTime) {
		const parsed = new Date(item.startDateWithTime);
		return Number.isNaN(parsed.getTime()) ? null : parsed;
	}

	if (!item.startDate || !item.startTime) {
		return null;
	}

	// startDate may be YYYY-MM-DD or a full ISO datetime (contract example).
	// Only the calendar-date part is combined with startTime.
	const calendarDate = item.startDate.split('T')[0];
	const combined = `${calendarDate}T${item.startTime}`;

	if (item.timezone && !hasExplicitOffset(combined)) {
		try {
			const parsed = dayjs.tz(combined, item.timezone);
			return parsed.isValid() ? parsed.toDate() : null;
		} catch {
			return null;
		}
	}

	const parsed = new Date(combined);
	return Number.isNaN(parsed.getTime()) ? null : parsed;
};
