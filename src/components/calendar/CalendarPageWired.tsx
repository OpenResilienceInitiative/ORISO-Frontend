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
 * - Move proposals (contract "move proposals v1"): counsellors propose a new
 *   time for a colleague's appointment and answer the proposals for their
 *   own. They load with the entries, so a move, a cancellation or an answer
 *   that voids one also drops it. An accepted proposal moves the
 *   appointment in UserService; the notice in the conversation goes out
 *   from here, as for any move. The count of proposals waiting for an
 *   answer goes to "Meine Termine" in the navigation.
 */
import * as React from 'react';
import { CalendarLinksSection } from './CalendarLinksSection';
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
	AUTHORITIES,
	hasUserAuthority,
	UserDataContext
} from '../../globalState';
import { useMediaQuery } from 'react-responsive';
import { useResponsive } from '../../hooks/useResponsive';
import { COMPACT_MAX_WIDTH } from './calendarViews';
import {
	apiCreateCalendarBlocker,
	apiDeleteCalendarBlocker,
	apiDeleteWorkingDayException,
	apiAcceptCalendarProposal,
	apiAcceptColleagueAppointment,
	apiCancelColleagueAppointment,
	apiCreateColleagueAppointment,
	apiDeclineColleagueAppointment,
	apiGetCalendarAutoAccept,
	apiSetCalendarAutoAccept,
	apiCreateCalendarProposal,
	apiDeclineCalendarProposal,
	apiGetCalendarColleagues,
	apiGetCalendarEntries,
	apiGetCalendarProposals,
	apiGetCalendarSync,
	apiGetCalendarWorkingHours,
	apiGetCalendarConsultationHours,
	apiSetCalendarConsultationHours,
	apiGetColleagueCalendarEntries,
	apiMoveCalendarBlocker,
	apiPutWorkingDayException,
	apiRemoveCalendarImport,
	apiResetCalendarFeed,
	apiSaveCalendarImport,
	apiSetCalendarWorkingHours,
	apiWithdrawCalendarProposal,
	type CalendarSyncDTO
} from '../../api/apiCalendar';
import {
	apiCancelSessionAppointment,
	apiConfirmSessionAppointment,
	apiDeclineSessionAppointment,
	apiMoveSessionAppointment
} from '../../api/apiSessionAppointments';
import { apiGetConsultantSessionList } from '../../api/apiGetConsultantSessionList';
import { apiGetAskerSessionList } from '../../api/apiGetAskerSessionList';
import { FETCH_ERRORS } from '../../api/fetchData';
import { apiSetAbsence } from '../../api/apiSetAbsence';
import type { AbsenceDraft } from './AbsenceForm';
import { getSessionNavigationPath } from '../sessionsListItem/sessionsListItemHelpers';
import { SESSION_LIST_TYPES } from '../session/sessionHelpers';
import {
	notifyAppointmentsChanged,
	onAppointmentsChanged
} from '../sessionsList/timeline/conversationAppointments';
import { useAppointmentNotice } from '../sessionsList/timeline/useAppointmentNotice';
import { useTranslation } from 'react-i18next';
import { notifyDirectLinksChanged } from '../../api/apiDirectLinks';
import { CREATE_CHAT_PATH } from '../app/routePaths';
import type { DirectLink } from '../conversationCreate/directLink/directLink';
import { DirectLinkShareDialog } from '../conversationCreate/directLink/DirectLinkShareDialog';
import { useDirectLinkMedia } from '../directLinks/useDirectLinksAllowed';
import {
	toInvitationPresetState,
	type InvitationPreset
} from '../directInvitation/invitationModel';
import { invitationErrorEntry } from '../directInvitation/invitationErrorSnackbar';
import {
	InvitationAfterAppointmentError,
	saveAppointmentInvitation
} from '../directInvitation/saveAppointmentInvitation';
import { appSnackbarStack } from '../m3Snackbar/snackbarStack';
import { parseCalendarDayParam } from '../message/appointmentNotice';
import { CalendarPage, type CalendarLoadState } from './CalendarPage';
import type { FreeHoursState } from './CalendarSidebar';
import {
	blockerToApi,
	colleagueFromApi,
	entryFromApi,
	feedFromApi,
	importFromApi,
	kindToApi,
	loadWindow,
	normalizeImportUrl,
	proposalFromApi,
	visibilityFromApi
} from './calendarApiMapping';
import {
	addProposal,
	ProposalNoLongerValid,
	RequestedTimeTaken,
	withdrawProposal,
	type MoveProposal
} from './calendarActions';
import { publishReceivedProposalCount } from './calendarProposalCount';
import {
	appointmentConversationPath,
	appointmentRoomOf
} from './appointmentConversation';
import { startCallState, type CallKind } from '../call/startCallIntent';
import {
	DEFAULT_VISIBILITY,
	type AppointmentDraft,
	type AppointmentKind,
	type CalendarConversation,
	type CalendarEntry,
	type CalendarVisibility,
	type Colleague
} from './calendarModel';
import {
	dayExceptionsFromApi,
	exceptionWindowsToApi,
	normalizeWindows,
	TooManyDayExceptions,
	workingPlanFromApi,
	workingPlanToApi,
	type TimeWindow,
	type WorkingHours,
	type WorkingPlan
} from './calendarWorkingHours';
import {
	consultationHoursFromApi,
	type ConsultationHours
} from './calendarConsultationHours';
import type { HolidayRegion } from './calendarHolidays';

/** Page size of the conversation lookup; every page is loaded. */
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

const toConversations = (
	items: any[] | undefined,
	ownUserId?: string
): ConversationRef[] =>
	(items ?? [])
		.filter((item) => item?.session?.id && !item?.chat)
		.map((item) => ({
			sessionId: item.session.id,
			// A deleted advice seeker or another counsellor's conversation
			// keeps its appointments, but gets no new one (C1, C6).
			bookable:
				!item.user?.deleted &&
				!(
					ownUserId &&
					item.consultant?.id &&
					item.consultant.id !== ownUserId
				),
			username:
				item.user?.username ??
				item.consultant?.displayName ??
				item.consultant?.username ??
				String(item.session.id),
			matrixRoomId: item.session.matrixRoomId
		}));

/**
 * The call an appointment's start button starts in its conversation:
 * "Video-Call starten" the video call, "Anruf starten" the audio call.
 */
const CALL_OF_APPOINTMENT: Record<AppointmentKind, CallKind | undefined> = {
	video: 'video',
	phone: 'audio',
	chat: undefined,
	onsite: undefined
};

export const CalendarPageWired = () => {
	const navigate = useNavigate();
	// Phone and tablet share the phone layout up to 960 px; below the
	// shared $fromMedium (600 px) it is a phone with at most three days.
	const compact = useMediaQuery({ maxWidth: COMPACT_MAX_WIDTH });
	const { untilS: phone } = useResponsive();
	const { userData, reloadUserData } = useContext(UserDataContext);
	const consultant = hasUserAuthority(
		AUTHORITIES.CONSULTANT_DEFAULT,
		userData
	);
	// "Meine Direktlinks" lives under the list now (Frank, 2026-11-17).
	const ownerId = userData?.userId ?? '';
	const sendNotice = useAppointmentNotice();
	const { t } = useTranslation();
	/* One invitation flow with "Chat erstellen" and the 1:1: the same
	   "Direkteinladung erlauben" gate, the same share dialog. */
	const inviteMedia = useDirectLinkMedia(consultant);
	const allowGuestInvite = inviteMedia.length > 0;
	const [sharedInvitation, setSharedInvitation] = useState<DirectLink>();
	/* "Im Kalender öffnen" on an appointment's card in the chat: the page
	   mounts fresh from that link, so the first address is the one meant. */
	const [openOnDay] = useState(() =>
		parseCalendarDayParam(
			new URLSearchParams(window.location.search).get('date')
		)
	);

	const [state, setState] = useState<CalendarLoadState>('loading');
	const [own, setOwn] = useState<CalendarEntry[]>([]);
	/** Own entries of the next days, when the grid shows another time. */
	const [nearby, setNearby] = useState<CalendarEntry[]>([]);
	const [colleagueEntries, setColleagueEntries] = useState<
		Record<string, CalendarEntry[]>
	>({});
	const [colleagues, setColleagues] = useState<Colleague[]>([]);
	/** Undefined until read; a backend without FE#2305 keeps it so. */
	const [autoAcceptIds, setAutoAcceptIds] = useState<string[]>();
	const [visibility, setVisibility] =
		useState<CalendarVisibility>(DEFAULT_VISIBILITY);
	const [conversations, setConversations] = useState<ConversationRef[]>([]);
	const [conversationsFailed, setConversationsFailed] = useState(false);
	const [sync, setSync] = useState<CalendarSyncDTO>();
	const [plan, setPlan] = useState<WorkingPlan>();
	/* Sprechstunden (FE#2287): undefined until read, so unread ones are
	   never offered for editing and saved as empty. */
	const [consultationHours, setConsultationHours] =
		useState<ConsultationHours>();
	const [consultationHoursFailed, setConsultationHoursFailed] =
		useState(false);
	/** Read once on mount; again from ⋮ when that failed. */
	const loadConsultationHours = useCallback(
		(cancelled: () => boolean = () => false) => {
			setConsultationHoursFailed(false);
			apiGetCalendarConsultationHours().then(
				(dto) =>
					!cancelled() &&
					setConsultationHours(consultationHoursFromApi(dto)),
				() => !cancelled() && setConsultationHoursFailed(true)
			);
		},
		[]
	);
	/** The saved schedule has loaded: until then it cannot be edited. */
	const [planLoaded, setPlanLoaded] = useState(false);
	/**
	 * The saved schedule did not load. Free time is then unknown, not
	 * 08:00–18:00: the fallback knows no saved hours, pauses, exceptions
	 * or holidays (review 4581640874).
	 */
	const [planFailed, setPlanFailed] = useState(false);
	const planRequest = useRef(0);
	/** The plan as UserService last confirmed it; failures go back to it. */
	const confirmed = useRef<WorkingPlan | undefined>(undefined);
	/** Owners: the latest weekly save, the latest save per date. */
	const weeklyOp = useRef(0);
	const exceptionOps = useRef<Record<string, number>>({});
	/**
	 * The operation each confirmed part came from: an older answer that
	 * arrives late must not replace a newer confirmed one (review
	 * 4575297349).
	 */
	const weeklyConfirmedOp = useRef(0);
	const exceptionConfirmedOps = useRef<Record<string, number>>({});
	/** Edits since mount; the first read only applies when there are none. */
	const planEdits = useRef(0);
	/**
	 * Saves reach UserService in click order: one chain for the weekly
	 * plan, one per date. Each save waits until the previous save of its
	 * chain has settled (review 4577586476).
	 */
	const weeklyChain = useRef<Promise<unknown>>(Promise.resolve());
	const dateChains = useRef<Record<string, Promise<unknown>>>({});

	const range = useRef<{ from: Date; to: Date } | undefined>(undefined);
	const shown = useRef<string[]>([]);
	const request = useRef(0);
	// Per colleague: only the latest request may write their entries.
	const colleagueRequest = useRef<Record<string, number>>({});
	const conversationRequest = useRef(0);
	/**
	 * Colleagues whose calendar did not load: unknown, not free. Kept apart
	 * from an empty calendar (review 4575917303).
	 */
	const [failedColleagues, setFailedColleagues] = useState<string[]>([]);
	/**
	 * Colleagues whose calendar for the loaded window is still on its way
	 * (just switched on, or another window): unknown as well, not free
	 * (review 4576313280).
	 */
	const [loadingColleagues, setLoadingColleagues] = useState<string[]>([]);
	/**
	 * This week's own entries, which the next free hours come from: in,
	 * on their way or failed (review 4576313283).
	 */
	/**
	 * One's own calendar for the loaded window is on its way (paged
	 * elsewhere): until it is in, the previous range's entries say nothing
	 * about free time (review 4576368852). It stays on after a failure,
	 * which the page shows anyway.
	 */
	const [ownLoading, setOwnLoading] = useState(true);
	const [freeHoursState, setFreeHoursState] =
		useState<FreeHoursState>('loading');
	const freeHoursFailed = useRef(false);
	const nearbyRequest = useRef(0);
	/** Move proposals: sent for colleagues', received for own appointments. */
	const [sentProposals, setSentProposals] = useState<MoveProposal[]>([]);
	const [receivedProposals, setReceivedProposals] = useState<MoveProposal[]>(
		[]
	);
	/** The received ones are known: only then is their count worth telling. */
	const [proposalsLoaded, setProposalsLoaded] = useState(false);
	const proposalRequest = useRef(0);

	/**
	 * The open proposals of both sides. Only the latest answer counts; a
	 * failure keeps what is shown, and the next load asks again. Every
	 * successful change of a proposal here (made, withdrawn, declined,
	 * accepted) loads them again, which also drops a read that started
	 * before the change: its late answer would bring back a withdrawn or
	 * declined proposal, or hide a new one (review 4581730518).
	 */
	const loadProposals = useCallback(() => {
		if (!consultant) return;
		const generation = ++proposalRequest.current;
		apiGetCalendarProposals().then(
			(dto) => {
				if (generation !== proposalRequest.current) return;
				setSentProposals((dto?.sent ?? []).map(proposalFromApi));
				setReceivedProposals(
					(dto?.received ?? []).map(proposalFromApi)
				);
				setProposalsLoaded(true);
			},
			() => undefined
		);
	}, [consultant]);

	useEffect(() => {
		if (proposalsLoaded)
			publishReceivedProposalCount(receivedProposals.length);
	}, [proposalsLoaded, receivedProposals.length]);

	const loadColleague = useCallback((id: string) => {
		const window = range.current;
		if (!window) return Promise.resolve();
		const generation = (colleagueRequest.current[id] ?? 0) + 1;
		colleagueRequest.current[id] = generation;
		const latest = () => colleagueRequest.current[id] === generation;
		const settled = () =>
			setLoadingColleagues((all) => all.filter((c) => c !== id));
		setLoadingColleagues((all) => (all.includes(id) ? all : [...all, id]));
		return apiGetColleagueCalendarEntries(id, window.from, window.to).then(
			(list) => {
				if (!latest()) return;
				setColleagueEntries((all) => ({
					...all,
					[id]: list.map(entryFromApi)
				}));
				setFailedColleagues((all) => all.filter((c) => c !== id));
				settled();
			},
			// No entries to show, and no telling whether they are free.
			() => {
				if (!latest()) return;
				setColleagueEntries((all) => ({
					...all,
					[id]: []
				}));
				setFailedColleagues((all) =>
					all.includes(id) ? all : [...all, id]
				);
				settled();
			}
		);
	}, []);

	const setFreeHours = useCallback((next: FreeHoursState) => {
		freeHoursFailed.current = next === 'failed';
		setFreeHoursState(next);
	}, []);

	/**
	 * This week's own entries when the loaded window is elsewhere. A
	 * failure is not silent: the free hours say so and offer a retry, and
	 * the next paging tries again (review 4576313283).
	 */
	const loadNearby = useCallback(() => {
		const generation = ++nearbyRequest.current;
		const near = nearbyWindow();
		setFreeHours('loading');
		apiGetCalendarEntries(near.from, near.to).then(
			(list) => {
				if (generation !== nearbyRequest.current) return;
				setNearby(list.map(entryFromApi));
				setFreeHours('ready');
			},
			() => {
				if (generation === nearbyRequest.current)
					setFreeHours('failed');
			}
		);
	}, [setFreeHours]);

	const load = useCallback(() => {
		const window = range.current;
		if (!window) return;
		const id = ++request.current;
		const near = nearbyWindow();
		// The window holds this week: its answer is what the free hours use.
		const holdsThisWeek =
			window.from.getTime() <= near.from.getTime() &&
			window.to.getTime() >= near.to.getTime();
		setOwnLoading(true);
		apiGetCalendarEntries(window.from, window.to).then(
			(list) => {
				if (id !== request.current) return;
				setOwn(list.map(entryFromApi));
				setOwnLoading(false);
				setState('ready');
				if (holdsThisWeek) setFreeHours('ready');
			},
			() => {
				if (id !== request.current) return;
				setState('error');
				if (holdsThisWeek) setFreeHours('failed');
			}
		);
		if (holdsThisWeek) {
			// A nearby answer still on its way is no longer needed.
			nearbyRequest.current += 1;
			setNearby([]);
			setFreeHours('loading');
		} else loadNearby();
		shown.current.forEach((colleague) => loadColleague(colleague));
		// A move or cancellation voids proposals: they come with the entries.
		loadProposals();
	}, [loadColleague, loadNearby, setFreeHours, loadProposals]);

	const changeRange = useCallback(
		(start: Date, end: Date) => {
			const next = loadWindow(start, end);
			const current = range.current;
			// Paging inside the loaded window needs no request, except
			// for this week's entries if they failed (review 4576313283).
			if (
				current &&
				current.from.getTime() <= start.getTime() &&
				current.to.getTime() >= end.getTime()
			) {
				if (freeHoursFailed.current) loadNearby();
				return;
			}
			range.current = next;
			load();
		},
		[load, loadNearby]
	);

	useEffect(() => onAppointmentsChanged(load), [load]);

	/**
	 * The conversations appointments belong to: every page of the
	 * counsellor's sessions (the first page shows at once), so an
	 * appointment always finds its room. A failure is shown with a retry.
	 */
	const loadConversations = useCallback(() => {
		const generation = ++conversationRequest.current;
		const latest = () => generation === conversationRequest.current;
		setConversationsFailed(false);
		const page = (offset: number) =>
			consultant
				? apiGetConsultantSessionList({
						type: SESSION_LIST_TYPES.MY_SESSION,
						count: CONVERSATION_LOOKUP_COUNT,
						offset
					}).catch((error) => {
						// 204: no (more) conversations. That is an answer,
						// also on a later page (review 4577642135).
						if (error?.message === FETCH_ERRORS.EMPTY)
							return { count: 0, offset, sessions: [], total: 0 };
						throw error;
					})
				: // Strict: a failure shows the retry instead of no rooms.
					apiGetAskerSessionList({ strict: true });
		const from = (
			offset: number,
			found: ConversationRef[]
		): Promise<void> =>
			page(offset).then((list) => {
				if (!latest()) return undefined;
				const sessions = list?.sessions ?? [];
				const all = [
					...found,
					...toConversations(
						sessions,
						consultant ? userData?.userId : undefined
					)
				];
				setConversations(all);
				const received = offset + sessions.length;
				return consultant &&
					sessions.length > 0 &&
					received < (list?.total ?? 0)
					? from(received, all)
					: undefined;
			});
		from(0, []).catch(() => {
			if (latest()) setConversationsFailed(true);
		});
	}, [consultant, userData?.userId]);

	useEffect(() => {
		loadConversations();
		return () => {
			// Unmounted: later pages and failures are dropped.
			conversationRequest.current += 1;
		};
	}, [loadConversations]);

	/**
	 * The saved schedule. Without an answer the calendar shades nothing, as
	 * with none set, and the schedule stays closed for editing: saving it
	 * would write a default over the stored one (review 4574779938). A read
	 * that answers after an edit changes nothing (review 4574779933). A
	 * failure leaves free time unknown and offers a retry (review
	 * 4581640874).
	 */
	const loadPlan = useCallback(() => {
		const generation = ++planRequest.current;
		const edits = planEdits.current;
		setPlanFailed(false);
		apiGetCalendarWorkingHours().then(
			(dto) => {
				if (generation !== planRequest.current) return;
				const loaded = workingPlanFromApi(dto);
				confirmed.current = loaded;
				if (planEdits.current === edits) setPlan(loaded);
				setPlanLoaded(true);
			},
			() => {
				if (generation === planRequest.current) setPlanFailed(true);
			}
		);
	}, []);

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
			// A backend without FE#2305 answers 404: no list, no menu item.
			apiGetCalendarAutoAccept().then(
				(dto) => !cancelled && setAutoAcceptIds(dto.colleagueIds ?? []),
				() => undefined
			);
			apiGetCalendarSync().then(
				(dto) => !cancelled && setSync(dto),
				() => undefined
			);
			loadConsultationHours(() => cancelled);
			loadPlan();
		}
		return () => {
			cancelled = true;
			// Unmounted: a late plan answer changes nothing.
			planRequest.current += 1;
		};
	}, [consultant, loadPlan, loadConsultationHours]);

	/**
	 * Free time needs this week's entries and the saved schedule. Without
	 * the schedule it is unknown, said with the free hours' own wording and
	 * retry, never computed from 08:00–18:00 (review 4581640874).
	 */
	const planState: FreeHoursState =
		!consultant || planLoaded ? 'ready' : planFailed ? 'failed' : 'loading';
	const freeHours: FreeHoursState =
		freeHoursState === 'failed' || planState === 'failed'
			? 'failed'
			: freeHoursState === 'loading' || planState === 'loading'
				? 'loading'
				: 'ready';

	const conversationOf = (sessionId?: number) =>
		conversations.find((c) => c.sessionId === sessionId);

	const notice = (
		kind: 'created' | 'moved' | 'cancelled' | 'confirmed' | 'declined',
		sessionId: number,
		start: Date,
		end: Date,
		/** A move: where it stood, for the chat card's old → new. */
		previous?: { start: string | Date; end: string | Date }
	) =>
		sendNotice({
			kind,
			start,
			end,
			sessionId,
			matrixRoomId: conversationOf(sessionId)?.matrixRoomId,
			...(previous && {
				previousStart: new Date(previous.start),
				previousEnd: new Date(previous.end)
			})
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
		if (first.colleagueId) {
			// With a colleague (FE#2305): UserService opens the internal chat
			// of the two; the notice there tells the colleague.
			const created = await apiCreateColleagueAppointment({
				colleagueId: first.colleagueId,
				start: first.start.toISOString(),
				end: first.end.toISOString(),
				kind: kindToApi(first.kind ?? 'video')
			});
			afterChange();
			if (created?.matrixRoomId && typeof created.chatId === 'number')
				await sendNotice({
					kind: 'created',
					start: first.start,
					end: first.end,
					sessionId: created.chatId,
					matrixRoomId: created.matrixRoomId
				});
			return undefined;
		}
		if (first.sessionId === undefined) throw new Error('conversation');
		/* The 1:1's save path: the appointment with its Art, then the
		   invitation that meets at it ("Weitere Personen per Link"). */
		let invitation: DirectLink | undefined;
		try {
			invitation = (
				await saveAppointmentInvitation({
					sessionId: first.sessionId,
					slot: { start: first.start, end: first.end },
					kind: first.kind,
					link: first.link ?? null
				})
			).invitation;
		} catch (cause) {
			if (!(cause instanceof InvitationAfterAppointmentError))
				throw cause;
			// The appointment stands; only the link is missing.
			appSnackbarStack.enqueue(
				invitationErrorEntry({
					id: `calendar-invitation-failed-${cause.appointmentId}`,
					title: t('directInvitation.dialog.linkFailedTitle'),
					text: t(
						'directInvitation.dialog.linkFailedAfterAppointment'
					),
					t
				})
			);
		}
		afterChange();
		if (invitation) {
			notifyDirectLinksChanged();
			setSharedInvitation(invitation);
		}
		await notice('created', first.sessionId, first.start, first.end);
	};

	/* "Neue Person per Direkteinladung …": door A with the calendar's slot. */
	const inviteNewPerson = (preset: InvitationPreset) =>
		navigate(CREATE_CHAT_PATH, { state: toInvitationPresetState(preset) });

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
				await notice('moved', entry.sessionId, start, end, entry);
			}
		} finally {
			afterChange();
		}
	};

	const cancel = async (entry: CalendarEntry) => {
		const { meeting } = entry;
		if (meeting) {
			await apiCancelColleagueAppointment(entry.id);
			afterChange();
			if (meeting.matrixRoomId && meeting.chatId !== undefined)
				await sendNotice({
					kind: 'cancelled',
					start: new Date(entry.start),
					end: new Date(entry.end),
					sessionId: meeting.chatId,
					matrixRoomId: meeting.matrixRoomId
				});
			return;
		}
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

	/**
	 * FE#2287: the counsellor answers an advice seeker's request from the
	 * calendar, with the same calls and the same conversation notice as from
	 * the appointment button under the chat header. A refused answer reloads
	 * the calendar; `REQUESTED_TIME_TAKEN` says the time is no longer free.
	 */
	const answerRequest = async (
		entry: CalendarEntry,
		decision: 'confirmed' | 'declined'
	) => {
		if (entry.sessionId === undefined) return;
		try {
			await (
				decision === 'confirmed'
					? apiConfirmSessionAppointment
					: apiDeclineSessionAppointment
			)(entry.sessionId, entry.id);
		} catch (error) {
			reloadEntries();
			if (
				error instanceof Response &&
				error.headers.get('X-Reason') === 'REQUESTED_TIME_TAKEN'
			)
				throw new RequestedTimeTaken();
			throw error;
		}
		reloadEntries();
		afterChange();
		await notice(
			decision,
			entry.sessionId,
			new Date(entry.start),
			new Date(entry.end)
		);
	};
	const confirmRequest = (entry: CalendarEntry) =>
		answerRequest(entry, 'confirmed');
	const declineRequest = (entry: CalendarEntry) =>
		answerRequest(entry, 'declined');

	const removeBlocker = async (entry: CalendarEntry) => {
		await apiDeleteCalendarBlocker(entry.id);
		afterChange();
	};

	/** One open proposal per appointment: a new one replaces the older. */
	const proposeMove = async (
		entry: CalendarEntry,
		start: Date,
		end: Date,
		reason?: string
	) => {
		const created = await apiCreateCalendarProposal({
			entryId: entry.id,
			start: start.toISOString(),
			end: end.toISOString(),
			...(reason && { reason })
		});
		if (created?.id)
			setSentProposals((all) =>
				addProposal(all, proposalFromApi(created))
			);
		loadProposals();
	};

	const withdrawMove = async (proposal: MoveProposal) => {
		await apiWithdrawCalendarProposal(proposal.id);
		setSentProposals((all) => withdrawProposal(all, proposal.id));
		loadProposals();
	};

	/**
	 * UserService moves the appointment; the reload brings the moved entry
	 * and drops the other proposals for it. The advice seeker gets the
	 * usual notice. 409: the proposal is void (UserService names no cause);
	 * the page says so, and the calendar reloads.
	 */
	const acceptProposal = async (proposal: MoveProposal) => {
		let answer;
		try {
			answer = await apiAcceptCalendarProposal(proposal.id);
		} catch (error) {
			if ((error as Error)?.message === FETCH_ERRORS.CONFLICT) {
				reloadEntries();
				throw new ProposalNoLongerValid();
			}
			// Withdrawn or gone meanwhile: the list may be stale.
			loadProposals();
			throw error;
		}
		setReceivedProposals((all) => withdrawProposal(all, proposal.id));
		const moved = answer?.id ? entryFromApi(answer) : undefined;
		const before = own.find((e) => e.id === proposal.entryId);
		const start = moved?.start ?? proposal.start;
		const end = moved?.end ?? proposal.end;
		const place = (all: CalendarEntry[]) =>
			all.map((e) =>
				e.id === proposal.entryId ? { ...e, ...moved, start, end } : e
			);
		setOwn(place);
		setNearby(place);
		afterChange();
		const sessionId = moved?.sessionId ?? before?.sessionId;
		if (sessionId !== undefined)
			await notice(
				'moved',
				sessionId,
				new Date(start),
				new Date(end),
				// The loaded entry, else its time when it was proposed.
				before ??
					(proposal.entryStart && proposal.entryEnd
						? { start: proposal.entryStart, end: proposal.entryEnd }
						: undefined)
			);
	};

	const declineProposal = async (proposal: MoveProposal) => {
		try {
			await apiDeclineCalendarProposal(proposal.id);
		} catch (error) {
			loadProposals();
			throw error;
		}
		setReceivedProposals((all) => withdrawProposal(all, proposal.id));
		loadProposals();
	};

	const openRoom = (
		roomId: string,
		sessionId: number,
		startCall: CallKind | undefined
	) => {
		const path = appointmentConversationPath(roomId, sessionId, consultant);
		if (startCall)
			navigate(path, { state: startCallState(sessionId, startCall) });
		else navigate(path);
	};

	/**
	 * Opens the conversation an appointment belongs to: from the list at
	 * once, else by its session id, for one the list does not hold (shared
	 * access, a handover, an archived one, a page still loading). Rejects
	 * when there is no room, so the page can say so (review 4577642137).
	 * With `startCall`, the conversation is asked to start that call with
	 * the checks of its own button (FE#1050).
	 */
	/** The internal chat of two counsellors (FE#2305). */
	const openMeetingChat = (entry: CalendarEntry) => {
		const { meeting } = entry;
		if (!meeting?.matrixRoomId || meeting.chatId === undefined)
			return Promise.reject(new Error('meeting without chat'));
		navigate(
			getSessionNavigationPath({
				listPath: '/sessions/consultant/sessionView',
				sessionId: meeting.chatId,
				groupId: meeting.matrixRoomId,
				isGroup: true,
				isAsker: false,
				isEmptyEnquiry: false,
				tabSuffix: ''
			})
		);
		return undefined;
	};

	const answerMeeting = async (
		entry: CalendarEntry,
		answer: 'accept' | 'decline'
	) => {
		try {
			if (answer === 'accept')
				await apiAcceptColleagueAppointment(entry.id);
			else await apiDeclineColleagueAppointment(entry.id);
		} finally {
			afterChange();
		}
	};

	const saveAutoAccept = async (ids: string[]) => {
		const saved = await apiSetCalendarAutoAccept({ colleagueIds: ids });
		setAutoAcceptIds(saved?.colleagueIds ?? ids);
	};

	const openConversation = (
		entry: CalendarEntry,
		startCall?: CallKind
	): Promise<void> | undefined => {
		if (entry.meeting) return openMeetingChat(entry);
		const { sessionId } = entry;
		const listed = conversationOf(sessionId);
		if (listed?.matrixRoomId) {
			openRoom(listed.matrixRoomId, listed.sessionId, startCall);
			return undefined;
		}
		if (sessionId === undefined)
			return Promise.reject(
				new Error('appointment without conversation')
			);
		return appointmentRoomOf(sessionId).then((roomId) =>
			openRoom(roomId, sessionId, startCall)
		);
	};

	/**
	 * "Video-Call starten" and "Anruf starten" start the call: the
	 * conversation opens and its own video or audio call button takes the
	 * request up (Frank, 2026-11-16). Only a counsellor starts calls; other
	 * kinds and askers open the conversation.
	 */
	const start = (entry: CalendarEntry) =>
		openConversation(
			entry,
			consultant ? CALL_OF_APPOINTMENT[entry.kind ?? 'onsite'] : undefined
		);

	// Working hours, holiday region and day exceptions show the change at
	// once; a failed save puts the stored state back and rejects, so the
	// page says it did not work. Each part has its own owner: the weekly
	// fields belong to the latest weekly save, each date's exception to
	// the latest save of that date. An older answer or failure changes
	// nothing a newer operation has written (reviews 4574981869,
	// 4574981870, 4574981875).
	/** Sends `request` once the save before it in `chain` has settled. */
	const after = <T,>(
		chain: Promise<unknown> | undefined,
		request: () => Promise<T>
	) => {
		const sent = (chain ?? Promise.resolve()).then(request, request);
		return { sent, settled: sent.catch(() => undefined) };
	};
	const inWeeklyOrder = <T,>(request: () => Promise<T>) => {
		const { sent, settled } = after(weeklyChain.current, request);
		weeklyChain.current = settled;
		return sent;
	};
	const inDateOrder = <T,>(date: string, request: () => Promise<T>) => {
		const { sent, settled } = after(dateChains.current[date], request);
		dateChains.current[date] = settled;
		return sent;
	};

	/** The whole set at once; the answer is what UserService stored. */
	const saveConsultationHours = async (hours: ConsultationHours) => {
		const saved = await apiSetCalendarConsultationHours(hours);
		setConsultationHours(consultationHoursFromApi(saved));
	};

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
			const saved = await inWeeklyOrder(() =>
				apiSetCalendarWorkingHours(workingPlanToApi(next))
			);
			const stored = workingPlanFromApi(saved);
			if (generation > weeklyConfirmedOp.current) {
				weeklyConfirmedOp.current = generation;
				confirmed.current = {
					...confirmed.current,
					hours: stored.hours,
					holidayRegion: stored.holidayRegion
				};
			}
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

	/** What UserService confirmed for `date` in operation `generation`. */
	const confirmException = (
		date: string,
		generation: number,
		windows?: TimeWindow[]
	) => {
		if (generation <= (exceptionConfirmedOps.current[date] ?? 0)) return;
		exceptionConfirmedOps.current[date] = generation;
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
		return {
			generation,
			latest: () => exceptionOps.current[date] === generation
		};
	};

	const saveDayException = async (date: string, windows: TimeWindow[]) => {
		const { generation, latest } = ownDate(date);
		const shown = normalizeWindows(windows);
		setException(date, shown);
		try {
			const saved = await inDateOrder(date, () =>
				apiPutWorkingDayException(
					date,
					exceptionWindowsToApi(windows)
				).catch((error) => {
					// 409: the limit of dates with own hours (review 4577586484).
					throw error?.message === FETCH_ERRORS.CONFLICT
						? new TooManyDayExceptions()
						: error;
				})
			);
			const stored =
				dayExceptionsFromApi(saved ? [saved] : [])[date] ?? shown;
			confirmException(date, generation, stored);
			if (latest()) setException(date, stored);
		} catch (error) {
			if (latest())
				setException(date, confirmed.current?.exceptions?.[date]);
			throw error;
		}
	};

	const deleteDayException = async (date: string) => {
		const { generation, latest } = ownDate(date);
		setException(date, undefined);
		try {
			await inDateOrder(date, () => apiDeleteWorkingDayException(date));
			confirmException(date, generation, undefined);
		} catch (error) {
			if (latest())
				setException(date, confirmed.current?.exceptions?.[date]);
			throw error;
		}
	};

	const showColleagues = (ids: string[]) => {
		const added = ids.filter((id) => !shown.current.includes(id));
		// A colleague switched off: a request still running for them is stale.
		const removed = shown.current.filter((id) => !ids.includes(id));
		removed.forEach((id) => {
			colleagueRequest.current[id] =
				(colleagueRequest.current[id] ?? 0) + 1;
		});
		if (removed.length)
			setLoadingColleagues((all) =>
				all.filter((id) => !removed.includes(id))
			);
		shown.current = ids;
		added.forEach((id) => loadColleague(id));
	};

	/**
	 * A changed import changes the busy entries: reload the loaded window,
	 * so removed busy times stop counting as busy.
	 */
	const reloadEntries = () => {
		if (range.current) load();
	};

	/**
	 * "Abwesenheit" (ORISO-Frontend#2303): the profile's absence, switched on
	 * for these days. The profile and the calendar both read it back.
	 */
	const saveAbsence = (draft: AbsenceDraft) =>
		apiSetAbsence(true, draft.message, {
			start: draft.start,
			end: draft.end
		})
			.then(() => reloadUserData?.())
			.then(() => reloadEntries());
	const absence =
		consultant && (userData?.absenceStart || userData?.absenceEnd)
			? {
					start: userData.absenceStart ?? undefined,
					end: userData.absenceEnd ?? undefined,
					message: userData.absenceMessage ?? ''
				}
			: consultant
				? { message: userData?.absenceMessage ?? '' }
				: undefined;

	// CalendarPage shows only the colleagues switched on.
	const entries = [
		...mergeEntries(own, nearby),
		...Object.values(colleagueEntries).flat()
	];

	return (
		<>
			<CalendarPage
				linksPanel={consultant ? <CalendarLinksSection /> : undefined}
				role={consultant ? 'consultant' : 'asker'}
				ownerId={ownerId}
				initialDate={openOnDay}
				state={state}
				entries={entries}
				colleagues={colleagues}
				visibility={visibility}
				conversations={conversations}
				feed={sync ? feedFromApi(sync) : undefined}
				busyImport={sync ? importFromApi(sync) : {}}
				compact={compact}
				phone={phone}
				workingHours={consultant ? plan?.hours : undefined}
				workingHoursLoaded={consultant && planLoaded}
				dayExceptions={consultant ? plan?.exceptions : undefined}
				holidayRegion={
					consultant ? (plan?.holidayRegion ?? null) : null
				}
				onRangeChange={changeRange}
				onShownColleaguesChange={showColleagues}
				conversationsFailed={conversationsFailed}
				onRetryConversations={loadConversations}
				failedColleagues={failedColleagues}
				loadingCalendars={
					ownLoading
						? [ownerId, ...loadingColleagues]
						: loadingColleagues
				}
				onRetryColleagues={() =>
					failedColleagues.forEach((id) => loadColleague(id))
				}
				freeHoursState={freeHours}
				onRetryFreeHours={() => {
					if (planFailed) loadPlan();
					if (freeHoursFailed.current) loadNearby();
				}}
				onRetry={() => {
					setState('loading');
					load();
					if (conversationsFailed) loadConversations();
				}}
				onCreate={consultant ? create : undefined}
				onSaveAbsence={consultant ? saveAbsence : undefined}
				absence={absence}
				allowGuestInvite={consultant && allowGuestInvite}
				inviteMedia={inviteMedia}
				onInviteNewPerson={
					consultant && allowGuestInvite ? inviteNewPerson : undefined
				}
				onMove={consultant ? move : undefined}
				onCancelAppointment={consultant ? cancel : undefined}
				onAnswerMeeting={consultant ? answerMeeting : undefined}
				autoAcceptIds={autoAcceptIds}
				onSaveAutoAccept={
					consultant && autoAcceptIds ? saveAutoAccept : undefined
				}
				onRemoveBlocker={consultant ? removeBlocker : undefined}
				proposals={consultant ? sentProposals : undefined}
				receivedProposals={consultant ? receivedProposals : undefined}
				onProposeMove={consultant ? proposeMove : undefined}
				onWithdrawProposal={consultant ? withdrawMove : undefined}
				onAcceptProposal={consultant ? acceptProposal : undefined}
				onDeclineProposal={consultant ? declineProposal : undefined}
				onConfirmRequest={consultant ? confirmRequest : undefined}
				onDeclineRequest={consultant ? declineRequest : undefined}
				onSaveWorkingHours={consultant ? saveWorkingHours : undefined}
				consultationHours={consultant ? consultationHours : undefined}
				consultationHoursFailed={consultant && consultationHoursFailed}
				onRetryConsultationHours={
					consultant ? () => loadConsultationHours() : undefined
				}
				onSaveConsultationHours={
					consultant ? saveConsultationHours : undefined
				}
				onSaveDayException={consultant ? saveDayException : undefined}
				onDeleteDayException={
					consultant ? deleteDayException : undefined
				}
				onStart={start}
				onOpenChat={(entry) => openConversation(entry)}
				onCopyFeed={(url) => navigator.clipboard?.writeText(url)}
				// Each sync action rejects on failure, so the dialog can say so.
				onResetFeed={() => apiResetCalendarFeed().then(setSync)}
				onSaveImport={(url) =>
					apiSaveCalendarImport(normalizeImportUrl(url)).then(
						(dto) => {
							setSync(dto);
							reloadEntries();
						},
						(error) => {
							setSync((current) =>
								current
									? { ...current, importError: 'INVALID_URL' }
									: current
							);
							throw error;
						}
					)
				}
				onRemoveImport={() =>
					apiRemoveCalendarImport().then((dto) => {
						setSync(dto);
						reloadEntries();
					})
				}
			/>
			{sharedInvitation && (
				<DirectLinkShareDialog
					open
					link={sharedInvitation}
					fullScreen={compact}
					onClose={() => setSharedInvitation(undefined)}
				/>
			)}
		</>
	);
};
