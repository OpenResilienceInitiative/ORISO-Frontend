import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { CalendarEntry } from './calendarModel';

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

/** "Mo., 16.11., 10:00–11:00" in the reader's language. */
export const useRangeFormat = () => {
	const { i18n } = useTranslation();
	return useCallback(
		(start: Date | string, end?: Date | string) => {
			const locale = i18n.language?.startsWith('en') ? 'en-GB' : 'de-DE';
			const s = new Date(start);
			const day = new Intl.DateTimeFormat(locale, {
				weekday: 'short',
				day: '2-digit',
				month: '2-digit'
			}).format(s);
			const time = new Intl.DateTimeFormat(locale, {
				hour: '2-digit',
				minute: '2-digit'
			});
			return end
				? `${day}, ${time.format(s)}–${time.format(new Date(end))}`
				: `${day}, ${time.format(s)}`;
		},
		[i18n.language]
	);
};

/** Single-letter weekday headers for OrisoCalendar, starting on Sunday. */
export const useDayLabels = () => {
	const { i18n } = useTranslation();
	const locale = i18n.language?.startsWith('en') ? 'en-GB' : 'de-DE';
	const format = new Intl.DateTimeFormat(locale, { weekday: 'narrow' });
	// 15 November 2026 is a Sunday.
	return Array.from({ length: 7 }, (_, day) =>
		format.format(new Date(2026, 10, 15 + day))
	);
};
