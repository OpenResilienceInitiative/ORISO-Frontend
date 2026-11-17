import { describe, expect, it } from 'vite-plus/test';
import type { SessionAppointment } from '../../api/apiSessionAppointments';
import { overviewSections } from './invitationsOverviewData';

const appointment = (
	id: string,
	kind?: SessionAppointment['kind']
): SessionAppointment => ({
	id,
	sessionId: 5,
	startTime: '2026-11-20T10:00:00Z',
	endTime: '2026-11-20T11:00:00Z',
	status: 'SCHEDULED',
	...(kind !== undefined ? { kind } : {})
});

/* #2252 review: a 1:1 row shows how the appointment takes place. */
describe('overviewSections', () => {
	it('keeps the kind of each 1:1 appointment', () => {
		const { appointments } = overviewSections(
			[],
			[
				appointment('chat', 'CHAT'),
				appointment('phone', 'PHONE'),
				appointment('video', 'VIDEO'),
				appointment('onsite', 'ONSITE'),
				/* Made before the calendar named a kind: a video call, as on
				   the conversation's timeline. */
				appointment('older')
			],
			'Termin'
		);

		expect(appointments.map((row) => [row.id, row.medium])).toEqual([
			['appointment-chat', 'CHAT'],
			['appointment-phone', 'AUDIO'],
			['appointment-video', 'VIDEO'],
			['appointment-onsite', 'ONSITE'],
			['appointment-older', 'VIDEO']
		]);
	});
});
