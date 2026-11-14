import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { CalendarEntry } from './calendarModel';
import { calendarLocale } from './calendarLocale';

const sameLocalDay = (a: Date, b: Date) =>
	a.getFullYear() === b.getFullYear() &&
	a.getMonth() === b.getMonth() &&
	a.getDate() === b.getDate();

/**
 * The visible text of an entry. Own appointments show the advice seeker's
 * username; colleagues' entries show it only when the Träger allows it
 * (the data then carries it), otherwise "Belegt".
 */
export const useEntryLabel = () => {
	const { t } = useTranslation();
	return useCallback(
		(entry: CalendarEntry, colleague = false) => {
			if (entry.type === 'busy') return t('calendar.types.busy');
			if (entry.type === 'blocker')
				return colleague || !entry.title
					? t('calendar.types.blocker')
					: entry.title;
			if (entry.type === 'group')
				return entry.title ?? t('calendar.types.group');
			if (colleague) return entry.title ?? t('calendar.types.colleague');
			return entry.title ?? t(`calendar.kinds.${entry.kind ?? 'video'}`);
		},
		[t]
	);
};

/**
 * "Mo., 16.11., 10:00–11:00" in the reader's language. A range that ends on
 * another day names both days: "Mo., 16.11., 10:00 – Mi., 18.11., 11:00".
 * An end at midnight closes the day before (a whole day, or 23:00–00:00).
 */
export const useRangeFormat = () => {
	const { i18n } = useTranslation();
	return useCallback(
		(start: Date | string, end?: Date | string) => {
			const locale = calendarLocale(i18n.language);
			const s = new Date(start);
			const dayFormat = new Intl.DateTimeFormat(locale, {
				weekday: 'short',
				day: '2-digit',
				month: '2-digit'
			});
			const day = dayFormat.format(s);
			const time = new Intl.DateTimeFormat(locale, {
				hour: '2-digit',
				minute: '2-digit'
			});
			if (!end) return `${day}, ${time.format(s)}`;
			const e = new Date(end);
			const lastMoment = new Date(e.getTime() - 1);
			if (e.getTime() <= s.getTime() || sameLocalDay(s, lastMoment))
				return `${day}, ${time.format(s)}–${time.format(e)}`;
			return `${day}, ${time.format(s)} – ${dayFormat.format(e)}, ${time.format(e)}`;
		},
		[i18n.language]
	);
};

/** Single-letter weekday headers for OrisoCalendar, starting on Sunday. */
export const useDayLabels = () => {
	const { i18n } = useTranslation();
	const format = new Intl.DateTimeFormat(calendarLocale(i18n.language), {
		weekday: 'narrow'
	});
	// 15 November 2026 is a Sunday.
	return Array.from({ length: 7 }, (_, day) =>
		format.format(new Date(2026, 10, 15 + day))
	);
};
