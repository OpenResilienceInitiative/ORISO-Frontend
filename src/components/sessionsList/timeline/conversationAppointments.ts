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
		appointment.counterpart?.username,
	...(appointment.status === 'REQUESTED' ? { requested: true as const } : {})
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
				// Unanswered by its start, a request has expired (Frank, 17 Nov).
				new Date(a.startTime).getTime() > now.getTime()
		)
		.sort(
			(a, b) =>
				new Date(a.startTime).getTime() -
				new Date(b.startTime).getTime()
		);

/**
 * What the split button of a conversation shows (ADR-021 §5): the nearest of
 * its scheduled appointments and its requests (FE#2287), like the list's
 * next-appointment rule.
 */
export const nextConversationAppointment = (
	appointments: SessionAppointment[],
	now: Date
): SessionAppointment | undefined =>
	[
		...upcomingAppointments(appointments, now),
		...pendingRequests(appointments, now)
	].sort(
		(a, b) =>
			new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
	)[0];

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
 * `declined`: the counsellor's answer; `withdrawn`: the asker took it back;
 * `expired`: nobody answered it by its start, so it was declined
 * automatically.
 */
export type AppointmentNoticeKind =
	| 'created'
	| 'moved'
	| 'cancelled'
	| 'requested'
	| 'confirmed'
	| 'declined'
	| 'withdrawn'
	| 'expired';

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
/* One clock for request starts. A read takes its ticket when it starts and
   its answer is stored under that ticket, so a read that started earlier can
   never replace one that started later, whichever answers last. */
let knownClock = 0;
/* Every ticket up to here belongs to a session that was logged out: an answer
   that lands after the logout cannot refill the store for the next user,
   whatever the timing of React's effect cleanup. */
let forgottenUpTo = 0;

/** Take when a read starts; hand back with its answer. */
export const appointmentsEpoch = () => ++knownClock;

const accepts = (startedAt: number, current?: KnownAppointments) =>
	startedAt > forgottenUpTo && (!current || startedAt > current.at);

export const rememberSessionAppointments = (
	sessionId: number,
	items: SessionAppointment[],
	startedAt: number
) => {
	if (!accepts(startedAt, knownBySession.get(sessionId))) return;
	knownBySession.set(sessionId, { at: startedAt, items });
};

/** Only a successful read: a failed one says nothing about appointments. */
export const rememberUpcomingAppointments = (
	items: SessionAppointment[],
	startedAt: number
) => {
	if (!accepts(startedAt, knownUpcoming)) return;
	knownUpcoming = { at: startedAt, items };
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
	forgottenUpTo = knownClock;
	knownBySession.clear();
	knownUpcoming = undefined;
};
