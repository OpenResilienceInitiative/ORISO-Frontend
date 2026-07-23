interface GroupChatCalendarInput {
	start: Date;
	durationMinutes: number;
	title: string;
	defaultTitle: string;
	eventId: string | number;
}

const compactUtc = (date: Date) =>
	date
		.toISOString()
		.replace(/[-:]/g, '')
		.replace(/\.\d{3}/, '');

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
	eventId
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
	const ics = [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		'PRODID:-//Online Appointment//Calendar//EN',
		'BEGIN:VEVENT',
		`UID:${safeUidSegment(eventId)}-${start.getTime()}-online-appointment@localhost`,
		`DTSTAMP:${compactUtc(new Date())}`,
		`DTSTART:${startUtc}`,
		`DTEND:${endUtc}`,
		foldIcsLine(`SUMMARY:${escapeIcs(safeTitle)}`),
		'END:VEVENT',
		'END:VCALENDAR'
	].join('\r\n');
	const common = new URLSearchParams({
		text: safeTitle,
		dates: `${startUtc}/${endUtc}`
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
		outlookUrl: `https://outlook.live.com/calendar/0/deeplink/compose?${outlook}`
	};
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
