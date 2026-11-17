import { describe, expect, it } from 'vite-plus/test';
import type { SessionAppointment } from '../../../api/apiSessionAppointments';
import {
	appointmentNoticeKey,
	appointmentSlotError,
	appointmentToBooking,
	pendingRequests,
	toAppointmentSlot,
	upcomingAppointments
} from './conversationAppointments';

const NOW = new Date('2026-11-02T10:00:00Z');
const appointment = (
	id: string,
	startTime: string,
	endTime: string,
	status: SessionAppointment['status'] = 'SCHEDULED'
): SessionAppointment => ({ id, sessionId: 4, startTime, endTime, status });

describe('conversation appointments', () => {
	it('maps the record to a timeline booking', () => {
		const booking = appointmentToBooking({
			...appointment('a', '2026-11-03T10:00:00Z', '2026-11-03T11:00:00Z'),
			counterpart: { username: 'yak', displayName: 'Yak Kim' }
		});
		expect(booking).toMatchObject({
			id: 'a',
			appointmentId: 'a',
			sessionId: 4,
			askerName: 'Yak Kim'
		});
	});

	it('marks a request waiting for the counsellor (FE#2287)', () => {
		const base = appointment('a', '', '');
		expect(appointmentToBooking(base).requested).toBeUndefined();
		expect(
			appointmentToBooking({ ...base, status: 'REQUESTED' }).requested
		).toBe(true);
	});

	it('shows the kind the calendar shows, video when the record names none (review 4577642140)', () => {
		const base = appointment('a', '', '');
		const location = (kind: SessionAppointment['kind']) =>
			appointmentToBooking({ ...base, kind }).location;
		expect([
			location('ONSITE'),
			location('PHONE'),
			location('VIDEO'),
			location('CHAT'),
			location(undefined),
			location(null)
		]).toEqual([
			'IN_PERSON',
			'PHONE_CALL',
			'VIDEO_CALL',
			'CHAT',
			'VIDEO_CALL',
			'VIDEO_CALL'
		]);
	});

	it('copes with a counterpart without display name, or none', () => {
		const base = appointment('a', '', '');
		expect(
			appointmentToBooking({ ...base, counterpart: { username: 'yak' } })
				.askerName
		).toBe('yak');
		expect(appointmentToBooking(base).askerName).toBeUndefined();
	});

	it('next means scheduled and not over, nearest first; a running one counts', () => {
		const list = [
			appointment(
				'later',
				'2026-11-05T10:00:00Z',
				'2026-11-05T11:00:00Z'
			),
			appointment('gone', '2026-11-01T10:00:00Z', '2026-11-01T11:00:00Z'),
			appointment(
				'cancelled',
				'2026-11-03T10:00:00Z',
				'2026-11-03T11:00:00Z',
				'CANCELLED'
			),
			appointment(
				'running',
				'2026-11-02T09:30:00Z',
				'2026-11-02T10:30:00Z'
			)
		];
		expect(upcomingAppointments(list, NOW).map((a) => a.id)).toEqual([
			'running',
			'later'
		]);
	});

	it('rejects a slot that is incomplete, past or ends before it starts', () => {
		const at = (iso: string) => new Date(iso);
		expect(appointmentSlotError({ start: null, end: NOW }, NOW)).toBe(
			'incomplete'
		);
		expect(
			appointmentSlotError(
				{ start: at('2026-11-02T09:00:00Z'), end: NOW },
				NOW
			)
		).toBe('past');
		expect(
			appointmentSlotError(
				{
					start: at('2026-11-03T10:00:00Z'),
					end: at('2026-11-03T10:00:00Z')
				},
				NOW
			)
		).toBe('order');
		expect(
			appointmentSlotError(
				{
					start: at('2026-11-03T10:00:00Z'),
					end: at('2026-11-03T11:00:00Z')
				},
				NOW
			)
		).toBeNull();
	});

	it('sends the slot as UTC instants and names the notice per change', () => {
		expect(
			toAppointmentSlot(
				new Date('2026-11-03T10:00:00Z'),
				new Date('2026-11-03T11:00:00Z')
			)
		).toEqual({
			startTime: '2026-11-03T10:00:00.000Z',
			endTime: '2026-11-03T11:00:00.000Z'
		});
		expect(appointmentNoticeKey('moved')).toBe(
			'sessionList.timeline.appointment.notice.moved'
		);
	});

	it('lists the requests waiting for the counsellor, not ended, nearest first (FE#2287)', () => {
		const later = appointment(
			'later',
			'2026-11-05T10:00:00Z',
			'2026-11-05T11:00:00Z',
			'REQUESTED'
		);
		const sooner = appointment(
			'sooner',
			'2026-11-03T10:00:00Z',
			'2026-11-03T11:00:00Z',
			'REQUESTED'
		);
		const over = appointment(
			'over',
			'2026-11-01T10:00:00Z',
			'2026-11-01T11:00:00Z',
			'REQUESTED'
		);
		const declined = appointment(
			'declined',
			'2026-11-04T10:00:00Z',
			'2026-11-04T11:00:00Z',
			'DECLINED'
		);
		const scheduled = appointment(
			'scheduled',
			'2026-11-04T12:00:00Z',
			'2026-11-04T13:00:00Z'
		);
		expect(
			pendingRequests(
				[later, over, declined, scheduled, sooner],
				NOW
			).map((a) => a.id)
		).toEqual(['sooner', 'later']);
		expect(
			upcomingAppointments([later, scheduled], NOW).map((a) => a.id)
		).toEqual(['scheduled']);
	});

	it('names the notices of a request and its answer (FE#2287)', () => {
		expect(appointmentNoticeKey('requested')).toBe(
			'sessionList.timeline.appointment.notice.requested'
		);
		expect(appointmentNoticeKey('confirmed')).toBe(
			'sessionList.timeline.appointment.notice.confirmed'
		);
		expect(appointmentNoticeKey('declined')).toBe(
			'sessionList.timeline.appointment.notice.declined'
		);
	});
});
