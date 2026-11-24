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

export type CalendarEntryTypeDTO =
	| 'APPOINTMENT'
	| 'GROUP'
	| 'BLOCKER'
	| 'BUSY'
	| 'ABSENCE';
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
	/** Own blockers only: entered as whole days (UserService#1663). */
	allDay?: boolean | null;
	movable?: boolean;
	/** FE#2287: own view only, an advice seeker's request waiting for confirmation. */
	requested?: boolean;
	/** Own view, appointments with a colleague only (FE#2305). */
	colleagueId?: string | null;
	colleagueName?: string | null;
	colleagueStatus?: 'PENDING' | 'CONFIRMED' | null;
	invited?: boolean | null;
	matrixRoomId?: string | null;
	chatId?: number | null;
}

export interface CalendarColleagueDTO {
	id: string;
	displayName: string;
	agencyName?: string | null;
	/**
	 * Tells colleagues of one name apart: their ORISO username, sent for
	 * colleagues of the own Träger only (UserService#1663).
	 */
	secondaryLabel?: string | null;
	relation: 'SAME_AGENCY' | 'SAME_TENANT' | 'OTHER_TENANT';
	/** FE#2305: false = no internal chat possible, on-site appointments only. */
	internalChat?: boolean | null;
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

/**
 * One weekly window of working time (UserService#1649): local wall-clock
 * time in the platform's zone, weekday 0 = Sunday .. 6 = Saturday.
 */
export interface CalendarWorkingHoursWindowDTO {
	weekday: number;
	/** HH:mm */
	start: string;
	/** HH:mm, after start */
	end: string;
}

/** A window of one date (contract v1.2): a weekly window without weekday. */
export interface CalendarWorkingTimeWindowDTO {
	/** HH:mm */
	start: string;
	/** HH:mm, after start */
	end: string;
}

/**
 * The working windows of one local date (Europe/Berlin), replacing the
 * weekly rule there. Empty `windows` = the whole day off.
 */
export interface CalendarWorkingDayExceptionDTO {
	/** YYYY-MM-DD */
	date: string;
	windows: CalendarWorkingTimeWindowDTO[];
}

/** Bundesland whose public holidays count as days off (contract v1.2). */
export type CalendarHolidayRegionDTO =
	| 'BW'
	| 'BY'
	| 'BE'
	| 'BB'
	| 'HB'
	| 'HH'
	| 'HE'
	| 'MV'
	| 'NI'
	| 'NW'
	| 'RP'
	| 'SL'
	| 'SN'
	| 'ST'
	| 'SH'
	| 'TH';

/** All windows of the caller; an empty list means "none set". */
export interface CalendarWorkingHoursDTO {
	windows: CalendarWorkingHoursWindowDTO[];
	/** Absent or null = holidays are not days off. PUT always sends it. */
	holidayRegion?: CalendarHolidayRegionDTO | null;
	/**
	 * Read-only: day exceptions from 62 days back, by date. Ignored on PUT;
	 * change them through `apiPutWorkingDayException`.
	 */
	exceptions?: CalendarWorkingDayExceptionDTO[];
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

/**
 * A counsellor's Sprechstunden (FE#2287): weekly windows advice seekers can
 * book, separate from the working hours, and how they are booked.
 */
export interface CalendarConsultationHoursDTO {
	windows: CalendarWorkingHoursWindowDTO[];
	/** A booking outside the notice period is confirmed at once. Default true. */
	autoAccept?: boolean;
	/** Inside this many days before the start a booking is a request. Default 1. */
	noticeDays?: number;
	/** 30 or 60. Default 60. */
	slotMinutes?: 30 | 60;
}

export const apiGetCalendarConsultationHours =
	(): Promise<CalendarConsultationHoursDTO> =>
		fetchData({
			url: `${base()}/consultation-hours`,
			method: FETCH_METHODS.GET,
			responseHandling: READ_HANDLING
		});

/** Replaces every window and the three settings at once. */
export const apiSetCalendarConsultationHours = (
	hours: Required<CalendarConsultationHoursDTO>
): Promise<CalendarConsultationHoursDTO> =>
	fetchData({
		url: `${base()}/consultation-hours`,
		method: FETCH_METHODS.PUT,
		bodyData: JSON.stringify({
			windows: hours.windows,
			autoAccept: hours.autoAccept,
			noticeDays: hours.noticeDays,
			slotMinutes: hours.slotMinutes
		}),
		responseHandling: WRITE_HANDLING
	});

/**
 * A one-off Sprechzeit (FE#2494 *2b): a stretch released once, bookable
 * until `noticeMinutes` before its start, also over a Sperrzeit when
 * `overBlocker` says the counsellor saw the warning (else 409
 * `CONSULTATION_ONCE_OVER_BLOCKER`).
 */
export interface CalendarConsultationOnceDTO {
	id: string;
	start: string;
	end: string;
	noticeMinutes: number;
	overBlocker: boolean;
}

/** The caller's one-offs that have not ended, by start. */
export const apiGetCalendarConsultationOnce = (): Promise<
	CalendarConsultationOnceDTO[]
> =>
	fetchData({
		url: `${base()}/consultation-hours/once`,
		method: FETCH_METHODS.GET,
		responseHandling: READ_HANDLING
	}).then((list) => list ?? []);

export const apiCreateCalendarConsultationOnce = (once: {
	start: Date;
	end: Date;
	noticeMinutes: number;
	overBlocker: boolean;
}): Promise<CalendarConsultationOnceDTO> =>
	fetchData({
		url: `${base()}/consultation-hours/once`,
		method: FETCH_METHODS.POST,
		bodyData: JSON.stringify({
			start: once.start.toISOString(),
			end: once.end.toISOString(),
			noticeMinutes: once.noticeMinutes,
			overBlocker: once.overBlocker
		}),
		responseHandling: WRITE_HANDLING
	});

export const apiDeleteCalendarConsultationOnce = (id: string): Promise<void> =>
	fetchData({
		url: `${base()}/consultation-hours/once/${encodeURIComponent(id)}`,
		method: FETCH_METHODS.DELETE,
		responseHandling: [FETCH_ERRORS.CATCH_ALL_EXCEPT_UNAUTHORIZED]
	});

export const apiGetCalendarWorkingHours =
	(): Promise<CalendarWorkingHoursDTO> =>
		fetchData({
			url: `${base()}/working-hours`,
			method: FETCH_METHODS.GET,
			responseHandling: READ_HANDLING
		});

/**
 * Replaces every window and the holiday region; an empty list removes the
 * working hours. `exceptions` are not sent (the server ignores them).
 */
export const apiSetCalendarWorkingHours = (
	hours: Omit<CalendarWorkingHoursDTO, 'exceptions'>
): Promise<CalendarWorkingHoursDTO> =>
	fetchData({
		url: `${base()}/working-hours`,
		method: FETCH_METHODS.PUT,
		bodyData: JSON.stringify({
			windows: hours.windows,
			holidayRegion: hours.holidayRegion ?? null
		}),
		responseHandling: WRITE_HANDLING
	});

const exceptionUrl = (date: string) =>
	`${base()}/working-hours/exceptions/${encodeURIComponent(date)}`;

/**
 * Creates or replaces the exception of one date ("Nur an diesem Tag");
 * empty `windows` takes the whole day off.
 */
export const apiPutWorkingDayException = (
	date: string,
	windows: CalendarWorkingTimeWindowDTO[]
): Promise<CalendarWorkingDayExceptionDTO> =>
	fetchData({
		url: exceptionUrl(date),
		method: FETCH_METHODS.PUT,
		bodyData: JSON.stringify({ windows }),
		responseHandling: WRITE_HANDLING
	});

/** The date falls back to the weekly rule (204, also when none existed). */
export const apiDeleteWorkingDayException = (date: string): Promise<void> =>
	fetchData({
		url: exceptionUrl(date),
		method: FETCH_METHODS.DELETE,
		responseHandling: [FETCH_ERRORS.CATCH_ALL_EXCEPT_UNAUTHORIZED]
	});

/**
 * A request to move a colleague's appointment (contract "move proposals v1",
 * ADR-032 addendum). Open proposals only; UserService drops a proposal once
 * the appointment moved, was cancelled or the proposed start has passed.
 */
export interface CalendarProposalDTO {
	id: string;
	/** The appointment that would move. */
	entryId: string;
	/** The proposed new time, UTC instants. */
	start: string;
	end: string;
	/** The appointment's time when the proposal was made. */
	entryStart: string;
	entryEnd: string;
	proposerId: string;
	proposerName?: string | null;
	/** The appointment's owner, who accepts or declines. */
	approverId: string;
	approverName?: string | null;
	/** Why the proposer asks, at most 500 characters (UserService#1663). */
	reason?: string | null;
	createdAt?: string | null;
}

export interface CalendarProposalsDTO {
	/** Proposals the caller made for colleagues' appointments. */
	sent: CalendarProposalDTO[];
	/** Proposals colleagues made for the caller's appointments. */
	received: CalendarProposalDTO[];
}

const proposalUrl = (id?: string, action?: 'accept' | 'decline') =>
	`${base()}/proposals${id ? `/${encodeURIComponent(id)}` : ''}${action ? `/${action}` : ''}`;

export const apiGetCalendarProposals = (): Promise<CalendarProposalsDTO> =>
	fetchData({
		url: proposalUrl(),
		method: FETCH_METHODS.GET,
		responseHandling: READ_HANDLING
	});

/**
 * Proposes a new time for a colleague's appointment. A second proposal for
 * the same appointment replaces the caller's open one.
 */
export const apiCreateCalendarProposal = (proposal: {
	entryId: string;
	start: string;
	end: string;
	reason?: string;
}): Promise<CalendarProposalDTO> =>
	fetchData({
		url: proposalUrl(),
		method: FETCH_METHODS.POST,
		bodyData: JSON.stringify(proposal),
		responseHandling: WRITE_HANDLING
	});

/** Withdraws one's own proposal (204, also when already decided). */
export const apiWithdrawCalendarProposal = (id: string): Promise<void> =>
	fetchData({
		url: proposalUrl(id),
		method: FETCH_METHODS.DELETE,
		responseHandling: WRITE_HANDLING
	});

/**
 * The approver accepts: the appointment moves and comes back. 409 (rejects
 * with `FETCH_ERRORS.CONFLICT`): it moved meanwhile, the proposal is void.
 */
export const apiAcceptCalendarProposal = (
	id: string
): Promise<CalendarEntryDTO> =>
	fetchData({
		url: proposalUrl(id, 'accept'),
		method: FETCH_METHODS.POST,
		responseHandling: WRITE_HANDLING
	});

/** The approver declines: the appointment stays where it is (204). */
export const apiDeclineCalendarProposal = (id: string): Promise<void> =>
	fetchData({
		url: proposalUrl(id, 'decline'),
		method: FETCH_METHODS.POST,
		responseHandling: WRITE_HANDLING
	});

// --- Appointments with a colleague (FE#2305) ---

const meetingUrl = (id?: string, action?: 'accept' | 'decline') =>
	`${base()}/colleague-appointments${id ? `/${encodeURIComponent(id)}` : ''}${action ? `/${action}` : ''}`;

export interface ColleagueAppointmentCreateDTO {
	colleagueId: string;
	start: string;
	end: string;
	kind: AppointmentKindDTO;
}

/**
 * Makes an appointment with a colleague and opens (or reuses) the private
 * internal chat of the two. Comes back as the caller's calendar shows it:
 * `colleagueStatus` PENDING until the colleague accepts, CONFIRMED when the
 * colleague accepts the caller automatically.
 */
export const apiCreateColleagueAppointment = (
	request: ColleagueAppointmentCreateDTO
): Promise<CalendarEntryDTO> =>
	fetchData({
		url: meetingUrl(),
		method: FETCH_METHODS.POST,
		bodyData: JSON.stringify(request),
		responseHandling: WRITE_HANDLING
	});

/** The invited counsellor accepts; 409 when it no longer waits. */
export const apiAcceptColleagueAppointment = (
	id: string
): Promise<CalendarEntryDTO> =>
	fetchData({
		url: meetingUrl(id, 'accept'),
		method: FETCH_METHODS.POST,
		responseHandling: WRITE_HANDLING
	});

/** The invited counsellor declines; it leaves both calendars (204). */
export const apiDeclineColleagueAppointment = (id: string): Promise<void> =>
	fetchData({
		url: meetingUrl(id, 'decline'),
		method: FETCH_METHODS.POST,
		responseHandling: WRITE_HANDLING
	});

/** Either of the two cancels; it leaves both calendars (204). */
export const apiCancelColleagueAppointment = (id: string): Promise<void> =>
	fetchData({
		url: meetingUrl(id),
		method: FETCH_METHODS.DELETE,
		responseHandling: WRITE_HANDLING
	});

export interface CalendarAutoAcceptDTO {
	colleagueIds: string[];
}

/** The colleagues whose appointments the caller accepts automatically. */
export const apiGetCalendarAutoAccept = (): Promise<CalendarAutoAcceptDTO> =>
	fetchData({
		url: `${base()}/auto-accept`,
		method: FETCH_METHODS.GET,
		responseHandling: READ_HANDLING
	});

/** Replaces the auto-accept list; colleagues outside the reach are refused. */
export const apiSetCalendarAutoAccept = (
	request: CalendarAutoAcceptDTO
): Promise<CalendarAutoAcceptDTO> =>
	fetchData({
		url: `${base()}/auto-accept`,
		method: FETCH_METHODS.PUT,
		bodyData: JSON.stringify(request),
		responseHandling: WRITE_HANDLING
	});
