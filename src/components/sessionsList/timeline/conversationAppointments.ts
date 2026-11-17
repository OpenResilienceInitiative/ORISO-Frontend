/**
 * 1:1 appointments stored on their conversation (FE#1960): how an API record
 * becomes a timeline booking, which one is next, what makes a chosen slot
 * valid, and the signal that keeps list and room header in step.
 */
import type {
	SessionAppointment,
	SessionAppointmentKind,
	SessionAppointmentSlot
} from '../../../api/apiSessionAppointments';
import type { TimelineBooking } from './timelineModel';

const LOCATION: Record<SessionAppointmentKind, TimelineBooking['location']> = {
	ONSITE: 'IN_PERSON',
	VIDEO: 'VIDEO_CALL',
	PHONE: 'PHONE_CALL',
	CHAT: 'CHAT'
};

export const appointmentToBooking = (
	appointment: SessionAppointment
): TimelineBooking => ({
	id: appointment.id,
	appointmentId: appointment.id,
	sessionId: appointment.sessionId,
	startTime: appointment.startTime,
	endTime: appointment.endTime,
	// The same kind as in the calendar (entryFromApi): an appointment made
	// before the calendar names none and was a video call (review 4577642140).
	location: (appointment.kind && LOCATION[appointment.kind]) || 'VIDEO_CALL',
	askerName:
		appointment.counterpart?.displayName ||
		appointment.counterpart?.username
});

/** Scheduled and not over, nearest first. */
export const upcomingAppointments = (
	appointments: SessionAppointment[],
	now: Date
): SessionAppointment[] =>
	appointments
		.filter(
			(a) =>
				a.status === 'SCHEDULED' &&
				new Date(a.endTime).getTime() > now.getTime()
		)
		.sort(
			(a, b) =>
				new Date(a.startTime).getTime() -
				new Date(b.startTime).getTime()
		);

/**
 * FE#2287: an advice seeker's requests waiting for the counsellor, not over,
 * nearest first. They are no appointment yet: `upcomingAppointments` leaves
 * them out.
 */
export const pendingRequests = (
	appointments: SessionAppointment[],
	now: Date
): SessionAppointment[] =>
	appointments
		.filter(
			(a) =>
				a.status === 'REQUESTED' &&
				new Date(a.endTime).getTime() > now.getTime()
		)
		.sort(
			(a, b) =>
				new Date(a.startTime).getTime() -
				new Date(b.startTime).getTime()
		);

export type AppointmentSlotError = 'incomplete' | 'past' | 'order';

export const appointmentSlotError = (
	slot: { start?: Date | null; end?: Date | null },
	now: Date
): AppointmentSlotError | null => {
	if (!slot.start || !slot.end) return 'incomplete';
	if (slot.start.getTime() <= now.getTime()) return 'past';
	if (slot.end.getTime() <= slot.start.getTime()) return 'order';
	return null;
};

export const toAppointmentSlot = (
	start: Date,
	end: Date
): SessionAppointmentSlot => ({
	startTime: start.toISOString(),
	endTime: end.toISOString()
});

/**
 * `requested`: the asker asked for a time (FE#2287); `confirmed` and
 * `declined`: the counsellor's answer.
 */
export type AppointmentNoticeKind =
	| 'created'
	| 'moved'
	| 'cancelled'
	| 'requested'
	| 'confirmed'
	| 'declined';

export const appointmentNoticeKey = (kind: AppointmentNoticeKind) =>
	`sessionList.timeline.appointment.notice.${kind}`;

const CHANGED_EVENT = 'oriso:conversation-appointments-changed';

/** List and room header load separately: a change in one reloads the other. */
export const notifyAppointmentsChanged = () => {
	window.dispatchEvent(new Event(CHANGED_EVENT));
};

export const onAppointmentsChanged = (listener: () => void) => {
	window.addEventListener(CHANGED_EVENT, listener);
	return () => window.removeEventListener(CHANGED_EVENT, listener);
};
