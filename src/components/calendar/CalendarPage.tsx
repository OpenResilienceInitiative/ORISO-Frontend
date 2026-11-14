/**
 * The "Meine Termine" section (navigation entry `/booking/events`): the
 * counsellor calendar of ADR-032 and FE#1050, round 2 after Frank's
 * prototype (2026-11-14). Built like "Gespräche": a left column with search
 * and lists, a stage with header, toolbar and the calendar.
 *
 * Presentational: entries, colleagues, working hours, feed and import come
 * in as props, every change goes out as a callback. A callback may return a
 * promise; a rejected one shows the failure notice instead of the success
 * notice. `CalendarPageWired` connects it to UserService.
 *
 * Move proposals and "Beitreten" have no backend yet: they appear only when
 * the host passes their callbacks (Storybook does, the app does not).
 *
 * Working time (contract v1.2): weekly hours, single dates moved by hand and
 * the public holidays of a Bundesland. Grips on the edges of one's own
 * working day ask "Nur an diesem Tag | Immer <Wochentag>s". On a phone the
 * left column is a bottom sheet over the calendar.
 */
import * as React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCalendarController } from '@fullcalendar/react';
import { CircularProgress, Tooltip } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import ViewAgendaOutlinedIcon from '@mui/icons-material/ViewAgendaOutlined';
import ViewWeekOutlinedIcon from '@mui/icons-material/ViewWeekOutlined';
import { M3Snackbar } from '../m3Snackbar/M3Snackbar';
import {
	DEFAULT_VISIBILITY,
	type AppointmentDraft,
	type AppointmentKind,
	type CalendarConversation,
	type CalendarEntry,
	type CalendarRole,
	type CalendarVisibility,
	type Colleague
} from './calendarModel';
import { facetOf, type CalendarEntryFacet } from './CalendarEntryGlyph';
import {
	entryActions,
	openProposals,
	type MoveProposal
} from './calendarActions';
import {
	COMPACT_VIEWS,
	DESKTOP_VIEWS,
	FC_VIEW,
	VIEW_DIGIT,
	type CalendarViewName,
	type ViewSwitcherStyle
} from './calendarViews';
import {
	effectiveDay,
	exceedsWindowLimit,
	isWithinWorkingHours,
	MAX_WORKING_HOURS_WINDOWS,
	moveEdge,
	sameWindows,
	windowsOn,
	withWeekdayWindows,
	type DayExceptions,
	type TimeWindow,
	type WorkingHours,
	type WorkingPlan
} from './calendarWorkingHours';
import { dateKeyOf, type HolidayRegion } from './calendarHolidays';
import type { EdgeChange } from './CalendarWorkGrip';
import { CalendarSheet, type SheetStop } from './CalendarSheet';
import {
	readEdgeChoice,
	writeEdgeChoice,
	type EdgeChoice,
	readRecentColleagues,
	readSwitcherStyle,
	MAX_RECENT_COLLEAGUES,
	recentPills,
	rememberColleague,
	writeRecentColleagues,
	writeSwitcherStyle
} from './calendarPreferences';
import {
	CalendarView,
	type CalendarHighlight,
	type MenuAnchor
} from './CalendarView';
import {
	CalendarSplitView,
	SPLIT_COLUMN_MIN_PX,
	SPLIT_DAY_CHOICES,
	type SplitDays
} from './CalendarSplitView';
import { CalendarPager } from './CalendarPager';
import {
	CalendarKindChips,
	CalendarSidebar,
	type CalendarSidebarProps
} from './CalendarSidebar';
import { CalendarMenu } from './CalendarMenu';
import {
	EdgeMenuContent,
	EntryMenuContent,
	JumpMenuContent,
	KindsMenuContent,
	MonthDayMenuContent,
	PeopleMenuContent,
	ProposalMenuContent,
	SettingsMenuContent,
	SlotMenuContent,
	ViewMenuContent,
	type SlotChoice
} from './calendarMenus';
import { initialsOf } from './CalendarEntryPeek';
import { HoverScrollArrows } from '../hoverScrollArrows/HoverScrollArrows';
import { AppointmentDialog } from './AppointmentDialog';
import { BlockerDialog } from './BlockerDialog';
import {
	WorkingHoursDialog,
	useWorkingHoursSummary
} from './WorkingHoursDialog';
import {
	CalendarSyncDialog,
	type CalendarFeed,
	type CalendarImport
} from './CalendarSyncDialog';
import { useEntryLabel, useRangeFormat } from './useEntryLabel';
import type { QuickKind } from './calendarQuickEntry';
import { useLiveNow } from './useLiveNow';
import '../sessionsList/sessionsList.styles.scss';
import './calendar.styles.scss';

export type { CalendarViewName } from './calendarViews';
export type CalendarLoadState = 'loading' | 'ready' | 'error';

/**
 * What a change callback returns: nothing or `true` when it is done,
 * `false` when it refuses, or a promise that settles once it is stored.
 */
export type ChangeResult = void | boolean | Promise<unknown>;

export interface CalendarPageProps {
	role: CalendarRole;
	ownerId: string;
	state?: CalendarLoadState;
	/** Own entries and colleagues' entries (already redacted by UserService). */
	entries: CalendarEntry[];
	/** Colleagues the Träger's scope allows; empty for advice seekers. */
	colleagues?: Colleague[];
	visibility?: CalendarVisibility;
	conversations?: CalendarConversation[];
	feed?: CalendarFeed;
	busyImport?: CalendarImport;
	/** Weekly working hours; empty = none set, nothing shaded. */
	workingHours?: WorkingHours;
	/**
	 * The saved schedule has loaded. Until then (or when loading failed)
	 * neither the dialog nor the grips edit it, so an unloaded schedule is
	 * never saved as an empty one (review 4574779938).
	 */
	workingHoursLoaded?: boolean;
	/** Single dates with their own hours ("Nur an diesem Tag"). */
	dayExceptions?: DayExceptions;
	/** Bundesland whose public holidays are days off; null = none. */
	holidayRegion?: HolidayRegion | null;
	compact?: boolean;
	/** Phone: where the bottom sheet starts (default half). */
	initialSheet?: SheetStop;
	initialView?: CalendarViewName;
	/** Storybook: colleagues shown from the start. */
	initialShownColleagues?: string[];
	initialFullscreen?: boolean;
	initialSwitcherStyle?: ViewSwitcherStyle;
	/** "Nebeneinander": 1 or 3 days. */
	initialSplitDays?: SplitDays;
	now?: Date;
	/**
	 * Resolving with the created entries lets the notice undo a blocker
	 * that was entered at once.
	 */
	onCreate?: (drafts: AppointmentDraft[]) => ChangeResult;
	/**
	 * The snackbar offers to undo by moving it back. `false`, or a promise
	 * that rejects or resolves to `false`, refuses the move and puts the
	 * entry back.
	 */
	onMove?: (entry: CalendarEntry, start: Date, end: Date) => ChangeResult;
	onCancelAppointment?: (entry: CalendarEntry) => ChangeResult;
	onRemoveBlocker?: (entry: CalendarEntry) => ChangeResult;
	/** Weekly hours and the holiday region are stored together. */
	onSaveWorkingHours?: (
		hours: WorkingHours,
		holidayRegion: HolidayRegion | null
	) => void | Promise<unknown>;
	/** "Nur an diesem Tag": the hours of one date (YYYY-MM-DD). */
	onSaveDayException?: (
		date: string,
		windows: TimeWindow[]
	) => void | Promise<unknown>;
	/** The date follows the weekly hours again. */
	onDeleteDayException?: (date: string) => void | Promise<unknown>;
	/** Pending move proposals for colleagues' entries (no backend yet). */
	proposals?: MoveProposal[];
	onProposeMove?: (
		entry: CalendarEntry,
		start: Date,
		end: Date
	) => void | Promise<unknown>;
	onWithdrawProposal?: (proposal: MoveProposal) => void | Promise<unknown>;
	/** Team meetings and group dates (no backend yet). */
	onJoin?: (entry: CalendarEntry) => void;
	/** The visible range changed: load entries for it. */
	onRangeChange?: (start: Date, end: Date) => void;
	/** Colleagues whose calendars are switched on. */
	onShownColleaguesChange?: (ids: string[]) => void;
	onStart?: (entry: CalendarEntry) => void;
	/** "Zum Chat": open the conversation an appointment belongs to. */
	onOpenChat?: (entry: CalendarEntry) => void;
	onCopyFeed?: (url: string) => void;
	/** Sync actions; a rejected promise keeps the dialog's input and says so. */
	onResetFeed?: () => void | Promise<unknown>;
	onSaveImport?: (url: string) => void | Promise<unknown>;
	onRemoveImport?: () => void | Promise<unknown>;
	onRetry?: () => void;
	/** The conversation lookup failed: appointments cannot name one. */
	conversationsFailed?: boolean;
	onRetryConversations?: () => void;
}

type Dialog =
	| {
			type: 'appointment';
			slot?: { start: Date; end: Date; kind: AppointmentKind };
			sessionId?: number;
	  }
	| { type: 'blocker'; slot?: { start: Date; end: Date } }
	| { type: 'workingHours' }
	| { type: 'sync' }
	| null;

type Menu =
	| { type: 'slot'; anchor: MenuAnchor; range: { start: Date; end: Date } }
	| { type: 'month'; anchor: MenuAnchor; start: Date; days: number }
	| {
			type: 'entry';
			anchor: MenuAnchor;
			entry: CalendarEntry;
			mode: 'list' | 'move' | 'propose';
	  }
	| {
			type: 'proposal';
			anchor: MenuAnchor;
			proposal: MoveProposal;
			entry: CalendarEntry;
	  }
	| {
			type: 'settings' | 'view' | 'jump' | 'people' | 'kinds';
			anchor: HTMLElement;
	  }
	| {
			type: 'edge';
			anchor: MenuAnchor;
			change: EdgeChange;
			remember: boolean;
	  }
	| null;

interface Notice {
	message: string;
	/** Settles once undone; the failure notice shows if it does not. */
	undo?: () => ChangeResult;
}

const AXIS_PX = 52;

const startOfDay = (date: Date) => {
	const day = new Date(date);
	day.setHours(0, 0, 0, 0);
	return day;
};
const addDays = (date: Date, days: number) => {
	const next = new Date(date);
	next.setDate(next.getDate() + days);
	return next;
};

/** Tooltips of the switch and the arrows show at once (Frank). */
const QuickTip = ({
	title,
	children
}: {
	title: string;
	children: React.ReactElement;
}) => (
	<Tooltip title={title} enterDelay={0} enterNextDelay={0} disableInteractive>
		{children}
	</Tooltip>
);

const VIEW_ICON: Partial<Record<CalendarViewName, React.ReactNode>> = {
	month: <CalendarMonthOutlinedIcon fontSize="small" />,
	list: <ViewAgendaOutlinedIcon fontSize="small" />,
	split: <ViewWeekOutlinedIcon fontSize="small" />
};

export const CalendarPage = ({
	role,
	ownerId,
	state = 'ready',
	entries,
	colleagues = [],
	visibility = DEFAULT_VISIBILITY,
	conversations = [],
	feed,
	busyImport = {},
	workingHours = [],
	workingHoursLoaded = true,
	dayExceptions,
	holidayRegion = null,
	compact = false,
	initialSheet = 'half',
	initialView,
	initialShownColleagues = [],
	initialFullscreen = false,
	initialSwitcherStyle = 'menu',
	initialSplitDays = 1,
	now: fixedNow,
	onCreate,
	onMove,
	onCancelAppointment,
	onRemoveBlocker,
	onSaveWorkingHours,
	onSaveDayException,
	onDeleteDayException,
	proposals = [],
	onProposeMove,
	onWithdrawProposal,
	onJoin,
	onStart,
	onOpenChat,
	onCopyFeed,
	onResetFeed,
	onSaveImport,
	onRemoveImport,
	onRetry,
	conversationsFailed = false,
	onRetryConversations,
	onRangeChange,
	onShownColleaguesChange
}: CalendarPageProps) => {
	const { t, i18n } = useTranslation();
	const label = useEntryLabel();
	const format = useRangeFormat();
	const summarise = useWorkingHoursSummary();
	const now = useLiveNow(fixedNow);
	const consultant = role === 'consultant';
	const views = compact ? COMPACT_VIEWS : DESKTOP_VIEWS;
	const controller = useCalendarController();

	const [view, setView] = useState<CalendarViewName>(
		initialView ?? (compact ? 'list' : 'workWeek')
	);
	const [title, setTitle] = useState('');
	/** The day the grid stands on; the split view starts on this day. */
	const [anchorDate, setAnchorDate] = useState(() => startOfDay(now));
	const [splitDays, setSplitDays] = useState<SplitDays>(initialSplitDays);
	const [fullscreen, setFullscreen] = useState(initialFullscreen);
	const [switcherStyle, setSwitcherStyle] = useState<ViewSwitcherStyle>(() =>
		readSwitcherStyle(ownerId, initialSwitcherStyle)
	);
	const [shownColleagues, setShownColleagues] = useState<string[]>(
		initialShownColleagues
	);
	const [recent, setRecent] = useState<string[]>(() => [
		...initialShownColleagues,
		...readRecentColleagues(ownerId).filter(
			(id) => !initialShownColleagues.includes(id)
		)
	]);
	const [muted, setMuted] = useState<string[]>([]);
	const [highlight, setHighlight] = useState<CalendarHighlight | null>(null);
	// Like the session list chips: none selected shows everything, selected
	// chips narrow to those kinds. "Was anzeigen" hides kinds altogether.
	const [onlyFacets, setOnlyFacets] = useState<CalendarEntryFacet[]>([]);
	const [hiddenFacets, setHiddenFacets] = useState<CalendarEntryFacet[]>([]);
	const [menu, setMenu] = useState<Menu>(null);
	const [dialog, setDialog] = useState<Dialog>(null);
	const [notice, setNotice] = useState<Notice | null>(null);
	const [dragging, setDragging] = useState(false);
	/** Phone: quick entry folds open in the sheet on demand. */
	const [quickOpen, setQuickOpen] = useState(false);
	const [sheet, setSheet] = useState<SheetStop>(initialSheet);
	/** "Auswahl merken" after dragging a grip; per browser. */
	const [edgeChoice, setEdgeChoice] = useState<EdgeChoice | null>(() =>
		readEdgeChoice(ownerId)
	);
	const stageRef = useRef<HTMLDivElement>(null);
	const peopleRef = useRef<HTMLDivElement>(null);
	const [stageWidth, setStageWidth] = useState(0);

	useEffect(() => {
		const el = stageRef.current;
		if (!el || typeof ResizeObserver === 'undefined') return undefined;
		// Next frame: a width that changes the layout must not re-enter this
		// observer's delivery ("ResizeObserver loop completed …").
		let frame = 0;
		const observer = new ResizeObserver(() => {
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(() => setStageWidth(el.clientWidth));
		});
		observer.observe(el);
		return () => {
			cancelAnimationFrame(frame);
			observer.disconnect();
		};
	}, []);

	const colleagueById = useMemo(
		() => Object.fromEntries(colleagues.map((c) => [c.id, c])),
		[colleagues]
	);
	const shown = shownColleagues
		.map((id) => colleagueById[id])
		.filter(Boolean) as Colleague[];
	const facetVisible = (facet: CalendarEntryFacet) =>
		!hiddenFacets.includes(facet) &&
		(onlyFacets.length === 0 || onlyFacets.includes(facet));
	const visible = useMemo(
		() =>
			entries.filter(
				(e) =>
					(e.ownerId === ownerId ||
						shownColleagues.includes(e.ownerId)) &&
					facetVisible(facetOf(e))
			),
		// facetVisible reads the two facet lists
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[entries, ownerId, shownColleagues, onlyFacets, hiddenFacets]
	);
	const pending = useMemo(
		() =>
			onProposeMove
				? openProposals(proposals, entries).filter(({ entry }) =>
						shownColleagues.includes(entry.ownerId)
					)
				: [],
		[onProposeMove, proposals, entries, shownColleagues]
	);
	const allPending = useMemo(
		() => (onProposeMove ? openProposals(proposals, entries) : []),
		[onProposeMove, proposals, entries]
	);
	const summary = summarise(workingHours);
	const workingPlan = useMemo<WorkingPlan>(
		() => ({
			hours: workingHours,
			exceptions: dayExceptions,
			holidayRegion
		}),
		[workingHours, dayExceptions, holidayRegion]
	);
	// "alle frei" counts every entry of the people shown, also the kinds the
	// display filter hides (review 4574733782).
	const busyEntries = useMemo(
		() =>
			entries.filter(
				(e) =>
					e.ownerId === ownerId || shownColleagues.includes(e.ownerId)
			),
		[entries, ownerId, shownColleagues]
	);

	const toggle = <T,>(list: T[], item: T) =>
		list.includes(item) ? list.filter((x) => x !== item) : [...list, item];

	const toggleColleague = (id: string) => {
		const next = toggle(shownColleagues, id);
		setShownColleagues(next);
		onShownColleaguesChange?.(next);
		if (next.includes(id)) {
			const remembered = rememberColleague(recent, id);
			setRecent(remembered);
			writeRecentColleagues(ownerId, remembered);
		} else setMuted((all) => all.filter((x) => x !== id));
	};

	useEffect(() => {
		if (initialShownColleagues.length > 0)
			onShownColleaguesChange?.(initialShownColleagues);
		// Only once: the host loads the colleagues shown from the start.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	/**
	 * Success notice once the change is stored, the failure notice if it
	 * fails. Says whether it went through: `false` for a refusal or a
	 * failure, so a moved entry goes back and quick entry keeps its draft.
	 */
	const run = (
		result: ChangeResult | undefined,
		success: Notice | ((value: unknown) => Notice)
	): boolean | Promise<boolean> => {
		const done = (value: unknown) => {
			setNotice(typeof success === 'function' ? success(value) : success);
			return true;
		};
		if (result === false) return false;
		if (result && typeof (result as Promise<unknown>).then === 'function')
			return (result as Promise<unknown>).then(
				(value) => (value === false ? false : done(value)),
				() => {
					setNotice({ message: t('calendar.saveFailed') });
					return false;
				}
			);
		return done(undefined);
	};

	// --- Navigation ---
	const split = view === 'split';
	const changeView = (next: CalendarViewName) => {
		setMenu(null);
		if (next === view) return;
		if (next !== 'split' && view !== 'split')
			controller.changeView(FC_VIEW[next]);
		setView(next);
	};
	const page = (direction: -1 | 1) => {
		if (split) setAnchorDate((d) => addDays(d, direction));
		else if (direction < 0) controller.prev();
		else controller.next();
	};
	const goTo = (date: Date) => {
		setMenu(null);
		const day = startOfDay(date);
		setAnchorDate(day);
		if (!split) controller.gotoDate(day);
	};

	useEffect(() => {
		if (!split) return;
		const end = addDays(anchorDate, splitDays);
		onRangeChange?.(anchorDate, end);
		// onRangeChange is the host's loader, stable enough per render
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [split, anchorDate, splitDays]);

	const datesSet = useCallback(
		(nextTitle: string, start: Date, end: Date) => {
			setTitle(nextTitle);
			const current = controller.getDate();
			if (current) setAnchorDate(startOfDay(current));
			onRangeChange?.(start, end);
		},
		[controller, onRangeChange]
	);

	const locale = i18n.language?.startsWith('en') ? 'en-GB' : 'de-DE';
	const rangeTitle = !split
		? title
		: splitDays === 1
			? new Intl.DateTimeFormat(locale, {
					weekday: 'long',
					day: 'numeric',
					month: 'long',
					year: 'numeric'
				}).format(anchorDate)
			: new Intl.DateTimeFormat(locale, {
					day: 'numeric',
					month: 'long',
					year: 'numeric'
				}).formatRange(anchorDate, addDays(anchorDate, splitDays - 1));

	// --- Fullscreen: Escape leaves it, unless a menu or dialog takes it ---
	useEffect(() => {
		if (!fullscreen) return undefined;
		const onKey = (event: KeyboardEvent) => {
			if (event.key === 'Escape' && !menu && !dialog)
				setFullscreen(false);
		};
		document.addEventListener('keydown', onKey);
		return () => document.removeEventListener('keydown', onKey);
	}, [fullscreen, menu, dialog]);

	// --- Creating ---
	const createNotice = (drafts: AppointmentDraft[]) => (created: unknown) => {
		const first = drafts[0];
		const createdEntries = Array.isArray(created)
			? (created as CalendarEntry[])
			: [];
		const when = first.allDay
			? `${format(first.start).split(',')[0]}, ${t('calendar.allDay')}`
			: format(first.start, first.end);
		return {
			// One blocker names its date; a series its count (Russian "one"
			// also covers 21, 31 …, so a series never uses the single text).
			message:
				first.type === 'blocker'
					? drafts.length === 1
						? t('calendar.blocker.createdSingle', { date: when })
						: t('calendar.blocker.created', {
								count: drafts.length,
								date: when
							})
					: t('calendar.created', { date: when }),
			// Undo removes every created blocker; it fails as a whole when
			// one removal fails (review 4574779925).
			undo:
				first.type === 'blocker' &&
				onRemoveBlocker &&
				createdEntries.length > 0
					? () =>
							Promise.all(
								createdEntries.map((e) => onRemoveBlocker(e))
							)
					: undefined
		};
	};

	/** Resolves to whether the entries exist, so quick entry can keep its draft. */
	const create = (drafts: AppointmentDraft[]) => {
		setDialog(null);
		return run(onCreate?.(drafts), createNotice(drafts));
	};

	/** "Mehr Angaben …" in quick entry: the full dialog, prefilled. */
	const moreDetails = (draft: {
		kind?: QuickKind;
		start?: Date;
		end?: Date;
		sessionId?: number;
	}) => {
		setQuickOpen(false);
		const slot =
			draft.start && draft.end
				? { start: draft.start, end: draft.end }
				: undefined;
		if (draft.kind === 'blocker') setDialog({ type: 'blocker', slot });
		else
			setDialog({
				type: 'appointment',
				slot: slot && { ...slot, kind: draft.kind ?? 'video' },
				sessionId: draft.sessionId
			});
	};

	const chooseSlot = (choice: SlotChoice) => {
		if (menu?.type !== 'slot') return;
		const range = menu.range;
		setMenu(null);
		if (choice === 'blocker')
			create([{ type: 'blocker', start: range.start, end: range.end }]);
		else
			setDialog({
				type: 'appointment',
				slot: { ...range, kind: choice }
			});
	};

	const move = (entry: CalendarEntry, start: Date, end: Date) => {
		return run(onMove?.(entry, start, end), {
			message: t(
				entry.type === 'blocker'
					? 'calendar.blockerMoved'
					: 'calendar.moved',
				{ date: format(start, end) }
			),
			undo: () =>
				onMove?.(
					{
						...entry,
						start: start.toISOString(),
						end: end.toISOString()
					},
					new Date(entry.start),
					new Date(entry.end)
				)
		});
	};

	/** Undo through the same path: a failed undo shows the failure notice. */
	const undo = (current: Notice) => {
		setNotice(null);
		const result = current.undo?.();
		if (result === false) return;
		if (result && typeof (result as Promise<unknown>).then === 'function')
			(result as Promise<unknown>).then(
				(value) => {
					if (value === false)
						setNotice({ message: t('calendar.saveFailed') });
				},
				() => setNotice({ message: t('calendar.saveFailed') })
			);
	};

	const propose = (entry: CalendarEntry, start: Date, end: Date) =>
		run(onProposeMove?.(entry, start, end), {
			message: t('calendar.proposal.sent', {
				date: format(start, end),
				name: colleagueById[entry.ownerId]?.displayName ?? ''
			})
		});

	const withdraw = (proposal: MoveProposal) => {
		setMenu(null);
		run(onWithdrawProposal?.(proposal), {
			message: t('calendar.proposal.withdrawn')
		});
	};

	// --- Working-hours grips (own calendar) ---
	const editHours = workingHoursLoaded && !!onSaveWorkingHours;
	const gripsOn = consultant && editHours && !!onSaveDayException;
	const gripDate = (day: Date) =>
		new Intl.DateTimeFormat(
			i18n.language?.startsWith('en') ? 'en-GB' : 'de-DE',
			{ weekday: 'short', day: 'numeric', month: 'numeric' }
		).format(day);

	/** Keyboard users keep their place on the grip they moved. */
	const refocusGrip = (change: EdgeChange) =>
		requestAnimationFrame(() =>
			document
				.querySelector<HTMLElement>(
					`[data-grip="${dateKeyOf(change.day)}-${change.edge}"]`
				)
				?.focus()
		);

	/**
	 * "Nur an diesem Tag" stores the date's windows with the edge moved;
	 * "Immer …" changes that weekday's weekly windows (a lunch break stays).
	 * A date that already has its own hours keeps them, with this edge
	 * moved too.
	 */
	const applyEdge = (change: EdgeChange, choice: EdgeChoice) => {
		const date = dateKeyOf(change.day);
		const current = effectiveDay(change.day, workingPlan);
		const moved = moveEdge(current.windows, change.edge, change.to);
		const previousException = dayExceptions?.[date];
		const what = t(
			change.edge === 'start'
				? 'calendar.grip.start'
				: 'calendar.grip.end'
		);
		if (choice === 'day') {
			run(onSaveDayException?.(date, moved), {
				message: t('calendar.grip.savedDay', {
					what,
					date: gripDate(change.day),
					time: change.to
				}),
				undo: () =>
					previousException
						? onSaveDayException?.(date, previousException)
						: onDeleteDayException?.(date)
			});
		} else {
			const weekday = change.day.getDay();
			const base = windowsOn(workingHours, weekday);
			const weekly = moveEdge(
				base.length > 0 ? base : current.windows,
				change.edge,
				change.to
			);
			const previousHours = workingHours;
			const nextHours = withWeekdayWindows(workingHours, weekday, weekly);
			// Over UserService's limit: refuse it, never drop another day.
			if (exceedsWindowLimit(nextHours)) {
				setNotice({
					message: t('calendar.workingHours.tooMany', {
						max: MAX_WORKING_HOURS_WINDOWS
					})
				});
				refocusGrip(change);
				return;
			}
			const saves: (void | Promise<unknown> | undefined)[] = [
				onSaveWorkingHours?.(nextHours, holidayRegion)
			];
			if (previousException)
				saves.push(
					sameWindows(moved, weekly)
						? onDeleteDayException?.(date)
						: onSaveDayException?.(date, moved)
				);
			run(Promise.all(saves), {
				message: t('calendar.grip.savedWeek', {
					what,
					weekdays: t(`calendar.grip.weekdays.${weekday}`),
					time: change.to
				}),
				undo: () => {
					onSaveWorkingHours?.(previousHours, holidayRegion);
					if (previousException)
						onSaveDayException?.(date, previousException);
				}
			});
		}
		refocusGrip(change);
	};

	const decideEdge = (
		change: EdgeChange,
		anchor: { x: number; y: number }
	) => {
		if (edgeChoice) applyEdge(change, edgeChoice);
		else setMenu({ type: 'edge', anchor, change, remember: false });
	};
	// One callback for the grids' whole life, so their background events
	// are not rebuilt on every render.
	const decideEdgeRef = useRef(decideEdge);
	decideEdgeRef.current = decideEdge;
	const onEdgeChange = useCallback(
		(change: EdgeChange, anchor: { x: number; y: number }) =>
			decideEdgeRef.current(change, anchor),
		[]
	);

	const forgetEdge = () => {
		setMenu(null);
		writeEdgeChoice(ownerId, null);
		setEdgeChoice(null);
		setNotice({ message: t('calendar.grip.forgotten') });
	};

	const can = {
		start: !!onStart,
		chat: !!onOpenChat,
		join: !!onJoin,
		move: !!onMove,
		propose: !!onProposeMove,
		cancel: !!onCancelAppointment,
		remove: !!onRemoveBlocker
	};

	const openEntry = (
		entry: CalendarEntry,
		anchor: MenuAnchor,
		mode: 'list' | 'move' = 'list'
	) => {
		const actions = entryActions(entry, { ownerId, role, can });
		const formMode =
			mode === 'move'
				? actions.includes('move')
					? 'move'
					: actions.includes('propose')
						? 'propose'
						: 'list'
				: 'list';
		setMenu({ type: 'entry', entry, anchor, mode: formMode });
	};

	const entryAction = (
		entry: CalendarEntry,
		action: 'start' | 'chat' | 'join' | 'cancel' | 'remove'
	) => {
		setMenu(null);
		if (action === 'start') onStart?.(entry);
		else if (action === 'chat') onOpenChat?.(entry);
		else if (action === 'join') onJoin?.(entry);
		else if (action === 'cancel')
			run(onCancelAppointment?.(entry), {
				message: t('calendar.cancelled')
			});
		else
			run(onRemoveBlocker?.(entry), {
				message: t('calendar.blockerRemoved')
			});
	};

	const allDayDraft = (start: Date, days: number): AppointmentDraft => {
		const end = addDays(start, days - 1);
		end.setHours(23, 59, 59, 999);
		return { type: 'blocker', start: startOfDay(start), end, allDay: true };
	};

	// --- Menu content ---
	let menuContent: React.ReactNode = null;
	let menuLabel = '';
	let menuRole: 'menu' | 'dialog' = 'menu';
	let menuWidth = 280;
	let menuAlign: 'start' | 'end' = 'start';
	if (menu?.type === 'slot') {
		menuLabel = t('calendar.slotMenu.label');
		menuContent = (
			<SlotMenuContent
				range={menu.range}
				outsideHours={
					!isWithinWorkingHours(
						menu.range.start,
						menu.range.end,
						workingPlan
					)
				}
				onChoose={chooseSlot}
			/>
		);
	} else if (menu?.type === 'month') {
		menuLabel = t('calendar.monthMenu.label');
		const { start, days } = menu;
		menuContent = (
			<MonthDayMenuContent
				start={start}
				days={days}
				onAllDay={() => {
					setMenu(null);
					create([allDayDraft(start, days)]);
				}}
				onWithTime={() => {
					setMenu(null);
					const from = new Date(start);
					from.setHours(9, 0, 0, 0);
					setDialog({
						type: 'blocker',
						slot: {
							start: from,
							end: new Date(from.getTime() + 3_600_000)
						}
					});
				}}
				onAppointment={() => {
					setMenu(null);
					setAnchorDate(startOfDay(start));
					controller.changeView(FC_VIEW.day);
					controller.gotoDate(start);
					setView('day');
				}}
			/>
		);
	} else if (menu?.type === 'entry') {
		const { entry } = menu;
		const actions = entryActions(entry, { ownerId, role, can });
		const colleague =
			entry.ownerId !== ownerId
				? colleagueById[entry.ownerId]
				: undefined;
		menuLabel = t('calendar.entryMenu.label', {
			title: label(entry, !!colleague)
		});
		menuRole = menu.mode === 'list' ? 'menu' : 'dialog';
		menuWidth = 300;
		menuContent = (
			<EntryMenuContent
				entry={entry}
				actions={actions}
				colleague={colleague}
				mode={menu.mode}
				entries={entries}
				ownerId={ownerId}
				onMode={(mode) => setMenu({ ...menu, mode })}
				onAction={(action) => entryAction(entry, action)}
				onMove={(start, end) => {
					setMenu(null);
					if (menu.mode === 'propose') propose(entry, start, end);
					else move(entry, start, end);
				}}
			/>
		);
	} else if (menu?.type === 'proposal') {
		menuLabel = t('calendar.proposal.label');
		menuContent = (
			<ProposalMenuContent
				proposal={menu.proposal}
				entry={menu.entry}
				approverName={
					colleagueById[menu.entry.ownerId]?.displayName ?? ''
				}
				onWithdraw={
					onWithdrawProposal
						? () => withdraw(menu.proposal)
						: undefined
				}
			/>
		);
	} else if (menu?.type === 'edge') {
		const { change } = menu;
		menuLabel = t('calendar.grip.menuLabel', {
			what: t(
				change.edge === 'start'
					? 'calendar.grip.start'
					: 'calendar.grip.end'
			)
		});
		menuWidth = 300;
		menuContent = (
			<EdgeMenuContent
				edge={change.edge}
				day={change.day}
				from={change.from}
				to={change.to}
				remember={menu.remember}
				onRemember={(remember) => setMenu({ ...menu, remember })}
				onChoose={(choice) => {
					setMenu(null);
					if (menu.remember) {
						writeEdgeChoice(ownerId, choice);
						setEdgeChoice(choice);
					}
					applyEdge(change, choice);
				}}
			/>
		);
	} else if (menu?.type === 'settings') {
		menuLabel = t('calendar.settings.label');
		menuAlign = 'end';
		menuContent = (
			<SettingsMenuContent
				workingHoursSummary={summary}
				rememberedEdge={gripsOn ? edgeChoice : null}
				onForgetEdge={forgetEdge}
				switcherStyle={switcherStyle}
				onWorkingHours={
					editHours
						? () => {
								setMenu(null);
								setDialog({ type: 'workingHours' });
							}
						: undefined
				}
				onSwitcherStyle={(style) => {
					setSwitcherStyle(style);
					writeSwitcherStyle(ownerId, style);
				}}
				onSync={
					feed
						? () => {
								setMenu(null);
								setDialog({ type: 'sync' });
							}
						: undefined
				}
			/>
		);
	} else if (menu?.type === 'view') {
		menuLabel = t('calendar.viewSwitch');
		menuAlign = 'end';
		menuWidth = 220;
		menuContent = (
			<ViewMenuContent
				views={views}
				current={view}
				onChoose={changeView}
			/>
		);
	} else if (menu?.type === 'jump') {
		menuLabel = t('calendar.jump.label');
		menuRole = 'dialog';
		menuWidth = 240;
		menuContent = <JumpMenuContent now={now} onJump={goTo} />;
	} else if (menu?.type === 'people') {
		menuLabel = t('calendar.people.label');
		menuContent = (
			<PeopleMenuContent
				colleagues={colleagues}
				shown={shownColleagues}
				scopeHint={t(`calendar.scopeHint.${visibility.scope}`)}
				onToggle={toggleColleague}
			/>
		);
	} else if (menu?.type === 'kinds') {
		menuLabel = t('calendar.kindsMenu.label');
		menuAlign = 'end';
		menuContent = (
			<KindsMenuContent
				hidden={hiddenFacets}
				onToggle={(facet) =>
					setHiddenFacets((all) => toggle(all, facet))
				}
				onShowAll={() => setHiddenFacets([])}
			/>
		);
	}

	const openAt =
		(type: 'settings' | 'view' | 'jump' | 'people' | 'kinds') =>
		(event: React.MouseEvent<HTMLElement>) =>
			setMenu({ type, anchor: event.currentTarget });

	// --- Header ---
	const viewSwitch =
		switcherStyle === 'digits' && !compact ? (
			<div
				className="calendarStage__digits"
				role="radiogroup"
				aria-label={t('calendar.viewSwitch')}
			>
				{views.map((name) => (
					<QuickTip key={name} title={t(`calendar.views.${name}`)}>
						<button
							type="button"
							role="radio"
							aria-checked={name === view}
							aria-label={t(`calendar.views.${name}`)}
							className="calendarStage__digit"
							onClick={() => changeView(name)}
							data-cy={`calendar-digit-${name}`}
						>
							{VIEW_DIGIT[name] ?? VIEW_ICON[name]}
						</button>
					</QuickTip>
				))}
			</div>
		) : (
			<button
				type="button"
				className="calendarStage__pillButton"
				aria-haspopup="menu"
				aria-expanded={menu?.type === 'view'}
				aria-label={t('calendar.viewMenu', {
					view: t(`calendar.views.${view}`)
				})}
				onClick={openAt('view')}
				data-cy="calendar-view-menu"
			>
				{t(`calendar.views.${view}`)}
				<ArrowDropDownIcon fontSize="small" />
			</button>
		);

	const header = (
		<header className="calendarStage__header">
			{shown.length > 0 && (
				<button
					type="button"
					className="calendarStage__avatars"
					aria-label={t('calendar.people.label')}
					onClick={openAt('people')}
				>
					{shown.slice(0, 4).map((c) => (
						<span
							key={c.id}
							className="calendarStage__avatar"
							aria-hidden="true"
						>
							{initialsOf(c.displayName)}
						</span>
					))}
				</button>
			)}
			<h1 className="calendarStage__title">
				{t('navigation.booking.events')}
			</h1>
			{consultant && onCreate && (
				<QuickTip title={t('calendar.create')}>
					<button
						type="button"
						className="calendarStage__create"
						aria-label={t('calendar.create')}
						onClick={() => setDialog({ type: 'appointment' })}
						data-cy="calendar-create"
					>
						<AddIcon fontSize="small" />
					</button>
				</QuickTip>
			)}
			<div className="calendarStage__headerEnd">
				{viewSwitch}
				{!compact && (
					<QuickTip
						title={
							fullscreen
								? t('calendar.fullscreenExit')
								: t('calendar.fullscreen')
						}
					>
						<button
							type="button"
							className="calendarStage__round"
							aria-label={
								fullscreen
									? t('calendar.fullscreenExit')
									: t('calendar.fullscreen')
							}
							aria-pressed={fullscreen}
							onClick={() => setFullscreen((on) => !on)}
							data-cy="calendar-fullscreen"
						>
							{fullscreen ? (
								<FullscreenExitIcon />
							) : (
								<FullscreenIcon />
							)}
						</button>
					</QuickTip>
				)}
				{consultant && (
					<QuickTip title={t('calendar.settings.label')}>
						<button
							type="button"
							className="calendarStage__round"
							aria-label={t('calendar.settings.label')}
							aria-haspopup="menu"
							aria-expanded={menu?.type === 'settings'}
							onClick={openAt('settings')}
							data-cy="calendar-settings"
						>
							<MoreVertIcon />
						</button>
					</QuickTip>
				)}
			</div>
		</header>
	);

	const toolbar = (
		<div className="calendarStage__toolbar">
			<div className="calendarStage__nav" role="group">
				<QuickTip title={t('calendar.previous')}>
					<button
						type="button"
						className="calendarStage__navButton"
						aria-label={t('calendar.previous')}
						onClick={() => page(-1)}
						data-cy="calendar-previous"
					>
						<ChevronLeftIcon fontSize="small" />
					</button>
				</QuickTip>
				<button
					type="button"
					className="calendarStage__today"
					onClick={() => goTo(now)}
					data-cy="calendar-today"
				>
					{t('calendar.today')}
				</button>
				<QuickTip title={t('calendar.jump.label')}>
					<button
						type="button"
						className="calendarStage__navButton calendarStage__navButton--drop"
						aria-label={t('calendar.jump.label')}
						aria-haspopup="dialog"
						aria-expanded={menu?.type === 'jump'}
						onClick={openAt('jump')}
						data-cy="calendar-jump"
					>
						<ArrowDropDownIcon fontSize="small" />
					</button>
				</QuickTip>
				<QuickTip title={t('calendar.next')}>
					<button
						type="button"
						className="calendarStage__navButton"
						aria-label={t('calendar.next')}
						onClick={() => page(1)}
						data-cy="calendar-next"
					>
						<ChevronRightIcon fontSize="small" />
					</button>
				</QuickTip>
			</div>
			<h2 className="calendarStage__range" aria-live="polite">
				{rangeTitle}
			</h2>
			{split && (
				<div
					className="calendarStage__segmented"
					role="group"
					aria-label={t('calendar.split.range')}
				>
					{SPLIT_DAY_CHOICES.map((n) => (
						<button
							key={n}
							type="button"
							className="calendarStage__segment"
							aria-pressed={splitDays === n}
							onClick={() => setSplitDays(n)}
							data-cy={`calendar-split-days-${n}`}
						>
							{n === 1
								? t('calendar.split.oneDay')
								: t('calendar.split.threeDays')}
						</button>
					))}
				</div>
			)}
		</div>
	);

	// One row above the calendar (Frank, 2026-11-14): shown colleagues are
	// pressed chips, the last ones shown are unpressed chips to switch back
	// on, then "Weitere …". It scrolls sideways with arrows at the edges.
	const hiddenRecent = recentPills(
		recent,
		colleagues.map((c) => c.id)
	)
		.filter((id) => !shownColleagues.includes(id))
		.map((id) => colleagueById[id])
		.filter(Boolean)
		.slice(0, MAX_RECENT_COLLEAGUES) as Colleague[];
	const personChip = (
		id: string,
		name: string,
		pressed: boolean,
		onClick: () => void,
		colleague?: Colleague
	) => (
		<button
			key={id}
			type="button"
			className={`calendarStage__person${colleague && !pressed ? ' calendarStage__person--off' : ''}`}
			aria-pressed={pressed}
			title={colleague?.agencyName}
			onMouseEnter={() => pressed && setHighlight({ owner: id })}
			onFocus={() => pressed && setHighlight({ owner: id })}
			onBlur={() => setHighlight(null)}
			onClick={onClick}
			data-cy={`calendar-person-${id}`}
		>
			<span
				className={`calendarStage__personAvatar${colleague ? '' : ' calendarStage__personAvatar--me'}`}
				aria-hidden="true"
			>
				{colleague ? initialsOf(name) : t('calendar.people.me')}
			</span>
			<span>{colleague ? name : t('calendar.myCalendar')}</span>
			{colleague?.agencyShort && (
				<span className="calendarStage__agency">
					{colleague.agencyShort}
				</span>
			)}
		</button>
	);
	const peopleBar = consultant &&
		(colleagues.length > 0 || shown.length > 0) && (
			<div
				className="calendarStage__people"
				role="group"
				aria-label={t('calendar.people.bar')}
				title={t('calendar.people.hint')}
				onMouseLeave={() => setHighlight(null)}
			>
				<HoverScrollArrows
					targetRef={peopleRef}
					data-cy="calendar-people-arrows"
					sx={{ flex: 1, minWidth: 0 }}
				>
					<div ref={peopleRef} className="calendarStage__peopleRow">
						{personChip(ownerId, '', !muted.includes(ownerId), () =>
							setMuted((all) => toggle(all, ownerId))
						)}
						{shown.map((c) =>
							personChip(
								c.id,
								c.displayName,
								true,
								() => toggleColleague(c.id),
								c
							)
						)}
						{hiddenRecent.map((c) =>
							personChip(
								c.id,
								c.displayName,
								false,
								() => toggleColleague(c.id),
								c
							)
						)}
						{colleagues.length > 0 && (
							<button
								type="button"
								className="calendarStage__person calendarStage__person--more"
								aria-haspopup="menu"
								aria-expanded={menu?.type === 'people'}
								onClick={openAt('people')}
								data-cy="calendar-person-more"
							>
								{t('calendar.people.more')}
							</button>
						)}
					</div>
				</HoverScrollArrows>
			</div>
		);

	// Phone: the left column is the bottom sheet, the kind chips are row 2
	// under the header; "Was anzeigen" sits in the sheet's search field, as
	// on a wide screen (Frank, 2026-11-14).
	const phoneKinds = (
		<CalendarKindChips
			ownerId={ownerId}
			now={now}
			entries={entries}
			onlyFacets={onlyFacets}
			hiddenFacets={hiddenFacets}
			onToggleFacet={(facet) =>
				setOnlyFacets((all) => toggle(all, facet))
			}
			onHighlightFacet={(facet) => setHighlight(facet ? { facet } : null)}
			className="calendarStage__kinds"
		/>
	);

	const splitOverflows =
		split &&
		splitDays * (AXIS_PX + (shown.length + 1) * SPLIT_COLUMN_MIN_PX) >
			stageWidth;

	// While loading, the grid stays mounted under a spinner: it is what
	// reports the first visible range, and with it starts the loading
	// (reviews 4574733779, 4574779921, 4574493856).
	let body: React.ReactNode;
	if (state === 'error')
		body = (
			<div className="calendarPage__status" role="alert">
				<p>{t('calendar.error.title')}</p>
				<button
					type="button"
					className="calendarPage__retry"
					onClick={onRetry}
				>
					{t('calendar.error.retry')}
				</button>
			</div>
		);
	else
		body = (
			<>
				{consultant && conversationsFailed && (
					<div
						className="calendarPage__banner"
						role="alert"
						data-testid="calendar-conversations-failed"
					>
						<span>{t('calendar.conversationsFailed')}</span>
						<button
							type="button"
							className="calendarPage__retry"
							onClick={onRetryConversations}
						>
							{t('calendar.error.retry')}
						</button>
					</div>
				)}
				<CalendarPager
					onPage={page}
					enabled={!compact && !splitOverflows}
					dragging={dragging}
				>
					{split ? (
						<CalendarSplitView
							day={anchorDate}
							days={splitDays}
							role={role}
							ownerId={ownerId}
							colleagues={shown}
							entries={visible}
							busyEntries={busyEntries}
							now={now}
							workingPlan={workingPlan}
							onEdgeChange={gripsOn ? onEdgeChange : undefined}
							proposals={pending}
							highlight={highlight}
							muted={muted}
							onSelectRange={(range, anchor) =>
								setMenu({ type: 'slot', range, anchor })
							}
							onEntryOpen={openEntry}
							onProposalOpen={(proposal, anchor) => {
								const found = pending.find(
									(p) => p.proposal.id === proposal.id
								);
								if (found)
									setMenu({
										type: 'proposal',
										proposal,
										entry: found.entry,
										anchor
									});
							}}
						/>
					) : (
						<CalendarView
							controller={controller}
							view={view}
							role={role}
							ownerId={ownerId}
							entries={visible}
							colleagues={colleagueById}
							compact={compact}
							now={fixedNow}
							initialDate={anchorDate}
							workingPlan={workingPlan}
							onEdgeChange={gripsOn ? onEdgeChange : undefined}
							proposals={pending}
							highlight={highlight}
							muted={muted}
							onSelectRange={(range, anchor) =>
								setMenu({ type: 'slot', range, anchor })
							}
							onSelectDays={(start, days, anchor) =>
								setMenu({ type: 'month', start, days, anchor })
							}
							onEntryOpen={openEntry}
							onProposalOpen={(proposal, anchor) => {
								const found = pending.find(
									(p) => p.proposal.id === proposal.id
								);
								if (found)
									setMenu({
										type: 'proposal',
										proposal,
										entry: found.entry,
										anchor
									});
							}}
							onEntryMove={move}
							onDatesSet={datesSet}
							onDragChange={setDragging}
						/>
					)}
				</CalendarPager>
				{state === 'loading' && (
					<div
						className="calendarPage__status calendarPage__status--overlay"
						aria-busy="true"
						data-testid="calendar-loading"
					>
						<CircularProgress
							size={32}
							aria-label={t('calendar.loading')}
						/>
					</div>
				)}
			</>
		);

	// The left column on a wide screen, the bottom sheet on a phone.
	const sheetCovers = compact && !fullscreen && sheet === 'full';
	const sideProps: CalendarSidebarProps = {
		ownerId,
		consultant,
		now,
		entries,
		colleagues,
		conversations,
		workingHours: workingPlan,
		workingHoursSummary: summary,
		onlyFacets,
		hiddenFacets,
		onToggleFacet: (facet) => setOnlyFacets((all) => toggle(all, facet)),
		onHighlightFacet: (facet) => setHighlight(facet ? { facet } : null),
		kindsMenuOpen: menu?.type === 'kinds',
		onOpenKinds: (anchor) => setMenu({ type: 'kinds', anchor }),
		openProposals: allPending,
		onOpenProposal: (proposal, entry, anchor) =>
			setMenu({ type: 'proposal', proposal, entry, anchor }),
		onWithdrawProposal: onWithdrawProposal ? withdraw : undefined,
		onOpenEntry: (entry, anchor) => openEntry(entry, anchor),
		shownColleagues,
		onCreate: onCreate ? create : undefined,
		onMoreDetails: moreDetails,
		onWorkingHours: editHours
			? () => setDialog({ type: 'workingHours' })
			: undefined
	};

	return (
		<div
			className={[
				'calendarPage',
				compact && 'calendarPage--compact',
				fullscreen && 'calendarPage--fullscreen'
			]
				.filter(Boolean)
				.join(' ')}
			data-testid="calendar-page"
		>
			{!compact && !fullscreen && <CalendarSidebar {...sideProps} />}
			<section
				ref={stageRef}
				className="calendarStage"
				aria-label={t('navigation.booking.events')}
				data-split={split || undefined}
				// The sheet all the way up works like a dialog: what it
				// covers is out of reach until it goes down again.
				inert={sheetCovers || undefined}
			>
				{header}
				{compact && phoneKinds}
				{toolbar}
				{peopleBar}
				<div className="calendarStage__grid">{body}</div>
			</section>
			{sheetCovers && (
				// A tap above the sheet lowers it (Escape does, too).
				<div
					className="calendarSheet__scrim"
					aria-hidden="true"
					onClick={() => setSheet('half')}
				/>
			)}
			{compact && !fullscreen && (
				<CalendarSheet
					stop={sheet}
					onStop={setSheet}
					label={t('calendar.side.label')}
				>
					<CalendarSidebar
						{...sideProps}
						variant="sheet"
						quickOpen={quickOpen}
						onQuickToggle={() => {
							const open = !quickOpen;
							setQuickOpen(open);
							// Room for the form: the sheet opens all the way.
							if (open) setSheet('full');
						}}
						onCreate={
							onCreate
								? (drafts) => {
										// Folds once the entry exists; a failure keeps the line open.
										const result = create(drafts);
										void Promise.resolve(result).then(
											(ok) => ok && setQuickOpen(false)
										);
										return result;
									}
								: undefined
						}
					/>
				</CalendarSheet>
			)}

			<CalendarMenu
				open={!!menu}
				anchor={menu?.anchor ?? null}
				label={menuLabel}
				role={menuRole}
				width={menuWidth}
				align={menuAlign}
				focusKey={menu?.type === 'entry' ? menu.mode : menu?.type}
				onClose={() => setMenu(null)}
				data-cy={menu ? `calendar-menu-${menu.type}` : undefined}
			>
				{menuContent}
			</CalendarMenu>

			{dialog?.type === 'appointment' && (
				<AppointmentDialog
					open
					slot={dialog.slot}
					initialSessionId={dialog.sessionId}
					conversations={conversations}
					entries={entries}
					ownerId={ownerId}
					now={now}
					fullScreen={compact}
					onSave={(draft) => create([draft])}
					onClose={() => setDialog(null)}
				/>
			)}
			{dialog?.type === 'blocker' && (
				<BlockerDialog
					open
					slot={dialog.slot}
					entries={entries}
					ownerId={ownerId}
					now={now}
					fullScreen={compact}
					onSave={create}
					onClose={() => setDialog(null)}
				/>
			)}
			{dialog?.type === 'workingHours' && editHours && (
				<WorkingHoursDialog
					open
					hours={workingHours}
					holidayRegion={holidayRegion}
					now={now}
					fullScreen={compact}
					onSave={(hours, region) => {
						setDialog(null);
						const next = summarise(hours);
						run(onSaveWorkingHours?.(hours, region), {
							message: next
								? t('calendar.workingHours.saved', {
										hours: next
									})
								: t('calendar.workingHours.cleared')
						});
					}}
					onClose={() => setDialog(null)}
				/>
			)}
			{dialog?.type === 'sync' && feed && (
				<CalendarSyncDialog
					open
					feed={feed}
					busyImport={busyImport}
					fullScreen={compact}
					onCopyFeed={(url) => onCopyFeed?.(url)}
					onResetFeed={() => onResetFeed?.()}
					onSaveImport={(url) => onSaveImport?.(url)}
					onRemoveImport={() => onRemoveImport?.()}
					onClose={() => setDialog(null)}
				/>
			)}
			{notice && (
				<M3Snackbar
					message={notice.message}
					action={
						notice.undo
							? {
									label: t('calendar.undo'),
									testId: 'calendar-undo',
									onClick: () => undo(notice)
								}
							: undefined
					}
					onClose={() => setNotice(null)}
					closeLabel={t('app.close')}
				/>
			)}
		</div>
	);
};
