// @vitest-environment oriso-jsdom
import { describe, expect, it } from 'vite-plus/test';
import type { CalendarEntryDTO } from '../../../api/apiCalendar';
import {
	colleagueAppointmentEntry,
	colleagueAppointmentMenu,
	nextColleagueAppointment
} from './supervisorAppointment';

const NOW = new Date('2026-11-24T12:00:00Z');
const meeting = (over: Partial<CalendarEntryDTO>): CalendarEntryDTO => ({
	id: 'm1',
	type: 'APPOINTMENT',
	start: '2026-11-26T09:00:00Z',
	end: '2026-11-26T09:45:00Z',
	ownerId: 'me',
	kind: 'PHONE',
	colleagueId: 'sup-1',
	colleagueName: 'Dana Supervisor',
	colleagueStatus: 'CONFIRMED',
	chatId: 77,
	matrixRoomId: '!internal:oriso',
	...over
});
const t = (key: string) => key;

describe('nextColleagueAppointment (FE#2494)', () => {
	it('picks the nearest unfinished appointment with that colleague', () => {
		const found = nextColleagueAppointment(
			[
				meeting({
					id: 'later',
					start: '2026-11-30T09:00:00Z',
					end: '2026-11-30T10:00:00Z'
				}),
				meeting({
					id: 'other',
					colleagueId: 'someone-else',
					start: '2026-11-25T09:00:00Z',
					end: '2026-11-25T10:00:00Z'
				}),
				meeting({
					id: 'past',
					start: '2026-11-23T09:00:00Z',
					end: '2026-11-23T10:00:00Z'
				}),
				meeting({
					id: 'blocker',
					type: 'BLOCKER',
					start: '2026-11-25T08:00:00Z',
					end: '2026-11-25T09:00:00Z'
				}),
				meeting({ id: 'next' })
			],
			'sup-1',
			NOW
		);
		expect(found?.id).toBe('next');
	});

	it('keeps an appointment that is running now', () => {
		const running = meeting({
			start: '2026-11-24T11:30:00Z',
			end: '2026-11-24T12:30:00Z'
		});
		expect(nextColleagueAppointment([running], 'sup-1', NOW)).toBe(running);
	});

	it('finds nothing without an appointment with that colleague', () => {
		expect(nextColleagueAppointment([], 'sup-1', NOW)).toBeUndefined();
	});
});

describe('colleagueAppointmentEntry', () => {
	it('maps the kind and marks a waiting appointment as requested', () => {
		const entry = colleagueAppointmentEntry(
			meeting({ colleagueStatus: 'PENDING' })
		);
		expect(entry.modality).toBe('audio');
		expect(entry.requested).toBe(true);
		expect(entry.key).toBe('colleague-m1');
	});

	it('shows a confirmed appointment plainly', () => {
		expect(
			colleagueAppointmentEntry(meeting({})).requested
		).toBeUndefined();
	});
});

describe('colleagueAppointmentMenu', () => {
	it('lets the invited counsellor accept or decline', () => {
		const keys = colleagueAppointmentMenu(
			meeting({ invited: true, colleagueStatus: 'PENDING' }),
			t
		).map((i) => i.key);
		expect(keys).toEqual(['confirm', 'decline', 'calendar']);
	});

	it('lets either of the two cancel otherwise', () => {
		const keys = colleagueAppointmentMenu(meeting({}), t).map((i) => i.key);
		expect(keys).toEqual(['cancel', 'calendar']);
	});
});
