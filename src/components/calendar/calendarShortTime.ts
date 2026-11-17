/**
 * The short time labels of the calendar's left column, like the
 * conversation list: "in 10 Min", "heute 14:00", "morgen 9:00", "Do 10:00".
 * The pure part decides which form; `useShortTime` words it.
 */
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { calendarLocale } from './calendarLocale';

export type ShortTime =
	| { form: 'running' }
	| { form: 'inMinutes'; minutes: number }
	| { form: 'today' | 'tomorrow' | 'weekday'; at: Date };

const MINUTE = 60_000;

const dayDiff = (from: Date, to: Date) => {
	const a = new Date(from);
	a.setHours(0, 0, 0, 0);
	const b = new Date(to);
	b.setHours(0, 0, 0, 0);
	return Math.round((b.getTime() - a.getTime()) / 86_400_000);
};

/**
 * Within the hour it counts down; later today, tomorrow or on a weekday it
 * names the clock time. Without `end` (a free slot) it never says "running".
 */
export const shortTimeOf = (start: Date, now: Date, end?: Date): ShortTime => {
	const minutes = Math.round((start.getTime() - now.getTime()) / MINUTE);
	if (end && minutes <= 0 && end.getTime() > now.getTime())
		return { form: 'running' };
	if (end && minutes > 0 && minutes < 60)
		return { form: 'inMinutes', minutes };
	const days = dayDiff(now, start);
	if (days === 0) return { form: 'today', at: start };
	if (days === 1) return { form: 'tomorrow', at: start };
	return { form: 'weekday', at: start };
};

/** Words a {@link ShortTime} in the reader's language. */
export const useShortTime = () => {
	const { t, i18n } = useTranslation();
	return useCallback(
		(start: Date, now: Date, end?: Date) => {
			const locale = calendarLocale(i18n.language);
			const short = shortTimeOf(start, now, end);
			if (short.form === 'running') return t('calendar.when.running');
			if (short.form === 'inMinutes')
				return t('calendar.when.inMinutes', { count: short.minutes });
			const time = new Intl.DateTimeFormat(locale, {
				hour: 'numeric',
				minute: '2-digit'
			}).format(short.at);
			if (short.form === 'weekday')
				return t('calendar.when.weekday', {
					day: new Intl.DateTimeFormat(locale, {
						weekday: 'short'
					})
						.format(short.at)
						.replace(/\.$/, ''),
					time
				});
			return t(`calendar.when.${short.form}`, { time });
		},
		[t, i18n.language]
	);
};
