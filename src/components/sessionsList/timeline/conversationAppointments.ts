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

export type AppointmentNoticeKind = 'created' | 'moved' | 'cancelled';

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

/*
 * What is already known about a conversation's appointments, so its header
 * draws the appointment row in the same frame as itself. Without it the row
 * appeared 100–250 ms later on every conversation switch and pushed the
 * messages down (the "jumping" appointment button). The header still loads
 * the conversation's own list and replaces this guess.
 * Two sources, the newer one wins: the header's own load per conversation,
 * and the list's "my upcoming appointments" (a conversation missing there
 * has none of the viewer's upcoming ones).
 */
type KnownAppointments = { at: number; items: SessionAppointment[] };
const knownBySession = new Map<number, KnownAppointments>();
let knownUpcoming: KnownAppointments | undefined;
let knownClock = 0;
/* Bumped by every forget (logout). A request captures it when it starts, so
   an answer that lands after the logout cannot refill the store for the
   next user, whatever the timing of React's effect cleanup. */
let knownEpoch = 0;

export const appointmentsEpoch = () => knownEpoch;

export const rememberSessionAppointments = (
	sessionId: number,
	items: SessionAppointment[],
	startedInEpoch: number
) => {
	if (startedInEpoch !== knownEpoch) return;
	knownBySession.set(sessionId, { at: ++knownClock, items });
};

/** Only a successful read: a failed one says nothing about appointments. */
export const rememberUpcomingAppointments = (
	items: SessionAppointment[],
	startedInEpoch: number
) => {
	if (startedInEpoch !== knownEpoch) return;
	knownUpcoming = { at: ++knownClock, items };
};

export const knownSessionAppointments = (
	sessionId: number | undefined
): SessionAppointment[] | undefined => {
	if (sessionId === undefined) return undefined;
	const own = knownBySession.get(sessionId);
	if (own && (!knownUpcoming || own.at > knownUpcoming.at)) return own.items;
	return knownUpcoming?.items.filter((a) => a.sessionId === sessionId);
};

/** Logout (and tests): start from nothing known; in-flight answers are void. */
export const forgetKnownAppointments = () => {
	knownEpoch += 1;
	knownBySession.clear();
	knownUpcoming = undefined;
};
