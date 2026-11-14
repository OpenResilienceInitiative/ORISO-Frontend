/**
 * "Meine Termine" (`/booking/events`) connected to UserService (ADR-032).
 *
 * - Entries load per visible range, own calendar and every switched-on
 *   colleague separately (UserService enforces the Träger's reach and strips
 *   what colleagues may not see).
 * - 1:1 appointments go through the conversation's appointment API and leave
 *   the same notice in the conversation as the timeline does, so the advice
 *   seeker learns about it.
 * - Blocked times, the subscription link, the busy-time import and the
 *   counsellor's working hours (shaded outside, offered as free hours) use
 *   the calendar API. Working hours carry the holiday region and the day
 *   exceptions (contract v1.2); a grip saves at once and goes back if the
 *   save fails.
 * - The next days stay loaded on their own, so "Als Nächstes" and the next
 *   free hours stay right while the grid shows another month.
 * - Proposals to move a colleague's appointment have no backend yet, so the
 *   page gets no proposal props here (Storybook shows them).
 */
import * as React from 'react';
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
	AUTHORITIES,
	hasUserAuthority,
	UserDataContext
} from '../../globalState';
import { useResponsive } from '../../hooks/useResponsive';
import {
	apiCreateCalendarBlocker,
	apiDeleteCalendarBlocker,
	apiDeleteWorkingDayException,
	apiGetCalendarColleagues,
	apiGetCalendarEntries,
	apiGetCalendarSync,
	apiGetCalendarWorkingHours,
	apiGetColleagueCalendarEntries,
	apiMoveCalendarBlocker,
	apiPutWorkingDayException,
	apiRemoveCalendarImport,
	apiResetCalendarFeed,
	apiSaveCalendarImport,
	apiSetCalendarWorkingHours,
	type CalendarSyncDTO
} from '../../api/apiCalendar';
import {
	apiCancelSessionAppointment,
	apiCreateSessionAppointment,
	apiMoveSessionAppointment
} from '../../api/apiSessionAppointments';
import { apiGetConsultantSessionList } from '../../api/apiGetConsultantSessionList';
import { apiGetAskerSessionList } from '../../api/apiGetAskerSessionList';
import { SESSION_LIST_TYPES } from '../session/sessionHelpers';
import {
	notifyAppointmentsChanged,
	onAppointmentsChanged
} from '../sessionsList/timeline/conversationAppointments';
import { useAppointmentNotice } from '../sessionsList/timeline/useAppointmentNotice';
import { CalendarPage, type CalendarLoadState } from './CalendarPage';
import {
	blockerToApi,
	colleagueFromApi,
	entryFromApi,
	feedFromApi,
	importFromApi,
	kindToApi,
	loadWindow,
	normalizeImportUrl,
	visibilityFromApi
} from './calendarApiMapping';
import {
	DEFAULT_VISIBILITY,
	type AppointmentDraft,
	type CalendarConversation,
	type CalendarEntry,
	type CalendarVisibility,
	type Colleague
} from './calendarModel';
import {
	dayExceptionsFromApi,
	exceptionWindowsToApi,
	normalizeWindows,
	workingPlanFromApi,
	workingPlanToApi,
	type TimeWindow,
	type WorkingHours,
	type WorkingPlan
} from './calendarWorkingHours';
import type { HolidayRegion } from './calendarHolidays';

/** How many own conversations the create dialog offers. */
const CONVERSATION_LOOKUP_COUNT = 100;

/**
 * "Als Nächstes" and the next free hours look this far ahead from today,
 * whatever the grid shows (review 4574733789).
 */
const NEARBY_DAYS = 8;

const nearbyWindow = () => {
	const from = new Date();
	from.setHours(0, 0, 0, 0);
	const to = new Date(from);
	to.setDate(to.getDate() + NEARBY_DAYS);
	return { from, to };
};

/** One entry once, the loaded window's copy first. */
const mergeEntries = (first: CalendarEntry[], second: CalendarEntry[]) => {
	const seen = new Set(first.map((e) => e.id));
	return [...first, ...second.filter((e) => !seen.has(e.id))];
};

interface ConversationRef extends CalendarConversation {
	matrixRoomId?: string;
}

const toConversations = (items: any[] | undefined): ConversationRef[] =>
	(items ?? [])
		.filter((item) => item?.session?.id && !item?.chat)
		.map((item) => ({
			sessionId: item.session.id,
			username:
				item.user?.username ??
				item.consultant?.displayName ??
				item.consultant?.username ??
				String(item.session.id),
			matrixRoomId: item.session.matrixRoomId
		}));

export const CalendarPageWired = () => {
	const navigate = useNavigate();
	const { untilM } = useResponsive();
	const { userData } = useContext(UserDataContext);
	const consultant = hasUserAuthority(
		AUTHORITIES.CONSULTANT_DEFAULT,
		userData
	);
	const ownerId = userData?.userId ?? '';
	const sendNotice = useAppointmentNotice();

	const [state, setState] = useState<CalendarLoadState>('loading');
	const [own, setOwn] = useState<CalendarEntry[]>([]);
	/** Own entries of the next days, when the grid shows another time. */
	const [nearby, setNearby] = useState<CalendarEntry[]>([]);
	const [colleagueEntries, setColleagueEntries] = useState<
		Record<string, CalendarEntry[]>
	>({});
	const [colleagues, setColleagues] = useState<Colleague[]>([]);
	const [visibility, setVisibility] =
		useState<CalendarVisibility>(DEFAULT_VISIBILITY);
	const [conversations, setConversations] = useState<ConversationRef[]>([]);
	const [sync, setSync] = useState<CalendarSyncDTO>();
	const [plan, setPlan] = useState<WorkingPlan>();
	/** The saved schedule has loaded: until then it cannot be edited. */
	const [planLoaded, setPlanLoaded] = useState(false);
	/** The plan as UserService last confirmed it; failures go back to it. */
	const confirmed = useRef<WorkingPlan | undefined>(undefined);
	/** Owners: the latest weekly save, the latest save per date. */
	const weeklyOp = useRef(0);
	const exceptionOps = useRef<Record<string, number>>({});
	/** Edits since mount; the first read only applies when there are none. */
	const planEdits = useRef(0);

	const range = useRef<{ from: Date; to: Date } | undefined>(undefined);
	const shown = useRef<string[]>([]);
	const request = useRef(0);

	const loadColleague = useCallback((id: string) => {
		const window = range.current;
		if (!window) return Promise.resolve();
		return apiGetColleagueCalendarEntries(id, window.from, window.to).then(
			(list) =>
				setColleagueEntries((all) => ({
					...all,
					[id]: list.map(entryFromApi)
				})),
			// A colleague who left the Träger's reach: show nothing for them.
			() =>
				setColleagueEntries((all) => ({
					...all,
					[id]: []
				}))
		);
	}, []);

	const load = useCallback(() => {
		const window = range.current;
		if (!window) return;
		const id = ++request.current;
		apiGetCalendarEntries(window.from, window.to).then(
			(list) => {
				if (id !== request.current) return;
				setOwn(list.map(entryFromApi));
				setState('ready');
			},
			() => {
				if (id === request.current) setState('error');
			}
		);
		const near = nearbyWindow();
		if (
			window.from.getTime() <= near.from.getTime() &&
			window.to.getTime() >= near.to.getTime()
		)
			setNearby([]);
		else
			apiGetCalendarEntries(near.from, near.to).then(
				(list) =>
					id === request.current && setNearby(list.map(entryFromApi)),
				() => undefined
			);
		shown.current.forEach((colleague) => loadColleague(colleague));
	}, [loadColleague]);

	const changeRange = useCallback(
		(start: Date, end: Date) => {
			const next = loadWindow(start, end);
			const current = range.current;
			// Paging inside the loaded window needs no request.
			if (
				current &&
				current.from.getTime() <= start.getTime() &&
				current.to.getTime() >= end.getTime()
			)
				return;
			range.current = next;
			load();
		},
		[load]
	);

	useEffect(() => onAppointmentsChanged(load), [load]);

	useEffect(() => {
		let cancelled = false;
		if (consultant) {
			apiGetCalendarColleagues().then(
				(dto) => {
					if (cancelled) return;
					setColleagues(dto.colleagues.map(colleagueFromApi));
					setVisibility(visibilityFromApi(dto));
				},
				() => undefined
			);
			apiGetCalendarSync().then(
				(dto) => !cancelled && setSync(dto),
				() => undefined
			);
			// Without an answer the calendar shades nothing, as with none set,
			// and the schedule stays closed for editing: saving it would
			// write a default over the stored one (review 4574779938). A read
			// that answers after an edit changes nothing (review 4574779933).
			const edits = planEdits.current;
			apiGetCalendarWorkingHours().then(
				(dto) => {
					if (cancelled) return;
					const loaded = workingPlanFromApi(dto);
					confirmed.current = loaded;
					if (planEdits.current === edits) setPlan(loaded);
					setPlanLoaded(true);
				},
				() => undefined
			);
			apiGetConsultantSessionList({
				type: SESSION_LIST_TYPES.MY_SESSION,
				count: CONVERSATION_LOOKUP_COUNT
			}).then(
				(list) =>
					!cancelled &&
					setConversations(toConversations(list?.sessions)),
				() => undefined
			);
		} else {
			apiGetAskerSessionList().then(
				(list) =>
					!cancelled &&
					setConversations(toConversations(list?.sessions)),
				() => undefined
			);
		}
		return () => {
			cancelled = true;
		};
	}, [consultant]);

	const conversationOf = (sessionId?: number) =>
		conversations.find((c) => c.sessionId === sessionId);

	const notice = (
		kind: 'created' | 'moved' | 'cancelled',
		sessionId: number,
		start: Date,
		end: Date
	) =>
		sendNotice({
			kind,
			start,
			end,
			sessionId,
			matrixRoomId: conversationOf(sessionId)?.matrixRoomId
		});

	const afterChange = () => {
		notifyAppointmentsChanged();
	};

	const create = async (drafts: AppointmentDraft[]) => {
		const first = drafts[0];
		if (first.type === 'blocker') {
			const created = await apiCreateCalendarBlocker(
				blockerToApi(drafts)
			);
			afterChange();
			// The page offers "undo" on exactly these.
			return (created ?? []).map(entryFromApi);
		}
		if (first.sessionId === undefined) throw new Error('conversation');
		await apiCreateSessionAppointment(first.sessionId, {
			startTime: first.start.toISOString(),
			endTime: first.end.toISOString(),
			...(first.kind && { kind: kindToApi(first.kind) })
		});
		afterChange();
		await notice('created', first.sessionId, first.start, first.end);
	};

	const move = async (entry: CalendarEntry, start: Date, end: Date) => {
		const slot = {
			startTime: start.toISOString(),
			endTime: end.toISOString()
		};
		// Show the new time at once; a failure reloads the stored state.
		const moved = (all: CalendarEntry[]) =>
			all.map((e) =>
				e.id === entry.id
					? { ...e, start: slot.startTime, end: slot.endTime }
					: e
			);
		setOwn(moved);
		setNearby(moved);
		try {
			if (entry.type === 'blocker')
				await apiMoveCalendarBlocker(entry.id, {
					start: slot.startTime,
					end: slot.endTime
				});
			else if (entry.sessionId !== undefined) {
				await apiMoveSessionAppointment(
					entry.sessionId,
					entry.id,
					slot
				);
				await notice('moved', entry.sessionId, start, end);
			}
		} finally {
			afterChange();
		}
	};

	const cancel = async (entry: CalendarEntry) => {
		if (entry.sessionId === undefined) return;
		await apiCancelSessionAppointment(entry.sessionId, entry.id);
		afterChange();
		await notice(
			'cancelled',
			entry.sessionId,
			new Date(entry.start),
			new Date(entry.end)
		);
	};

	const removeBlocker = async (entry: CalendarEntry) => {
		await apiDeleteCalendarBlocker(entry.id);
		afterChange();
	};

	const start = (entry: CalendarEntry) => {
		const conversation = conversationOf(entry.sessionId);
		if (!conversation?.matrixRoomId) return;
		navigate(
			`${consultant ? '/sessions/consultant/sessionView' : '/sessions/user/view'}/${conversation.matrixRoomId}/${conversation.sessionId}`
		);
	};

	// Working hours, holiday region and day exceptions show the change at
	// once; a failed save puts the stored state back and rejects, so the
	// page says it did not work. Each part has its own owner: the weekly
	// fields belong to the latest weekly save, each date's exception to
	// the latest save of that date. An older answer or failure changes
	// nothing a newer operation has written (reviews 4574981869,
	// 4574981870, 4574981875).
	const saveWorkingHours = async (
		hours: WorkingHours,
		holidayRegion: HolidayRegion | null
	) => {
		const generation = ++weeklyOp.current;
		planEdits.current += 1;
		const latest = () => generation === weeklyOp.current;
		const next: WorkingPlan = { ...plan, hours, holidayRegion };
		setPlan((current) => ({ ...current, hours, holidayRegion }));
		try {
			const saved = await apiSetCalendarWorkingHours(
				workingPlanToApi(next)
			);
			const stored = workingPlanFromApi(saved);
			confirmed.current = {
				...confirmed.current,
				hours: stored.hours,
				holidayRegion: stored.holidayRegion
			};
			if (!latest()) return;
			// Only the weekly fields: the answer's exceptions are a snapshot
			// that a day save running alongside may already have replaced.
			setPlan((current) => ({
				...current,
				hours: stored.hours,
				holidayRegion: stored.holidayRegion
			}));
			setPlanLoaded(true);
		} catch (error) {
			// Back to what UserService last confirmed.
			if (latest())
				setPlan((current) => ({
					...current,
					hours: confirmed.current?.hours ?? [],
					holidayRegion: confirmed.current?.holidayRegion ?? null
				}));
			throw error;
		}
	};

	const setException = (date: string, windows: TimeWindow[] | undefined) =>
		setPlan((current) => {
			const exceptions = { ...current?.exceptions };
			if (windows) exceptions[date] = windows;
			else delete exceptions[date];
			return { hours: [], ...current, exceptions };
		});

	/** What UserService last confirmed for `date`. */
	const confirmException = (date: string, windows?: TimeWindow[]) => {
		const exceptions = { ...confirmed.current?.exceptions };
		if (windows) exceptions[date] = windows;
		else delete exceptions[date];
		confirmed.current = { hours: [], ...confirmed.current, exceptions };
	};

	/** A new operation on `date`; `latest()` says whether it still owns it. */
	const ownDate = (date: string) => {
		const generation = (exceptionOps.current[date] ?? 0) + 1;
		exceptionOps.current[date] = generation;
		planEdits.current += 1;
		return () => exceptionOps.current[date] === generation;
	};

	const saveDayException = async (date: string, windows: TimeWindow[]) => {
		const latest = ownDate(date);
		const shown = normalizeWindows(windows);
		setException(date, shown);
		try {
			const saved = await apiPutWorkingDayException(
				date,
				exceptionWindowsToApi(windows)
			);
			const stored =
				dayExceptionsFromApi(saved ? [saved] : [])[date] ?? shown;
			confirmException(date, stored);
			if (latest()) setException(date, stored);
		} catch (error) {
			if (latest())
				setException(date, confirmed.current?.exceptions?.[date]);
			throw error;
		}
	};

	const deleteDayException = async (date: string) => {
		const latest = ownDate(date);
		setException(date, undefined);
		try {
			await apiDeleteWorkingDayException(date);
			confirmException(date, undefined);
		} catch (error) {
			if (latest())
				setException(date, confirmed.current?.exceptions?.[date]);
			throw error;
		}
	};

	const showColleagues = (ids: string[]) => {
		const added = ids.filter((id) => !shown.current.includes(id));
		shown.current = ids;
		added.forEach((id) => loadColleague(id));
	};

	// CalendarPage shows only the colleagues switched on.
	const entries = [
		...mergeEntries(own, nearby),
		...Object.values(colleagueEntries).flat()
	];

	return (
		<CalendarPage
			role={consultant ? 'consultant' : 'asker'}
			ownerId={ownerId}
			state={state}
			entries={entries}
			colleagues={colleagues}
			visibility={visibility}
			conversations={conversations}
			feed={sync ? feedFromApi(sync) : undefined}
			busyImport={sync ? importFromApi(sync) : {}}
			compact={untilM}
			workingHours={consultant ? plan?.hours : undefined}
			workingHoursLoaded={consultant && planLoaded}
			dayExceptions={consultant ? plan?.exceptions : undefined}
			holidayRegion={consultant ? (plan?.holidayRegion ?? null) : null}
			onRangeChange={changeRange}
			onShownColleaguesChange={showColleagues}
			onRetry={() => {
				setState('loading');
				load();
			}}
			onCreate={consultant ? create : undefined}
			onMove={consultant ? move : undefined}
			onCancelAppointment={consultant ? cancel : undefined}
			onRemoveBlocker={consultant ? removeBlocker : undefined}
			onSaveWorkingHours={consultant ? saveWorkingHours : undefined}
			onSaveDayException={consultant ? saveDayException : undefined}
			onDeleteDayException={consultant ? deleteDayException : undefined}
			onStart={start}
			onOpenChat={start}
			onCopyFeed={(url) => navigator.clipboard?.writeText(url)}
			onResetFeed={() =>
				apiResetCalendarFeed().then(setSync, () => undefined)
			}
			onSaveImport={(url) =>
				apiSaveCalendarImport(normalizeImportUrl(url)).then(
					setSync,
					() =>
						setSync((current) =>
							current
								? { ...current, importError: 'INVALID_URL' }
								: current
						)
				)
			}
			onRemoveImport={() =>
				apiRemoveCalendarImport().then(setSync, () => undefined)
			}
		/>
	);
};
