import {
	getGroupChatOccurrences,
	groupChatRrule,
	type GroupChatSeries
} from './groupChatSeries';

interface GroupChatCalendarInput {
	start: Date;
	durationMinutes: number;
	title: string;
	defaultTitle: string;
	eventId: string | number;
	/**
	 * Export the dates still left of the series from `start` on instead of
	 * this one date. The Outlook web link has no field for it, so a series
	 * has no Outlook link.
	 */
	series?: GroupChatSeries;
}

export type { GroupChatRepeat, GroupChatSeries } from './groupChatSeries';

const compactUtc = (date: Date) =>
	date
		.toISOString()
		.replace(/[-:]/g, '')
		.replace(/\.\d{3}/, '');

/* The date's wall clock in `timeZone`, or in UTC without one. */
const wallParts = (date: Date, timeZone = 'UTC') =>
	Object.fromEntries(
		new Intl.DateTimeFormat('en-GB', {
			timeZone,
			hourCycle: 'h23',
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit'
		})
			.formatToParts(date)
			.map(({ type, value }) => [type, value])
	);

/* Floating wall-clock time for Google's `ctz`, e.g. 20261020T180000. */
const compactWall = (date: Date, timeZone: string) => {
	const parts = wallParts(date, timeZone);
	return `${parts.year}${parts.month}${parts.day}T${parts.hour}${parts.minute}${parts.second}`;
};

const escapeIcs = (value: string) =>
	value
		.replace(/\\/g, '\\\\')
		.replace(/[,;]/g, '\\$&')
		.replace(/\r\n|\r|\n/g, '\\n');

const safeUidSegment = (value: string | number) =>
	String(value)
		.trim()
		.replace(/[^a-zA-Z0-9._-]/g, '-');

const foldIcsLine = (line: string): string => {
	const encoder = new TextEncoder();
	const lines: string[] = [];
	let current = '';
	for (const character of line) {
		if (encoder.encode(current + character).length > 75) {
			lines.push(current);
			current = ` ${character}`;
		} else {
			current += character;
		}
	}
	lines.push(current);
	return lines.join('\r\n');
};

export const buildNeutralGroupChatCalendar = ({
	start,
	durationMinutes,
	title,
	defaultTitle,
	eventId,
	series
}: GroupChatCalendarInput) => {
	if (!Number.isFinite(durationMinutes) || durationMinutes < 0) {
		throw new Error(
			'Calendar duration must be a finite, non-negative number'
		);
	}
	const end = new Date(start.getTime() + durationMinutes * 60_000);
	const startUtc = compactUtc(start);
	const endUtc = compactUtc(end);
	const safeTitle = title.trim() || defaultTitle.trim();
	if (!safeTitle) {
		throw new Error('Calendar default title is required');
	}
	/* A series goes out as its concrete dates, each computed on the group's
	   wall clock: a UTC start with an RRULE would move every date after the
	   DST change by an hour, and the list ends where the series ends. */
	const dates = series ? getGroupChatOccurrences(start, series) : [start];
	const stamp = compactUtc(new Date());
	const events = dates.flatMap((date) => [
		'BEGIN:VEVENT',
		`UID:${safeUidSegment(eventId)}-${series ? 'series-' : ''}${date.getTime()}-online-appointment@localhost`,
		`DTSTAMP:${stamp}`,
		`DTSTART:${compactUtc(date)}`,
		`DTEND:${compactUtc(new Date(date.getTime() + durationMinutes * 60_000))}`,
		foldIcsLine(`SUMMARY:${escapeIcs(safeTitle)}`),
		'END:VEVENT'
	]);
	const ics = [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		'PRODID:-//Online Appointment//Calendar//EN',
		...events,
		'END:VCALENDAR'
	].join('\r\n');
	/* Google expands the rule itself: in the group's zone (`ctz`, wall-clock
	   dates) it keeps the local time, and COUNT ends it. */
	const zone =
		series &&
		(knownTimeZone(series.timeZone) ?? knownTimeZone(browserZone()));
	const startWall = wallParts(start, zone || undefined);
	const startDay = {
		month: Number(startWall.month),
		day: Number(startWall.day)
	};
	const common = new URLSearchParams({
		text: safeTitle,
		...(zone
			? {
					dates: `${compactWall(start, zone)}/${compactWall(end, zone)}`,
					ctz: zone
				}
			: { dates: `${startUtc}/${endUtc}` }),
		...(series
			? {
					recur: `RRULE:${groupChatRrule(series, startDay)}`
				}
			: {})
	});
	const outlook = new URLSearchParams({
		path: '/calendar/action/compose',
		rru: 'addevent',
		subject: safeTitle,
		startdt: start.toISOString(),
		enddt: end.toISOString()
	});

	return {
		ics,
		googleUrl: `https://calendar.google.com/calendar/render?action=TEMPLATE&${common}`,
		outlookUrl: series
			? null
			: `https://outlook.live.com/calendar/0/deeplink/compose?${outlook}`
	};
};

const browserZone = () => {
	try {
		return Intl.DateTimeFormat().resolvedOptions().timeZone;
	} catch {
		return undefined;
	}
};

/** The zone name if `Intl` knows it, so a typo cannot break the link. */
const knownTimeZone = (zone?: string) => {
	if (!zone) return undefined;
	try {
		new Intl.DateTimeFormat('en', { timeZone: zone });
		return zone;
	} catch {
		return undefined;
	}
};

export const downloadNeutralGroupChatIcs = (ics: string): void => {
	const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
	const anchor = document.createElement('a');
	anchor.href = url;
	anchor.download = 'online-appointment.ics';
	document.body.appendChild(anchor);
	anchor.click();
	anchor.remove();
	window.setTimeout(() => URL.revokeObjectURL(url), 0);
};
