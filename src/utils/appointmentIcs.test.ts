import { describe, it, expect } from 'vitest';
import { buildAppointmentIcs } from './appointmentIcs';

// A fixed reference instant so DTSTART/DTEND/DTSTAMP are deterministic
// regardless of the machine timezone the tests run in.
const START_ISO = '2026-07-12T09:30:00Z';
const STAMP = new Date('2026-07-01T00:00:00Z');

const baseInput = {
	start: START_ISO,
	durationMinutes: 60,
	title: 'Beratungstermin',
	uid: 'evt-1@oriso',
	dtstamp: STAMP
};

// Per RFC 5545 lines are separated by CRLF.
const lines = (ics: string) => ics.split('\r\n');

describe('buildAppointmentIcs', () => {
	describe('envelope', () => {
		it('starts with BEGIN:VCALENDAR and ends with END:VCALENDAR', () => {
			const ics = buildAppointmentIcs(baseInput);
			const l = lines(ics).filter(Boolean);
			expect(l[0]).toBe('BEGIN:VCALENDAR');
			expect(l[l.length - 1]).toBe('END:VCALENDAR');
		});

		it('declares iCalendar VERSION 2.0', () => {
			expect(buildAppointmentIcs(baseInput)).toContain('VERSION:2.0');
		});

		it('contains exactly one VEVENT block', () => {
			const ics = buildAppointmentIcs(baseInput);
			expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
			expect(ics.match(/END:VEVENT/g)).toHaveLength(1);
		});

		it('uses CRLF line endings', () => {
			expect(buildAppointmentIcs(baseInput)).toContain('\r\n');
		});

		it('carries a PRODID line', () => {
			expect(buildAppointmentIcs(baseInput)).toMatch(/\r\nPRODID:.+/);
		});

		it('honours a custom PRODID', () => {
			const ics = buildAppointmentIcs({
				...baseInput,
				prodId: '-//Acme//Cal//EN'
			});
			expect(ics).toContain('PRODID:-//Acme//Cal//EN');
		});
	});

	describe('timestamps', () => {
		it('formats DTSTART as UTC basic format with trailing Z', () => {
			expect(buildAppointmentIcs(baseInput)).toContain(
				'DTSTART:20260712T093000Z'
			);
		});

		it('derives DTEND from durationMinutes', () => {
			expect(buildAppointmentIcs(baseInput)).toContain(
				'DTEND:20260712T103000Z'
			);
		});

		it('uses an explicit end over durationMinutes when both given', () => {
			const ics = buildAppointmentIcs({
				...baseInput,
				end: '2026-07-12T11:00:00Z'
			});
			expect(ics).toContain('DTEND:20260712T110000Z');
		});

		it('formats DTSTAMP from the injected stamp', () => {
			expect(buildAppointmentIcs(baseInput)).toContain(
				'DTSTAMP:20260701T000000Z'
			);
		});

		it('accepts a Date instance for start', () => {
			const ics = buildAppointmentIcs({
				...baseInput,
				start: new Date(START_ISO)
			});
			expect(ics).toContain('DTSTART:20260712T093000Z');
		});

		it('accepts an epoch-millis number for start', () => {
			const ics = buildAppointmentIcs({
				...baseInput,
				start: new Date(START_ISO).getTime()
			});
			expect(ics).toContain('DTSTART:20260712T093000Z');
		});
	});

	describe('content fields', () => {
		it('renders the title as SUMMARY', () => {
			expect(buildAppointmentIcs(baseInput)).toContain(
				'SUMMARY:Beratungstermin'
			);
		});

		it('omits DESCRIPTION when no description is given', () => {
			expect(buildAppointmentIcs(baseInput)).not.toContain(
				'DESCRIPTION:'
			);
		});

		it('renders DESCRIPTION when provided', () => {
			const ics = buildAppointmentIcs({
				...baseInput,
				description: 'Bitte puenktlich sein'
			});
			expect(ics).toContain('DESCRIPTION:Bitte puenktlich sein');
		});

		it('omits LOCATION when no location is given', () => {
			expect(buildAppointmentIcs(baseInput)).not.toContain('LOCATION:');
		});

		it('renders LOCATION when provided', () => {
			const ics = buildAppointmentIcs({
				...baseInput,
				location: 'Videocall'
			});
			expect(ics).toContain('LOCATION:Videocall');
		});
	});

	describe('uid', () => {
		it('uses the provided uid', () => {
			expect(buildAppointmentIcs(baseInput)).toContain('UID:evt-1@oriso');
		});

		it('generates a uid when none is provided', () => {
			const { uid, ...rest } = baseInput;
			const ics = buildAppointmentIcs(rest);
			const uidLine = lines(ics).find((l) => l.startsWith('UID:'));
			expect(uidLine).toBeTruthy();
			expect(uidLine).toContain('@');
		});

		it('generates a stable uid for identical input', () => {
			const { uid, ...rest } = baseInput;
			expect(buildAppointmentIcs(rest)).toBe(buildAppointmentIcs(rest));
		});
	});

	describe('text escaping (RFC 5545 3.3.11)', () => {
		it('escapes comma, semicolon and backslash', () => {
			const ics = buildAppointmentIcs({
				...baseInput,
				title: 'A, B; C \\ D'
			});
			expect(ics).toContain('SUMMARY:A\\, B\\; C \\\\ D');
		});

		it('escapes newlines as \\n', () => {
			const ics = buildAppointmentIcs({
				...baseInput,
				description: 'line1\nline2'
			});
			expect(ics).toContain('DESCRIPTION:line1\\nline2');
		});

		it('does not escape colons in text', () => {
			const ics = buildAppointmentIcs({
				...baseInput,
				title: 'Termin: heute'
			});
			expect(ics).toContain('SUMMARY:Termin: heute');
		});
	});

	describe('line folding', () => {
		it('folds content lines longer than 75 octets', () => {
			const ics = buildAppointmentIcs({
				...baseInput,
				description: 'x'.repeat(200)
			});
			for (const line of lines(ics)) {
				// folded continuation lines start with a single space
				expect(Buffer.byteLength(line, 'utf8')).toBeLessThanOrEqual(75);
			}
			// a continuation line must exist
			expect(ics).toMatch(/\r\n /);
		});
	});

	describe('validation', () => {
		it('throws on an unparseable start', () => {
			expect(() =>
				buildAppointmentIcs({ ...baseInput, start: 'not-a-date' })
			).toThrow();
		});

		it('throws when neither end nor durationMinutes is given', () => {
			const { durationMinutes, ...rest } = baseInput;
			expect(() => buildAppointmentIcs(rest)).toThrow();
		});

		it('throws when end is not after start', () => {
			expect(() =>
				buildAppointmentIcs({
					...baseInput,
					durationMinutes: undefined,
					end: START_ISO
				})
			).toThrow();
		});

		it('throws on a non-positive durationMinutes', () => {
			expect(() =>
				buildAppointmentIcs({ ...baseInput, durationMinutes: 0 })
			).toThrow();
		});

		it('throws on a missing title', () => {
			expect(() =>
				buildAppointmentIcs({ ...baseInput, title: '' })
			).toThrow();
		});
	});
});
