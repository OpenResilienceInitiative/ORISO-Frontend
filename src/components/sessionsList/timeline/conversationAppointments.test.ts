import { describe, expect, it } from 'vite-plus/test';
import type { SessionAppointment } from '../../../api/apiSessionAppointments';
import {
	appointmentNoticeKey,
	appointmentSlotError,
	appointmentToBooking,
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
});
