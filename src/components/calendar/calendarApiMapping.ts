/**
 * Between UserService's calendar DTOs and the calendar's own model. Pure, so
 * the container stays thin and the rules are tested without a browser.
 */
import type {
	BlockerCreateDTO,
	CalendarColleagueDTO,
	CalendarColleaguesDTO,
	CalendarEntryDTO,
	CalendarSyncDTO
} from '../../api/apiCalendar';
import type { SessionAppointmentKind } from '../../api/apiSessionAppointments';
import {
	DEFAULT_APPOINTMENT_KIND,
	isAllDayRange,
	type AppointmentDraft,
	type AppointmentKind,
	type CalendarEntry,
	type CalendarEntryType,
	type CalendarVisibility,
	type Colleague,
	type ColleagueRelation
} from './calendarModel';
import type { CalendarFeed, CalendarImport } from './CalendarSyncDialog';

const TYPE: Record<CalendarEntryDTO['type'], CalendarEntryType> = {
	APPOINTMENT: 'appointment',
	GROUP: 'group',
	BLOCKER: 'blocker',
	BUSY: 'busy'
};

const KIND: Record<SessionAppointmentKind, AppointmentKind> = {
	ONSITE: 'onsite',
	VIDEO: 'video',
	PHONE: 'phone',
	CHAT: 'chat'
};

const RELATION: Record<CalendarColleagueDTO['relation'], ColleagueRelation> = {
	SAME_AGENCY: 'sameAgency',
	SAME_TENANT: 'sameTenant',
	OTHER_TENANT: 'otherTenant'
};

export const kindToApi = (kind: AppointmentKind): SessionAppointmentKind =>
	kind.toUpperCase() as SessionAppointmentKind;

/**
 * UserService leaves out every field that is null, so anything optional may
 * be missing. An appointment without a kind (made before the kind existed,
 * or a kind this frontend does not know yet) is a video call, as in the
 * timeline; other types never carry one. A blocker over whole days is shown
 * in the all-day row.
 */
export const entryFromApi = (dto: CalendarEntryDTO): CalendarEntry => {
	const type = TYPE[dto.type] ?? 'busy';
	return {
		id: dto.id,
		type,
		start: dto.start,
		end: dto.end,
		ownerId: dto.ownerId,
		...(type === 'appointment' && {
			kind: (dto.kind && KIND[dto.kind]) || DEFAULT_APPOINTMENT_KIND
		}),
		...(dto.title && { title: dto.title }),
		...(typeof dto.sessionId === 'number' && { sessionId: dto.sessionId }),
		...((type === 'blocker' || type === 'busy') &&
			isAllDayRange(dto.start, dto.end) && { allDay: true }),
		movable: dto.movable === true
	};
};

export const colleagueFromApi = (dto: CalendarColleagueDTO): Colleague => ({
	id: dto.id,
	displayName: dto.displayName,
	agencyName: dto.agencyName ?? '',
	relation: RELATION[dto.relation] ?? 'otherTenant'
});

export const visibilityFromApi = (
	dto: Pick<CalendarColleaguesDTO, 'visibilityScope' | 'showAskerUsernames'>
): CalendarVisibility => ({
	scope: dto.visibilityScope,
	showUsernames: dto.showAskerUsernames === true
});

const localDate = (date: Date) =>
	`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/**
 * The dialog hands over one draft per blocked time; UserService wants the
 * first one plus the repeat rule and expands the series itself.
 */
export const blockerToApi = (drafts: AppointmentDraft[]): BlockerCreateDTO => {
	const first = drafts[0];
	return {
		start: first.start.toISOString(),
		end: first.end.toISOString(),
		...(first.allDay && { allDay: true }),
		...(first.note?.trim() && { note: first.note.trim() }),
		...(first.repeat &&
			first.repeat.weekdays.length > 0 && {
				repeat: {
					weekdays: first.repeat.weekdays,
					until: localDate(first.repeat.until)
				}
			})
	};
};

export const feedFromApi = (dto: CalendarSyncDTO): CalendarFeed => ({
	url: dto.feedUrl,
	...(dto.feedLastFetchedAt && { lastFetchedAt: dto.feedLastFetchedAt })
});

export const importFromApi = (dto: CalendarSyncDTO): CalendarImport => ({
	...(dto.importConfigured && { host: dto.importHost ?? '' }),
	...(dto.importLastSyncAt && { lastSyncedAt: dto.importLastSyncAt }),
	failed: Boolean(dto.importError)
});

/** Calendar apps hand out `webcal://`; the server fetches over https. */
export const normalizeImportUrl = (url: string) =>
	url.trim().replace(/^webcal:\/\//i, 'https://');

/**
 * The time span to load for a visible range: whole days, a week of margin on
 * both sides (so "Als Nächstes" and a quick page turn have data), never more
 * than the 62 days UserService accepts.
 */
export const MAX_WINDOW_DAYS = 62;
export const loadWindow = (from: Date, to: Date) => {
	const day = 86_400_000;
	const start = new Date(from.getTime() - 7 * day);
	start.setHours(0, 0, 0, 0);
	const wanted = new Date(to.getTime() + 7 * day);
	const latest = new Date(start.getTime() + MAX_WINDOW_DAYS * day);
	return {
		from: start,
		to: wanted.getTime() > latest.getTime() ? latest : wanted
	};
};
