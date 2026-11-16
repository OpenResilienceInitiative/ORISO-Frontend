/**
 * The counsellor calendar of ADR-032 (UserService `api/calendar.yaml`).
 * Appointments themselves are created, moved and cancelled through the
 * conversation's own API (`apiSessionAppointments`); this file reads the
 * calendar and owns blocked times, colleagues and the calendar sync.
 */
import { endpoints } from '../resources/scripts/endpoints';
import {
	FETCH_ERRORS,
	FETCH_METHODS,
	FETCH_SUCCESS,
	fetchData
} from './fetchData';

export type CalendarEntryTypeDTO = 'APPOINTMENT' | 'GROUP' | 'BLOCKER' | 'BUSY';
export type AppointmentKindDTO = 'ONSITE' | 'VIDEO' | 'PHONE' | 'CHAT';

export interface CalendarEntryDTO {
	id: string;
	type: CalendarEntryTypeDTO;
	/** UTC instants. */
	start: string;
	end: string;
	ownerId: string;
	kind?: AppointmentKindDTO | null;
	title?: string | null;
	sessionId?: number | null;
	seriesId?: string | null;
	movable?: boolean;
}

export interface CalendarColleagueDTO {
	id: string;
	displayName: string;
	agencyName?: string | null;
	relation: 'SAME_AGENCY' | 'SAME_TENANT' | 'OTHER_TENANT';
}

export interface CalendarColleaguesDTO {
	visibilityScope: 'AGENCY' | 'TENANT' | 'PLATFORM';
	showAskerUsernames: boolean;
	colleagues: CalendarColleagueDTO[];
}

export interface BlockerCreateDTO {
	start: string;
	end: string;
	allDay?: boolean;
	note?: string;
	/** Weekdays in JavaScript numbering (0 = Sunday); `until` as YYYY-MM-DD. */
	repeat?: { weekdays: number[]; until: string };
}

export interface CalendarSyncDTO {
	feedUrl: string;
	feedLastFetchedAt?: string | null;
	importConfigured: boolean;
	/** Only the host: the private address itself never comes back. */
	importHost?: string | null;
	importLastSyncAt?: string | null;
	importError?: string | null;
}

// A backend without the calendar must not send the app to the error page:
// every failure rejects for the caller, only a 401 keeps the session logic.
const READ_HANDLING = [FETCH_ERRORS.CATCH_ALL_EXCEPT_UNAUTHORIZED];
const WRITE_HANDLING = [
	FETCH_SUCCESS.CONTENT,
	FETCH_ERRORS.CONFLICT,
	FETCH_ERRORS.CATCH_ALL_EXCEPT_UNAUTHORIZED
];

const base = () => endpoints.calendarBase;
const range = (from: Date, to: Date) =>
	`from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`;

export const apiGetCalendarEntries = (
	from: Date,
	to: Date,
	signal?: AbortSignal
): Promise<CalendarEntryDTO[]> =>
	fetchData({
		url: `${base()}/entries?${range(from, to)}`,
		method: FETCH_METHODS.GET,
		responseHandling: READ_HANDLING,
		...(signal && { signal })
	});

export const apiGetCalendarColleagues = (): Promise<CalendarColleaguesDTO> =>
	fetchData({
		url: `${base()}/colleagues`,
		method: FETCH_METHODS.GET,
		responseHandling: READ_HANDLING
	});

export const apiGetColleagueCalendarEntries = (
	consultantId: string,
	from: Date,
	to: Date,
	signal?: AbortSignal
): Promise<CalendarEntryDTO[]> =>
	fetchData({
		url: `${base()}/colleagues/${encodeURIComponent(consultantId)}/entries?${range(from, to)}`,
		method: FETCH_METHODS.GET,
		responseHandling: READ_HANDLING,
		...(signal && { signal })
	});

export const apiCreateCalendarBlocker = (
	blocker: BlockerCreateDTO
): Promise<CalendarEntryDTO[]> =>
	fetchData({
		url: `${base()}/blockers`,
		method: FETCH_METHODS.POST,
		bodyData: JSON.stringify(blocker),
		responseHandling: WRITE_HANDLING
	});

export const apiMoveCalendarBlocker = (
	id: string,
	slot: { start: string; end: string }
): Promise<CalendarEntryDTO> =>
	fetchData({
		url: `${base()}/blockers/${encodeURIComponent(id)}`,
		method: FETCH_METHODS.PUT,
		bodyData: JSON.stringify(slot),
		responseHandling: WRITE_HANDLING
	});

export const apiDeleteCalendarBlocker = (id: string): Promise<void> =>
	fetchData({
		url: `${base()}/blockers/${encodeURIComponent(id)}`,
		method: FETCH_METHODS.DELETE,
		responseHandling: [FETCH_ERRORS.CATCH_ALL_EXCEPT_UNAUTHORIZED]
	});

export const apiGetCalendarSync = (): Promise<CalendarSyncDTO> =>
	fetchData({
		url: `${base()}/sync`,
		method: FETCH_METHODS.GET,
		responseHandling: READ_HANDLING
	});

export const apiResetCalendarFeed = (): Promise<CalendarSyncDTO> =>
	fetchData({
		url: `${base()}/sync/feed/reset`,
		method: FETCH_METHODS.POST,
		responseHandling: WRITE_HANDLING
	});

export const apiSaveCalendarImport = (
	icsUrl: string
): Promise<CalendarSyncDTO> =>
	fetchData({
		url: `${base()}/sync/import`,
		method: FETCH_METHODS.PUT,
		bodyData: JSON.stringify({ icsUrl }),
		responseHandling: WRITE_HANDLING
	});

export const apiRemoveCalendarImport = (): Promise<CalendarSyncDTO> =>
	fetchData({
		url: `${base()}/sync/import`,
		method: FETCH_METHODS.DELETE,
		responseHandling: WRITE_HANDLING
	});
