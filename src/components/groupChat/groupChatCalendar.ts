interface GroupChatCalendarInput {
	start: Date;
	durationMinutes: number;
	title: string;
}

const compactUtc = (date: Date) =>
	date
		.toISOString()
		.replace(/[-:]/g, '')
		.replace(/\.\d{3}/, '');

const escapeIcs = (value: string) =>
	value.replace(/\\/g, '\\\\').replace(/[,;]/g, '\\$&').replace(/\n/g, '\\n');

export const buildNeutralGroupChatCalendar = ({
	start,
	durationMinutes,
	title
}: GroupChatCalendarInput) => {
	const end = new Date(start.getTime() + durationMinutes * 60_000);
	const startUtc = compactUtc(start);
	const endUtc = compactUtc(end);
	const safeTitle = title.trim() || 'Online appointment';
	const ics = [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		'PRODID:-//Online Appointment//Calendar//EN',
		'BEGIN:VEVENT',
		`UID:${start.getTime()}-online-appointment@localhost`,
		`DTSTAMP:${compactUtc(new Date())}`,
		`DTSTART:${startUtc}`,
		`DTEND:${endUtc}`,
		`SUMMARY:${escapeIcs(safeTitle)}`,
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
	anchor.click();
	URL.revokeObjectURL(url);
};
