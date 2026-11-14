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

// A backend without these endpoints must leave the app untouched: every
// failure rejects for the caller to handle, only a 401 keeps the session logic.
const READ_HANDLING = [FETCH_ERRORS.CATCH_ALL_EXCEPT_UNAUTHORIZED];
const WRITE_HANDLING = [
	FETCH_SUCCESS.CONTENT,
	FETCH_ERRORS.CONFLICT,
	FETCH_ERRORS.CATCH_ALL_EXCEPT_UNAUTHORIZED
];

export const apiGetUpcomingAppointments = (): Promise<SessionAppointment[]> =>
	fetchData({
		url: endpoints.upcomingAppointments,
		method: FETCH_METHODS.GET,
		responseHandling: READ_HANDLING
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
