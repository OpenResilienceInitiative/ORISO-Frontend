/**
 * Pure helper that turns appointment data into a valid iCalendar (`.ics`)
 * document (RFC 5545). It is intentionally free of DOM/framework imports so it
 * can be unit tested in isolation — the browser download lives in
 * `downloadICSFile`.
 *
 * The previous implementation parsed already-formatted, locale-dependent
 * display strings and produced an invalid `VEVENT` (missing UID/DTSTAMP,
 * broken DURATION, unescaped text). This helper takes raw timestamps instead.
 */

export interface AppointmentIcsInput {
	/** Event start as a Date, ISO-8601 string or epoch milliseconds. */
	start: Date | string | number;
	/** Event end. Takes precedence over `durationMinutes` when both are set. */
	end?: Date | string | number;
	/** Alternative to `end`: length of the appointment in minutes. */
	durationMinutes?: number;
	/** Human-readable title, rendered as SUMMARY. */
	title: string;
	/** Optional longer note, rendered as DESCRIPTION. */
	description?: string;
	/** Optional location, rendered as LOCATION. */
	location?: string;
	/** Stable unique id. Generated deterministically when omitted. */
	uid?: string;
	/** Creation timestamp (DTSTAMP). Defaults to "now". */
	dtstamp?: Date;
	/** Product identifier line. */
	prodId?: string;
}

const DEFAULT_PROD_ID = '-//ORISO//Appointment//EN';
const MS_PER_MINUTE = 60 * 1000;
const MAX_LINE_OCTETS = 75;

const toDate = (value: Date | string | number, label: string): Date => {
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) {
		throw new RangeError(`Invalid ${label}: ${String(value)}`);
	}
	return date;
};

const pad = (value: number): string => String(value).padStart(2, '0');

/** Format a Date as an iCalendar UTC date-time: `YYYYMMDDTHHMMSSZ`. */
const formatUtc = (date: Date): string =>
	`${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(
		date.getUTCDate()
	)}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(
		date.getUTCSeconds()
	)}Z`;

/** Escape a TEXT value per RFC 5545 §3.3.11 (backslash first). */
const escapeText = (value: string): string =>
	value
		.replace(/\\/g, '\\\\')
		.replace(/;/g, '\\;')
		.replace(/,/g, '\\,')
		.replace(/\r\n|\r|\n/g, '\\n');

/** Fold a single content line to <= 75 octets using CRLF + space (§3.1). */
const foldLine = (line: string): string => {
	const encoder = new TextEncoder();
	let out = '';
	let current = '';
	let currentOctets = 0;
	for (const char of line) {
		const charOctets = encoder.encode(char).length;
		// Continuation lines carry a leading space that counts toward the limit.
		const limit = out === '' ? MAX_LINE_OCTETS : MAX_LINE_OCTETS - 1;
		if (currentOctets + charOctets > limit) {
			out += (out === '' ? '' : '\r\n ') + current;
			current = char;
			currentOctets = charOctets;
		} else {
			current += char;
			currentOctets += charOctets;
		}
	}
	out += (out === '' ? '' : '\r\n ') + current;
	return out;
};

/** Deterministic, dependency-free uid so repeated exports stay stable. */
const generateUid = (start: Date, title: string): string => {
	let hash = 0;
	for (let i = 0; i < title.length; i++) {
		hash = (hash * 31 + title.charCodeAt(i)) | 0;
	}
	return `${start.getTime()}-${(hash >>> 0).toString(36)}@oriso.org`;
};

export const buildAppointmentIcs = (input: AppointmentIcsInput): string => {
	const title = input.title?.trim();
	if (!title) {
		throw new Error('buildAppointmentIcs: title is required');
	}

	const start = toDate(input.start, 'start');

	let end: Date;
	if (input.end !== undefined && input.end !== null) {
		end = toDate(input.end, 'end');
	} else if (input.durationMinutes !== undefined) {
		if (!(input.durationMinutes > 0)) {
			throw new Error(
				'buildAppointmentIcs: durationMinutes must be positive'
			);
		}
		end = new Date(start.getTime() + input.durationMinutes * MS_PER_MINUTE);
	} else {
		throw new Error(
			'buildAppointmentIcs: either end or durationMinutes is required'
		);
	}

	if (end.getTime() <= start.getTime()) {
		throw new Error('buildAppointmentIcs: end must be after start');
	}

	const dtstamp = input.dtstamp ?? new Date();
	const uid = input.uid ?? generateUid(start, title);

	const lines: string[] = [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		`PRODID:${input.prodId ?? DEFAULT_PROD_ID}`,
		'CALSCALE:GREGORIAN',
		'METHOD:PUBLISH',
		'BEGIN:VEVENT',
		`UID:${uid}`,
		`DTSTAMP:${formatUtc(dtstamp)}`,
		`DTSTART:${formatUtc(start)}`,
		`DTEND:${formatUtc(end)}`,
		`SUMMARY:${escapeText(title)}`
	];

	if (input.description) {
		lines.push(`DESCRIPTION:${escapeText(input.description)}`);
	}
	if (input.location) {
		lines.push(`LOCATION:${escapeText(input.location)}`);
	}

	lines.push('END:VEVENT', 'END:VCALENDAR');

	return lines.map(foldLine).join('\r\n') + '\r\n';
};
