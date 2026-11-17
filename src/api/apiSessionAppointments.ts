import { endpoints } from '../resources/scripts/endpoints';
import {
	FETCH_ERRORS,
	FETCH_METHODS,
	FETCH_SUCCESS,
	fetchData
} from './fetchData';

/** A 1:1 appointment stored on its conversation (UserService, FE#1960). */
export interface SessionAppointment {
	id: string;
	sessionId: number;
	/** UTC instants. */
	startTime: string;
	endTime: string;
	status: 'SCHEDULED' | 'CANCELLED';
	/** ADR-032 §2a. Absent on appointments made before the calendar. */
	kind?: SessionAppointmentKind | null;
	/** The asker's counterpart has no displayName; the whole object may be absent. */
	counterpart?: { username?: string; displayName?: string };
}

export type SessionAppointmentKind = 'ONSITE' | 'VIDEO' | 'PHONE' | 'CHAT';

export interface SessionAppointmentSlot {
	startTime: string;
	endTime: string;
	/** Left out on a move: the appointment keeps its kind. */
	kind?: SessionAppointmentKind;
}

/** A time the asker may book with the counsellor (FE#1050). UTC instants. */
export interface AppointmentSlot {
	startTime: string;
	endTime: string;
}

/** How a self-booked appointment takes place: what the asker clicked. */
export type SelfBookingMedium = 'VIDEO' | 'PHONE';

// A backend without these endpoints must leave the app untouched: every
// failure rejects for the caller to handle, only a 401 keeps the session logic.
const READ_HANDLING = [FETCH_ERRORS.CATCH_ALL_EXCEPT_UNAUTHORIZED];
const WRITE_HANDLING = [
	FETCH_SUCCESS.CONTENT,
	FETCH_ERRORS.CONFLICT,
	FETCH_ERRORS.CATCH_ALL_EXCEPT_UNAUTHORIZED
];

/**
 * Rejects with `NO_MATCH` when the backend has no such endpoint (404), so
 * the caller can tell an older backend from a failed read.
 */
export const apiGetUpcomingAppointments = (): Promise<SessionAppointment[]> =>
	fetchData({
		url: endpoints.upcomingAppointments,
		method: FETCH_METHODS.GET,
		responseHandling: [FETCH_ERRORS.NO_MATCH, ...READ_HANDLING]
	});

export const apiGetSessionAppointments = (
	sessionId: number
): Promise<SessionAppointment[]> =>
	fetchData({
		url: endpoints.sessionAppointments(sessionId),
		method: FETCH_METHODS.GET,
		responseHandling: READ_HANDLING
	});

export const apiCreateSessionAppointment = (
	sessionId: number,
	slot: SessionAppointmentSlot
): Promise<SessionAppointment> =>
	fetchData({
		url: endpoints.sessionAppointments(sessionId),
		method: FETCH_METHODS.POST,
		bodyData: JSON.stringify(slot),
		responseHandling: WRITE_HANDLING
	});

export const apiMoveSessionAppointment = (
	sessionId: number,
	appointmentId: string,
	slot: SessionAppointmentSlot
): Promise<SessionAppointment> =>
	fetchData({
		url: `${endpoints.sessionAppointments(sessionId)}/${appointmentId}`,
		method: FETCH_METHODS.PUT,
		bodyData: JSON.stringify(slot),
		responseHandling: WRITE_HANDLING
	});

export const apiCancelSessionAppointment = (
	sessionId: number,
	appointmentId: string
): Promise<SessionAppointment> =>
	fetchData({
		url: `${endpoints.sessionAppointments(sessionId)}/${appointmentId}/cancel`,
		method: FETCH_METHODS.POST,
		responseHandling: WRITE_HANDLING
	});

/**
 * FE#1050: the counsellor's free slots that start in [from, to), earliest
 * first. The server allows at most fourteen days and offers nothing inside
 * its lead time.
 */
export const apiGetAppointmentSlots = (
	sessionId: number,
	from: Date,
	to: Date,
	medium: SelfBookingMedium
): Promise<AppointmentSlot[]> => {
	const query = new URLSearchParams({
		from: from.toISOString(),
		to: to.toISOString(),
		medium
	});
	return fetchData({
		url: `${endpoints.sessionAppointmentSlots(sessionId)}?${query}`,
		method: FETCH_METHODS.GET,
		responseHandling: READ_HANDLING
	});
};

/**
 * FE#1050: books one offered slot. A 409 rejects with the `Response`, whose
 * `X-Reason` tells the cases apart: `SELF_BOOKING_LIMIT_REACHED` (the
 * conversation already has an upcoming appointment),
 * `SLOT_OUTSIDE_BOOKING_WINDOW`, or none (the time was taken meanwhile).
 */
export const apiBookAppointmentSlot = (
	sessionId: number,
	slot: AppointmentSlot & { kind: SelfBookingMedium }
): Promise<SessionAppointment> =>
	fetchData({
		url: `${endpoints.sessionAppointmentSlots(sessionId)}/booking`,
		method: FETCH_METHODS.POST,
		bodyData: JSON.stringify(slot),
		responseHandling: [
			FETCH_SUCCESS.CONTENT,
			FETCH_ERRORS.CONFLICT_WITH_RESPONSE,
			FETCH_ERRORS.CATCH_ALL_EXCEPT_UNAUTHORIZED
		]
	});
