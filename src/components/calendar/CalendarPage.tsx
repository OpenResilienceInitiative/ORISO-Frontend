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
 * Move proposals (contract "move proposals v1"): a counsellor proposes a new
 * time for a colleague's appointment and withdraws it; the colleague finds
 * it under "Offene Verschiebungen" and in the grid, and accepts or declines.
 * "Beitreten" has no backend yet: it appears only when the host passes its
 * callback (Storybook does, the app does not).
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
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { M3Snackbar } from '../m3Snackbar/M3Snackbar';
import {
	DEFAULT_VISIBILITY,
	draftConflicts,
	moveProblem,
	soonEntry,
	type AppointmentDraft,
	type AppointmentKind,
	type CalendarConversation,
	type CalendarEntry,
	type CalendarRole,
	type CalendarVisibility,
	type Colleague
} from './calendarModel';
import {
	facetOf,
	facetShown,
	type CalendarEntryFacet
} from './CalendarEntryGlyph';
import {
	entryActions,
	openProposals,
	ProposalNoLongerValid,
	RequestedTimeTaken,
	receivedBy,
	type EntryAction,
	type MoveProposal
} from './calendarActions';
import {
	COMPACT_VIEWS,
	DESKTOP_VIEWS,
	FC_VIEW,
	VIEW_DIGIT,
	rangeTitleOf,
	type CalendarViewName,
	type ViewSwitcherStyle
} from './calendarViews';
import {
	effectiveDay,
	exceedsWindowLimit,
	isWithinWorkingHours,
	MAX_DAY_EXCEPTIONS,
	MAX_WORKING_HOURS_WINDOWS,
	TooManyDayExceptions,
	moveEdge,
	edgeLabelKey,
	isPauseEdge,
	pauseCrossed,
	pauseMovedTo,
	pauseOf,
	withoutPause,
	withPauseAt,
	weeklyWithPause,
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
	readShownColleagues,
	readSwitcherStyle,
	MAX_RECENT_COLLEAGUES,
	recentPills,
	rememberColleague,
	writeRecentColleagues,
	writeShownColleagues,
	writeSwitcherStyle,
	readShowGrips,
	writeShowGrips,
	DEFAULT_LIST_WIDTH,
	LIST_RAIL_WIDTH,
	listModeOf,
	readListWidth,
	writeListWidth
} from './calendarPreferences';
import { ResizableHandle } from '../sessionsList/ResizableHandle';
import { SESSIONS_LIST_RESIZE } from '../sessionsList/sessionsListResize.constants';
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
	GRID_SLOT_PX,
	SPLIT_SLOT_PX,
	ZOOM_MAX,
	ZOOM_MIN,
	useCalendarZoom,
	zoomStep
} from './calendarZoom';
import {
	CalendarKindChips,
	CalendarKindsButton,
	CalendarSearch,
	CalendarSidebar,
	type CalendarSidebarProps,
	type FreeHoursState
} from './CalendarSidebar';
import {
	CalendarSettingsDialog,
	CALENDAR_CHIP_FACETS
} from './CalendarSettingsDialog';
import type { ChipView } from '../displayFilter/displayFilterTypes';
import { CalendarMenu } from './CalendarMenu';
import {
	EdgeMenuContent,
	PauseMenuContent,
	type PauseAction,
	EntryMenuContent,
	JumpMenuContent,
	MonthDayMenuContent,
	PeopleMenuContent,
	ProposalMenuContent,
	AppointmentRequestMenuContent,
	RequestMenuContent,
	SettingsMenuContent,
	SlotMenuContent,
	ViewMenuContent,
	VIEW_ICON,
	type SlotChoice
} from './calendarMenus';
import { initialsOf } from './CalendarEntryPeek';
import { avatarToneClass } from './calendarAvatar';
import { useCreatedFlash } from './useCreatedFlash';
import { HoverScrollArrows } from '../hoverScrollArrows/HoverScrollArrows';
import { NewEntryDialog } from './NewEntryDialog';
import { BlockerCreatedMessage } from './BlockerDialog';
import { MoveConflictDialog } from './MoveConflictDialog';
import {
	WorkingHoursDialog,
	useWorkingHoursSummary
} from './WorkingHoursDialog';
import { ConsultationHoursDialog } from './ConsultationHoursDialog';
import type { ConsultationHours } from './calendarConsultationHours';
import {
	CalendarSyncDialog,
	type CalendarFeed,
	type CalendarImport
} from './CalendarSyncDialog';
import { useEntryLabel, useRangeFormat } from './useEntryLabel';
import { M3Dialog } from '../m3Dialog/M3Dialog';
import type { QuickKind } from './calendarQuickEntry';
import { useLiveNow } from './useLiveNow';
import '../sessionsList/sessionsList.styles.scss';
import './calendar.styles.scss';
import { calendarLocale } from './calendarLocale';

export type { CalendarViewName } from './calendarViews';
export type CalendarLoadState = 'loading' | 'ready' | 'error';

/**
 * What a change callback returns: nothing or `true` when it is done,
 * `false` when it refuses, or a promise that settles once it is stored.
 */
export type ChangeResult = void | boolean | Promise<unknown>;

/**
 * Several change results as one: resolves to `false` when any refuses
 * (`false`, or a promise of `false`), rejects when any fails.
 */
export const allStored = (
	results: (ChangeResult | undefined)[]
): Promise<boolean> =>
	Promise.all(results).then((values) => !values.includes(false));

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
	 * Sprechstunden and booking settings (FE#2287); absent until loaded,
	 * and then not offered, so unloaded ones are never saved as empty.
	 */
	consultationHours?: ConsultationHours;
	onSaveConsultationHours?: (
		hours: ConsultationHours
	) => void | Promise<unknown>;
	/**
	 * The saved schedule has loaded. Until then (or when loading failed)
	 * neither the dialog nor the grips edit it, so an unloaded schedule is
	 * never saved as an empty one (review 4574779938), and no time is
	 * "alle frei": free time needs the saved hours (review 4581640874).
	 */
	workingHoursLoaded?: boolean;
	/** Single dates with their own hours ("Nur an diesem Tag"). */
	dayExceptions?: DayExceptions;
	/** Bundesland whose public holidays are days off; null = none. */
	holidayRegion?: HolidayRegion | null;
	/**
	 * Phone and tablet (Frank, prototype v15): the calendar fills the
	 * screen, the search sits at the very top, the working hours live in
	 * ⋮, no "Als Nächstes", and the bottom sheet only holds open requests.
	 */
	compact?: boolean;
	/**
	 * A phone: at most three days in the grid. The tablet keeps the work
	 * week. Defaults to `compact`.
	 */
	phone?: boolean;
	/** Phone: where the bottom sheet starts (default half). */
	initialSheet?: SheetStop;
	initialView?: CalendarViewName;
	/**
	 * Links without an appointment, shown under the list (Frank, 2026-11-17:
	 * "Meine Direktlinks" moves into the calendar). The wired page passes
	 * the real links panel, stories a sample.
	 */
	linksPanel?: React.ReactNode;
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
	/** Open move proposals sent for colleagues' appointments. */
	proposals?: MoveProposal[];
	/**
	 * Open move proposals colleagues sent for one's own appointments:
	 * "Offene Verschiebungen", answered with the two callbacks below.
	 */
	receivedProposals?: MoveProposal[];
	/**
	 * "Annehmen": the appointment moves. A rejection with
	 * `ProposalNoLongerValid` says the proposal no longer applies.
	 */
	onAcceptProposal?: (proposal: MoveProposal) => ChangeResult;
	/** "Ablehnen": the appointment stays where it is. */
	onDeclineProposal?: (proposal: MoveProposal) => ChangeResult;
	onProposeMove?: (
		entry: CalendarEntry,
		start: Date,
		end: Date
	) => void | Promise<unknown>;
	onWithdrawProposal?: (proposal: MoveProposal) => void | Promise<unknown>;
	/**
	 * FE#2287: "Bestätigen" an advice seeker's request. A rejection with
	 * `RequestedTimeTaken` says the time is no longer free.
	 */
	onConfirmRequest?: (entry: CalendarEntry) => ChangeResult;
	/** FE#2287: "Ablehnen" an advice seeker's request; the time is free. */
	onDeclineRequest?: (entry: CalendarEntry) => ChangeResult;
	/** Team meetings and group dates (no backend yet). */
	onJoin?: (entry: CalendarEntry) => void;
	/** The visible range changed: load entries for it. */
	onRangeChange?: (start: Date, end: Date) => void;
	/** Colleagues whose calendars are switched on. */
	onShownColleaguesChange?: (ids: string[]) => void;
	/**
	 * Start or join the call; a promise that rejects says the conversation
	 * cannot be opened (review 4577642137).
	 */
	onStart?: (entry: CalendarEntry) => void | Promise<unknown>;
	/** "Zum Chat": open the conversation an appointment belongs to. */
	onOpenChat?: (entry: CalendarEntry) => void | Promise<unknown>;
	onCopyFeed?: (url: string) => void;
	/** Sync actions; a rejected promise keeps the dialog's input and says so. */
	onResetFeed?: () => void | Promise<unknown>;
	onSaveImport?: (url: string) => void | Promise<unknown>;
	onRemoveImport?: () => void | Promise<unknown>;
	onRetry?: () => void;
	/** The conversation lookup failed: appointments cannot name one. */
	conversationsFailed?: boolean;
	/**
	 * Colleagues whose calendar did not load: never counted as free, and
	 * said so with a retry (review 4575917303).
	 */
	failedColleagues?: string[];
	/**
	 * Calendars whose shown time is still loading, one's own (`ownerId`)
	 * or colleagues': unknown as well, marked as loading. Shared free time
	 * shows only once every shown calendar has this range (reviews
	 * 4576313280, 4576368852).
	 */
	loadingCalendars?: string[];
	onRetryColleagues?: () => void;
	/**
	 * Whether this week's own entries are in, which the next free hours
	 * are taken from; otherwise none are offered (review 4576313283).
	 */
	freeHoursState?: FreeHoursState;
	onRetryFreeHours?: () => void;
	onRetryConversations?: () => void;
}

type Dialog =
	| {
			type: 'appointment';
			slot?: { start: Date; end: Date; kind: AppointmentKind };
			sessionId?: number;
	  }
	| {
			type: 'blocker';
			slot?: { start: Date; end: Date };
			/** Ticked already: "Wöchentlich …" after a single blocker. */
			weekdays?: number[];
			/** "Wöchentlich …": the single blocker's all-day state and note. */
			allDay?: boolean;
			note?: string;
			/**
			 * "Wöchentlich …": the single blocker the series replaces. It
			 * stays until the series is saved (reviews 4589304582,
			 * 4589304593, 4589150206).
			 */
			replaces?: { entry: CalendarEntry; draft: AppointmentDraft };
	  }
	| { type: 'workingHours' }
	| { type: 'consultationHours' }
	| { type: 'sync' }
	| null;

type Menu =
	| {
			type: 'slot';
			anchor: MenuAnchor;
			range: { start: Date; end: Date };
			/** Chosen in the first step: the card asks "Mit wem?". */
			kind?: AppointmentKind;
	  }
	| { type: 'month'; anchor: MenuAnchor; start: Date; days: number }
	| {
			type: 'entry';
			anchor: MenuAnchor;
			entry: CalendarEntry;
			mode: 'list' | 'move' | 'propose';
			/**
			 * Opened from "Als Nächstes" or the rail, not from the grid:
			 * "Zum Termin" leads there (Frank, 2026-11-16).
			 */
			outside?: boolean;
	  }
	| {
			/** `proposal`: one's own, sent; `request`: one received. */
			type: 'proposal' | 'request';
			anchor: MenuAnchor;
			proposal: MoveProposal;
			entry: CalendarEntry;
	  }
	| {
			/** FE#2287: an advice seeker's request, answered like a proposal. */
			type: 'appointmentRequest';
			anchor: MenuAnchor;
			entry: CalendarEntry;
	  }
	| {
			type: 'settings' | 'view' | 'jump' | 'people';
			anchor: HTMLElement;
	  }
	| {
			type: 'edge';
			anchor: MenuAnchor;
			change: EdgeChange;
			remember: boolean;
	  }
	| {
			type: 'pause';
			anchor: MenuAnchor;
			change: EdgeChange;
			scope: EdgeChoice;
	  }
	| null;

interface Notice {
	message: string;
	/** Settles once undone; the failure notice shows if it does not. */
	undo?: () => ChangeResult;
	/** Nothing (or not all) was stored: try the same change again. */
	retry?: () => void;
	/** One blocker entered: "Wöchentlich …" turns it into a series. */
	weekly?: { entry: CalendarEntry; draft: AppointmentDraft };
}

/**
 * "Immer <Wochentag>" on a date with its own hours: the weekly hours were
 * stored, the date was not. `undone` says whether the weekly hours went
 * back (review 4577586478).
 */
class WeekWithoutDay extends Error {
	constructor(
		readonly dayError: unknown,
		readonly undone: boolean
	) {
		super('WEEK_WITHOUT_DAY');
	}
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

/** Below this stage width the header title shrinks from 26 to 22 px. */
const NARROW_STAGE_PX = 640;

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
	consultationHours,
	onSaveConsultationHours,
	workingHoursLoaded = true,
	dayExceptions,
	holidayRegion = null,
	compact = false,
	phone = compact,
	initialSheet = 'half',
	initialView,
	linksPanel,
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
	receivedProposals = [],
	onProposeMove,
	onWithdrawProposal,
	onAcceptProposal,
	onDeclineProposal,
	onConfirmRequest,
	onDeclineRequest,
	onJoin,
	onStart,
	onOpenChat,
	onCopyFeed,
	onResetFeed,
	onSaveImport,
	onRemoveImport,
	onRetry,
	conversationsFailed = false,
	failedColleagues = [],
	loadingCalendars = [],
	onRetryColleagues,
	freeHoursState = 'ready',
	onRetryFreeHours,
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
	// New appointments only for one's own, living conversations (C1, C6).
	const bookable = useMemo(
		() => conversations.filter((c) => c.bookable !== false),
		[conversations]
	);
	const views = phone ? COMPACT_VIEWS : DESKTOP_VIEWS;
	const controller = useCalendarController();

	// Without a saved choice the calendar opens as the list (Frank,
	// 2026-11-17), on the phone and on a wide screen alike.
	const [view, setView] = useState<CalendarViewName>(initialView ?? 'list');
	const [title, setTitle] = useState('');
	/** The day the grid stands on; the split view starts on this day. */
	const [anchorDate, setAnchorDate] = useState(() => startOfDay(now));
	const [splitDays, setSplitDays] = useState<SplitDays>(initialSplitDays);
	const [fullscreen, setFullscreen] = useState(initialFullscreen);
	// The left column, sized like "Gespräche" and remembered per person
	// (Frank, prototype v15).
	const [listWidth, setListWidthState] = useState(() =>
		readListWidth(ownerId)
	);
	const setListWidth = (width: number) => {
		setListWidthState(width);
		writeListWidth(ownerId, width);
	};
	const listMode = listModeOf(listWidth);
	const sideScroll = useRef<HTMLDivElement>(null);
	/** Counts up when "+" in the narrow column asks for the quick entry. */
	const [quickFocus, setQuickFocus] = useState(0);

	const [switcherStyle, setSwitcherStyle] = useState<ViewSwitcherStyle>(() =>
		readSwitcherStyle(ownerId, initialSwitcherStyle)
	);
	// The host's list wins; otherwise the ones shown before the reload,
	// still in reach (test finding C20).
	const [startShown] = useState<string[]>(() => {
		if (initialShownColleagues.length > 0) return initialShownColleagues;
		const stored = readShownColleagues(ownerId);
		return colleagues.length > 0
			? stored.filter((id) => colleagues.some((c) => c.id === id))
			: stored;
	});
	const [shownColleagues, setShownColleagues] =
		useState<string[]>(startShown);
	const [recent, setRecent] = useState<string[]>(() => [
		...startShown,
		...readRecentColleagues(ownerId).filter(
			(id) => !startShown.includes(id)
		)
	]);
	const [muted, setMuted] = useState<string[]>([]);
	/** Where "Nebeneinander" scrolls to after an entry was chosen. */
	const [splitFocus, setSplitFocus] = useState<Date | undefined>();
	const { flashIds, expectCreated, flash } = useCreatedFlash(
		entries,
		ownerId
	);
	const [highlight, setHighlight] = useState<CalendarHighlight | null>(null);
	// Like the session list chips: none selected shows everything, selected
	// chips narrow to those kinds. "Was anzeigen" hides kinds altogether.
	const [onlyFacets, setOnlyFacets] = useState<CalendarEntryFacet[]>([]);
	const [hiddenFacets, setHiddenFacets] = useState<CalendarEntryFacet[]>([]);
	// "Ansicht · Kalender" (Frank *14): which kinds get a button in the row.
	const [chipFacets, setChipFacets] =
		useState<CalendarEntryFacet[]>(CALENDAR_CHIP_FACETS);
	const [chipView, setChipView] = useState<ChipView>('icons');
	const [settingsOpen, setSettingsOpen] = useState(false);
	const viewCustomised =
		hiddenFacets.length > 0 ||
		chipFacets.length !== CALENDAR_CHIP_FACETS.length ||
		chipView !== 'icons';
	const [menu, setMenu] = useState<Menu>(null);
	const [dialog, setDialog] = useState<Dialog>(null);
	const creating = useRef(false);
	/** "Wöchentlich …" from removing the single blocker to its restore. */
	const replacing = useRef(false);
	const [notice, setNotice] = useState<Notice | null>(null);
	/** A move onto other entries waits for this answer. */
	const [moveAsk, setMoveAsk] = useState<{
		conflicts: CalendarEntry[];
		answer: (go: boolean) => void;
	} | null>(null);
	/** A new entry onto other entries, made outside a dialog, waits too. */
	/** "Absagen" asks first: the advice seeker is told at once (test C10). */
	const [cancelAsk, setCancelAsk] = useState<CalendarEntry | null>(null);
	const [createAsk, setCreateAsk] = useState<{
		conflicts: CalendarEntry[];
		blocker: boolean;
		answer: (go: boolean) => void;
	} | null>(null);
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
		facetShown(facet, onlyFacets, hiddenFacets);
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
	/** Waiting for one's own answer: always in the grid and the list. */
	const answering = !!(onAcceptProposal || onDeclineProposal);
	const requests = useMemo(
		() =>
			answering
				? openProposals(
						receivedProposals.filter((p) => receivedBy(p, ownerId)),
						entries
					)
				: [],
		[answering, receivedProposals, entries, ownerId]
	);
	const gridProposals = useMemo(
		() => [...requests, ...pending],
		[requests, pending]
	);
	/** Requests being answered: one answer each, buttons off meanwhile. */
	const [answeringIds, setAnsweringIds] = useState<string[]>([]);
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
	// "Beginnt gleich" marks one entry, the first of "Als Nächstes", in the
	// grid and the side list alike (review 4577641949).
	const soonId = soonEntry(
		entries.filter((e) => !hiddenFacets.includes(facetOf(e))),
		ownerId,
		now
	)?.id;

	const toggle = <T,>(list: T[], item: T) =>
		list.includes(item) ? list.filter((x) => x !== item) : [...list, item];

	const toggleColleague = (id: string) => {
		const next = toggle(shownColleagues, id);
		setShownColleagues(next);
		onShownColleaguesChange?.(next);
		writeShownColleagues(ownerId, next);
		if (next.includes(id)) {
			const remembered = rememberColleague(recent, id);
			setRecent(remembered);
			writeRecentColleagues(ownerId, remembered);
		} else setMuted((all) => all.filter((x) => x !== id));
	};

	/** "Ganze Beratungsstelle zeigen": shows them all, remembers each. */
	const showColleagues = (ids: string[]) => {
		const added = ids.filter((id) => !shownColleagues.includes(id));
		if (added.length === 0) return;
		const next = [...shownColleagues, ...added];
		setShownColleagues(next);
		onShownColleaguesChange?.(next);
		writeShownColleagues(ownerId, next);
		const remembered = added.reduce(
			(all, id) => rememberColleague(all, id),
			recent
		);
		setRecent(remembered);
		writeRecentColleagues(ownerId, remembered);
	};

	useEffect(() => {
		if (startShown.length > 0) onShownColleaguesChange?.(startShown);
		// Only once: the host loads the colleagues shown from the start.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// Colleagues that arrive after the start: drop a remembered one who is
	// out of reach now, so no empty column waits for them.
	useEffect(() => {
		if (colleagues.length === 0) return;
		const kept = shownColleagues.filter((id) =>
			colleagues.some((c) => c.id === id)
		);
		if (kept.length === shownColleagues.length) return;
		setShownColleagues(kept);
		onShownColleaguesChange?.(kept);
		writeShownColleagues(ownerId, kept);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [colleagues]);

	/**
	 * Success notice once the change is stored, the failure notice if it
	 * fails. Says whether it went through: `false` for a refusal or a
	 * failure, so a moved entry goes back and quick entry keeps its draft.
	 */
	const run = (
		result: ChangeResult | undefined,
		success: Notice | ((value: unknown) => Notice),
		failure: (error: unknown) => Notice = () => ({
			message: t('calendar.saveFailed')
		})
	): boolean | Promise<boolean> => {
		const done = (value: unknown) => {
			setNotice(typeof success === 'function' ? success(value) : success);
			return true;
		};
		if (result === false) return false;
		if (result && typeof (result as Promise<unknown>).then === 'function')
			return (result as Promise<unknown>).then(
				(value) => (value === false ? false : done(value)),
				(error) => {
					setNotice(failure(error));
					return false;
				}
			);
		return done(undefined);
	};

	/** A room that cannot be opened says so instead of doing nothing. */
	const openRoom = (
		open: CalendarPageProps['onStart'],
		entry: CalendarEntry
	) => {
		Promise.resolve(open?.(entry)).catch(() =>
			setNotice({ message: t('calendar.chatUnavailable') })
		);
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
	// A search result moves the calendar to its day and scrolls to an hour
	// before it (prototype v17); month, list and "Nebeneinander" give way to
	// the days with times. The work week hides Saturday and Sunday, so an
	// entry on a weekend opens the whole week (review 4589150187).
	const showEntry = (entry: CalendarEntry) => {
		// A kind filter may hide the result: show its kind first, or the
		// calendar lands on nothing (review 4589150199).
		const facet = facetOf(entry);
		if (!facetVisible(facet)) {
			setHiddenFacets((all) => all.filter((f) => f !== facet));
			setOnlyFacets((all) =>
				all.length && !all.includes(facet) ? [...all, facet] : all
			);
		}
		// A muted calendar ("ich" off) cannot be clicked: unmute the owner
		// (review 4589661566).
		setMuted((all) =>
			all.includes(entry.ownerId)
				? all.filter((id) => id !== entry.ownerId)
				: all
		);
		const start = new Date(entry.start);
		const weekend = start.getDay() === 0 || start.getDay() === 6;
		// A colleague's entry is only a band in one's own grid; side by
		// side draws it on its own, with its actions (review 4594535280).
		const colleagueOnly =
			entry.ownerId !== ownerId &&
			!entries.some((e) => e.id === entry.id && e.ownerId === ownerId);
		if (colleagueOnly) {
			if (!split) changeView('split');
		} else if (view === 'month' || view === 'list' || split)
			changeView(phone ? 'threeDays' : weekend ? 'week' : 'workWeek');
		else if (view === 'workWeek' && weekend) changeView('week');
		goTo(start);
		// The eye finds it where the calendar lands (Frank *7).
		flash([entry.id]);
		const before = new Date(
			Math.max(start.getTime() - 3600000, startOfDay(start).getTime())
		);
		// Side by side has its own scroll box (review 4594744890).
		setSplitFocus(before);
		const time = `${String(before.getHours()).padStart(2, '0')}:${String(before.getMinutes()).padStart(2, '0')}:00`;
		// The controller has no scrollToTime; its calendar does.
		window.setTimeout(() =>
			(
				controller as unknown as {
					calendarApi?: { scrollToTime(time: string): void };
				}
			).calendarApi?.scrollToTime(time)
		);
	};

	// Turned into a phone, five or seven days become three; back on a
	// wider screen, three become the work week (prototype v15).
	const wasPhone = useRef(phone);
	useEffect(() => {
		if (wasPhone.current === phone) return;
		wasPhone.current = phone;
		const next: CalendarViewName | null = phone
			? view === 'workWeek' || view === 'week'
				? 'threeDays'
				: null
			: view === 'threeDays'
				? 'workWeek'
				: null;
		if (!next) return;
		controller.changeView(FC_VIEW[next]);
		setView(next);
		// Only the switch between phone and wider matters here.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [phone]);

	// --- Zoom: one half-hour height for the time grid and "Nebeneinander";
	// until it is changed, each keeps today's height. ---
	const timeGridShown = split || (view !== 'month' && view !== 'list');
	const [zoom, setZoom] = useState<number | null>(null);
	const slotPx = zoom ?? (split ? SPLIT_SLOT_PX : GRID_SLOT_PX);
	// The element, not a ref: the calendar may mount after the page.
	const [zoomRoot, setZoomRoot] = useState<HTMLDivElement | null>(null);
	const zoomTo = useCalendarZoom(zoomRoot, {
		enabled: timeGridShown,
		slotPx,
		onZoom: setZoom
	});

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

	const locale = calendarLocale(i18n.language);
	const rangeTitle = !split
		? title
		: rangeTitleOf(
				splitDays === 1 ? 'day' : 'threeDays',
				anchorDate,
				addDays(anchorDate, splitDays),
				locale
			);

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
			// one removal fails or is refused (reviews 4574779925,
			// 4575297339).
			undo:
				first.type === 'blocker' &&
				onRemoveBlocker &&
				createdEntries.length > 0
					? () => allStored(createdEntries.map(onRemoveBlocker))
					: undefined,
			weekly:
				first.type === 'blocker' &&
				drafts.length === 1 &&
				onRemoveBlocker &&
				createdEntries.length === 1
					? { entry: createdEntries[0], draft: first }
					: undefined
		};
	};

	/**
	 * Resolves to whether the entries exist, so quick entry can keep its
	 * draft. A dialog closes only then: a refusal or failure keeps it open
	 * with everything typed. One creation at a time, so a second save while
	 * the first runs creates nothing (reviews 4575214168, 4575297363).
	 *
	 * Every way to create passes here. Onto own entries it asks first, as
	 * the creation dialogs do, with their words; a dialog has shown its
	 * conflict note and "Trotzdem anlegen" already, so its save comes
	 * `warned` and is not asked twice. Not confirmed, nothing is created
	 * and quick entry keeps its draft (review 4582758042).
	 */
	const create = (
		drafts: AppointmentDraft[],
		warned = false
	): boolean | Promise<boolean> => {
		if (creating.current) return false;
		if (!warned) {
			const conflicts = draftConflicts(drafts, entries, ownerId);
			if (conflicts.length > 0)
				return new Promise<boolean>((answer) =>
					setCreateAsk({
						conflicts,
						blocker: drafts.every((d) => d.type === 'blocker'),
						answer
					})
				).then((go) => (go ? create(drafts, true) : false));
		}
		// Close the dialog that saved (none for quick entry), not one opened
		// while it ran (reviews 4575868938, 4575941071).
		const origin = dialog;
		const closeOrigin = () =>
			setDialog((current) => (current === origin ? null : current));
		expectCreated(drafts);
		const outcome = run(onCreate?.(drafts), createNotice(drafts));
		if (outcome === true) closeOrigin();
		if (typeof outcome === 'boolean') return outcome;
		creating.current = true;
		return outcome.then((stored) => {
			creating.current = false;
			if (stored) closeOrigin();
			return stored;
		});
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
		if (choice === 'blocker') {
			setMenu(null);
			create([{ type: 'blocker', start: range.start, end: range.end }]);
		}
		// An appointment asks "Mit wem?" in the same card (prototype v17).
		else setMenu({ ...menu, kind: choice });
	};

	/** "Mit wem?" answered: the appointment is entered at once. */
	const pickSlotPerson = (sessionId: number) => {
		if (menu?.type !== 'slot' || !menu.kind) return;
		const { range, kind } = menu;
		setMenu(null);
		if (range.start.getTime() < now.getTime()) {
			setNotice({ message: t('calendar.dialog.error.past') });
			return;
		}
		create([
			{
				type: 'appointment',
				start: range.start,
				end: range.end,
				kind,
				sessionId
			}
		]);
	};

	/** "Mehr Angaben …" in the slot card: the full dialog, prefilled. */
	const moreSlotDetails = () => {
		if (menu?.type !== 'slot') return;
		const { range, kind } = menu;
		setMenu(null);
		setDialog({
			type: 'appointment',
			slot: { ...range, kind: kind ?? 'video' }
		});
	};

	/**
	 * A move runs the checks creating does: never into the past for an
	 * appointment, and a question first when it lands on other entries.
	 * Refused or not confirmed, the entry goes back and no notice says it
	 * moved (review 4577641945). The move form already shows the conflict
	 * note above its button, so it does not ask a second time (`warned`).
	 */
	const move = (
		entry: CalendarEntry,
		start: Date,
		end: Date,
		warned = false
	) => {
		const problem = moveProblem(
			entry,
			{ start, end },
			entries,
			ownerId,
			now
		);
		if (problem?.type === 'past') {
			setNotice({ message: t('calendar.movePast') });
			return false;
		}
		if (problem?.type === 'conflict' && !warned)
			return new Promise<boolean>((answer) =>
				setMoveAsk({ conflicts: problem.conflicts, answer })
			).then((go) => go && commitMove(entry, start, end));
		return commitMove(entry, start, end);
	};

	/** Says it moved only once the move went through. */
	const commitMove = (entry: CalendarEntry, start: Date, end: Date) => {
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
		// Refused at once: the change stays, so say so (review 4575297344).
		if (result === false) {
			setNotice({ message: t('calendar.saveFailed') });
			return;
		}
		if (result && typeof (result as Promise<unknown>).then === 'function')
			(result as Promise<unknown>).then(
				(value) => {
					if (value === false)
						setNotice({ message: t('calendar.saveFailed') });
				},
				() => setNotice({ message: t('calendar.saveFailed') })
			);
	};

	/**
	 * "Wöchentlich …" (prototype v17): the blocker form opens with the single
	 * blocker's time and its weekday ticked. The single blocker stays until
	 * the series is saved, so closing the form loses nothing.
	 */
	const weekly = (current: Notice) => {
		if (!current.weekly) return;
		const { draft } = current.weekly;
		setNotice(null);
		setDialog({
			type: 'blocker',
			slot: { start: draft.start, end: draft.end },
			weekdays: [draft.start.getDay()],
			allDay: !!draft.allDay,
			note: draft.note,
			replaces: current.weekly
		});
	};

	/**
	 * The series failed after the single blocker went: put it back. The
	 * open form then replaces the restored one, or nothing if that failed.
	 * A failed restore says so: the single blocker is gone, and saving the
	 * form again blocks the time (review 4589615832).
	 */
	const restoreBlocker = (replaces: {
		entry: CalendarEntry;
		draft: AppointmentDraft;
	}): Promise<void> => {
		const follow = (restored: unknown) => {
			if (restored === false || restored === undefined)
				setNotice({ message: t('calendar.restoreFailed') });
			const again =
				Array.isArray(restored) && restored.length === 1
					? (restored[0] as CalendarEntry)
					: undefined;
			setDialog((current) =>
				current?.type === 'blocker' && current.replaces === replaces
					? {
							...current,
							replaces: again
								? { entry: again, draft: replaces.draft }
								: undefined
						}
					: current
			);
		};
		return Promise.resolve()
			.then(() => onCreate?.([replaces.draft]))
			.then(follow, () => follow(undefined));
	};

	/**
	 * Saving the series: the single blocker goes first, and only once it is
	 * gone is the series created, so the first date is never blocked twice.
	 * A refused or failed removal creates nothing and keeps the form open;
	 * a failed series puts the single blocker back. A second save waits
	 * until that restore has settled (review 4589615841).
	 */
	const replaceBlocker = (
		replaces: { entry: CalendarEntry; draft: AppointmentDraft },
		drafts: AppointmentDraft[]
	): Promise<boolean> | boolean => {
		if (creating.current || replacing.current) return false;
		creating.current = true;
		replacing.current = true;
		return Promise.resolve()
			.then(() => onRemoveBlocker?.(replaces.entry))
			.then(
				(value) => value !== false,
				() => false
			)
			.then((removed) => {
				creating.current = false;
				if (!removed) {
					setNotice({ message: t('calendar.saveFailed') });
					return false;
				}
				return Promise.resolve(create(drafts, true)).then((stored) =>
					stored
						? stored
						: restoreBlocker(replaces).then(() => stored)
				);
			})
			.finally(() => {
				replacing.current = false;
			});
	};

	const propose = (entry: CalendarEntry, start: Date, end: Date) => {
		// UserService refuses a proposed start in the past; say so here.
		if (start.getTime() < now.getTime()) {
			setNotice({ message: t('calendar.movePast') });
			return false;
		}
		return run(onProposeMove?.(entry, start, end), {
			message: t('calendar.proposal.sent', {
				date: format(start, end),
				name: colleagueById[entry.ownerId]?.displayName ?? ''
			})
		});
	};

	/** The "from" of a request: the time it was made for. */
	const requestFrom = (proposal: MoveProposal, entry: CalendarEntry) => ({
		start: proposal.entryStart ?? entry.start,
		end: proposal.entryEnd ?? entry.end
	});

	/** One answer per request; the buttons rest until it is in. */
	const answer = (
		proposal: MoveProposal,
		send: (() => ChangeResult | undefined) | undefined,
		success: Notice
	) => {
		setMenu(null);
		if (!send || answeringIds.includes(proposal.id)) return;
		setAnsweringIds((all) => [...all, proposal.id]);
		void Promise.resolve(
			run(send(), success, (error) => ({
				message:
					error instanceof ProposalNoLongerValid
						? t('calendar.proposal.noLongerValid')
						: t('calendar.saveFailed')
			}))
		).finally(() =>
			setAnsweringIds((all) => all.filter((id) => id !== proposal.id))
		);
	};

	/** The usual move notice once it moved; the advice seeker learns of it. */
	const accept = (proposal: MoveProposal) =>
		answer(
			proposal,
			onAcceptProposal && (() => onAcceptProposal(proposal)),
			{
				message: t('calendar.moved', {
					date: format(proposal.start, proposal.end)
				})
			}
		);

	const decline = (proposal: MoveProposal, entry: CalendarEntry) => {
		const from = requestFrom(proposal, entry);
		answer(
			proposal,
			onDeclineProposal && (() => onDeclineProposal(proposal)),
			{
				message: t('calendar.proposal.declined', {
					date: format(from.start, from.end)
				})
			}
		);
	};

	/** FE#2287: one answer per request, as for a proposal. */
	const answerRequest = (
		entry: CalendarEntry,
		send: ((entry: CalendarEntry) => ChangeResult) | undefined,
		success: Notice
	) => {
		setMenu(null);
		if (!send || answeringIds.includes(entry.id)) return;
		setAnsweringIds((all) => [...all, entry.id]);
		void Promise.resolve(
			run(send(entry), success, (error) => ({
				message:
					error instanceof RequestedTimeTaken
						? t('sessionList.timeline.appointment.request.taken')
						: t('calendar.saveFailed')
			}))
		).finally(() =>
			setAnsweringIds((all) => all.filter((id) => id !== entry.id))
		);
	};

	const confirmRequest = (entry: CalendarEntry) =>
		answerRequest(entry, onConfirmRequest, {
			message: t('calendar.appointmentRequest.confirmed', {
				date: format(entry.start, entry.end)
			})
		});

	const declineRequest = (entry: CalendarEntry) =>
		answerRequest(entry, onDeclineRequest, {
			message: t('calendar.appointmentRequest.declined', {
				date: format(entry.start, entry.end)
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
	const editConsultationHours =
		consultant && !!consultationHours && !!onSaveConsultationHours;
	const gripsAvailable = consultant && editHours && !!onSaveDayException;
	// Switchable in ⋮ and kept in this browser (Frank *7.2).
	const [showGrips, setShowGrips] = useState(() => readShowGrips(ownerId));
	const gripsOn = gripsAvailable && showGrips;
	const gripDate = (day: Date) =>
		new Intl.DateTimeFormat(calendarLocale(i18n.language), {
			weekday: 'short',
			day: 'numeric',
			month: 'numeric'
		}).format(day);

	/** Keyboard users keep their place on the grip they moved. */
	const refocusGrip = (change: EdgeChange) =>
		requestAnimationFrame(() =>
			document
				.querySelector<HTMLElement>(
					`[data-grip="${dateKeyOf(change.day)}-${change.edge}"]`
				)
				?.focus()
		);

	/** A day save that failed: the 409 at the limit says what to do. */
	const dayFailure = (error: unknown): Notice => ({
		message:
			error instanceof TooManyDayExceptions
				? t('calendar.grip.tooManyDays', { max: MAX_DAY_EXCEPTIONS })
				: t('calendar.saveFailed')
	});

	/**
	 * The schedule as the page shows it now. Putting a weekday back starts
	 * from it, not from a snapshot of when the change began, so an edit
	 * saved meanwhile (another weekday, the holiday region) stays (review
	 * 4581369172).
	 */
	const latestSchedule = useRef({ hours: workingHours, holidayRegion });
	latestSchedule.current = { hours: workingHours, holidayRegion };

	/** One weekday back to `windows`; every other day and the region stay. */
	const restoreWeekday = (weekday: number, windows: TimeWindow[]) => {
		const { hours, holidayRegion: region } = latestSchedule.current;
		return onSaveWorkingHours?.(
			withWeekdayWindows(hours, weekday, windows),
			region
		);
	};

	/**
	 * "Immer <Wochentag>": the weekly hours, then the date's own hours when
	 * it has some. One after the other; when the date fails, the weekday
	 * goes back, so nothing stays half saved, and the notice says what
	 * happened and offers to try again (review 4577586478). Only that
	 * weekday goes back (review 4581369172).
	 */
	const saveWeekThenDay = ({
		nextHours,
		weekday,
		previousWindows,
		saveDay,
		success,
		place,
		retry
	}: {
		nextHours: WorkingHours;
		/** The weekday this change sets, and its windows before. */
		weekday: number;
		previousWindows: TimeWindow[];
		saveDay?: () => ChangeResult | undefined;
		success: Notice;
		place: { date: string; weekdays: string };
		retry: () => void;
	}) =>
		run(
			(async () => {
				if (
					(await onSaveWorkingHours?.(nextHours, holidayRegion)) ===
					false
				)
					return false;
				if (!saveDay) return true;
				try {
					if ((await saveDay()) === false) throw new Error('refused');
				} catch (error) {
					let undone = true;
					try {
						await restoreWeekday(weekday, previousWindows);
					} catch {
						undone = false;
					}
					throw new WeekWithoutDay(error, undone);
				}
				return true;
			})(),
			success,
			(error) => {
				if (!(error instanceof WeekWithoutDay))
					return { message: t('calendar.saveFailed'), retry };
				const limit = error.dayError instanceof TooManyDayExceptions;
				const what = t(
					error.undone
						? 'calendar.grip.weekUndone'
						: 'calendar.grip.weekOnly',
					place
				);
				return {
					message: limit
						? `${what} ${t('calendar.grip.tooManyDays', { max: MAX_DAY_EXCEPTIONS })}`
						: what,
					// At the limit, the same change fails again.
					...(!limit && { retry })
				};
			}
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
		const what = t(edgeLabelKey(change.edge));
		if (choice === 'day') {
			run(
				onSaveDayException?.(date, moved),
				{
					message: t('calendar.grip.savedDay', {
						what,
						date: gripDate(change.day),
						time: change.to
					}),
					undo: () =>
						previousException
							? onSaveDayException?.(date, previousException)
							: onDeleteDayException?.(date)
				},
				dayFailure
			);
		} else {
			const weekday = change.day.getDay();
			const base = windowsOn(workingHours, weekday);
			// The weekly start and end stay what they are: a pause edge
			// moved for every week on a day with its own hours brings only
			// that day's pause into a week without one (review 4576346783).
			// Without weekly hours, the day's own stand in.
			const weekly =
				base.length === 0
					? moveEdge(current.windows, change.edge, change.to)
					: isPauseEdge(change.edge) && !pauseOf(base)
						? weeklyWithPause(base, pauseOf(moved))
						: moveEdge(base, change.edge, change.to);
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
			saveWeekThenDay({
				nextHours,
				weekday,
				previousWindows: base,
				saveDay: previousException
					? () =>
							sameWindows(moved, weekly)
								? onDeleteDayException?.(date)
								: onSaveDayException?.(date, moved)
					: undefined,
				success: {
					message: t('calendar.grip.savedWeek', {
						what,
						weekdays: t(`calendar.grip.weekdays.${weekday}`),
						time: change.to
					}),
					// Both restorations go through Undo's failure notice
					// (review 4575253325).
					undo: () =>
						allStored([
							restoreWeekday(weekday, base),
							previousException
								? onSaveDayException?.(date, previousException)
								: undefined
						])
				},
				place: {
					date: gripDate(change.day),
					weekdays: t(`calendar.grip.weekdays.${weekday}`)
				},
				retry: () => latestApply.current.applyEdge(change, 'week')
			});
		}
		refocusGrip(change);
	};

	/**
	 * A pause grip pulled onto the other one: "Pause löschen" leaves one
	 * window, "Pause verschieben" puts the same pause where it was dropped;
	 * for this date (day exception) or every such weekday (weekly rule).
	 */
	const applyPause = (
		change: EdgeChange,
		action: PauseAction,
		scope: EdgeChoice
	) => {
		const date = dateKeyOf(change.day);
		const current = effectiveDay(change.day, workingPlan);
		const changed = (windows: typeof current.windows) => {
			if (action === 'delete') return withoutPause(windows);
			const target = pauseMovedTo(windows, change.edge, change.to);
			return target ? withPauseAt(windows, target) : windows;
		};
		const dayWindows = changed(current.windows);
		const moved = pauseOf(dayWindows);
		const previousException = dayExceptions?.[date];
		const weekday = change.day.getDay();
		const message = (where: 'Day' | 'Week') =>
			t(
				`calendar.grip.pause${action === 'delete' ? 'Deleted' : 'Moved'}${where}`,
				{
					date: gripDate(change.day),
					weekdays: t(`calendar.grip.weekdays.${weekday}`),
					start: moved?.start,
					end: moved?.end
				}
			);
		if (scope === 'day') {
			run(
				onSaveDayException?.(date, dayWindows),
				{
					message: message('Day'),
					undo: () =>
						previousException
							? onSaveDayException?.(date, previousException)
							: onDeleteDayException?.(date)
				},
				dayFailure
			);
			refocusGrip(change);
			return;
		}
		const base = windowsOn(workingHours, weekday);
		// Only the pause changes in the weekly hours, never their start and
		// end; with none, the day's own windows stand in (review 4576346783).
		const weekly = base.length ? weeklyWithPause(base, moved) : dayWindows;
		const nextHours = withWeekdayWindows(workingHours, weekday, weekly);
		if (exceedsWindowLimit(nextHours)) {
			setNotice({
				message: t('calendar.workingHours.tooMany', {
					max: MAX_WORKING_HOURS_WINDOWS
				})
			});
			refocusGrip(change);
			return;
		}
		saveWeekThenDay({
			nextHours,
			weekday,
			previousWindows: base,
			saveDay: previousException
				? () =>
						sameWindows(dayWindows, weekly)
							? onDeleteDayException?.(date)
							: onSaveDayException?.(date, dayWindows)
				: undefined,
			success: {
				message: message('Week'),
				undo: () =>
					allStored([
						restoreWeekday(weekday, base),
						previousException
							? onSaveDayException?.(date, previousException)
							: undefined
					])
			},
			place: {
				date: gripDate(change.day),
				weekdays: t(`calendar.grip.weekdays.${weekday}`)
			},
			retry: () => latestApply.current.applyPause(change, action, 'week')
		});
		refocusGrip(change);
	};

	// Retry runs the change again on what the page shows by then.
	const latestApply = useRef({ applyEdge, applyPause });
	latestApply.current = { applyEdge, applyPause };

	const decideEdge = (
		change: EdgeChange,
		anchor: { x: number; y: number }
	) => {
		const windows = effectiveDay(change.day, workingPlan).windows;
		if (pauseCrossed(windows, change.edge, change.to)) {
			setMenu({
				type: 'pause',
				anchor,
				change,
				scope: edgeChoice ?? 'day'
			});
			return;
		}
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
		shown: CalendarEntry,
		anchor: MenuAnchor,
		mode: 'list' | 'move' = 'list',
		outside = false
	) => {
		// Co-access: the colleague's appointment is in one's own calendar
		// too, with the same id. UserService lets a co-access holder move
		// it directly and refuses a proposal (400), so its own actions
		// apply.
		const entry =
			shown.ownerId !== ownerId && shown.type === 'appointment'
				? (entries.find(
						(e) => e.id === shown.id && e.ownerId === ownerId
					) ?? shown)
				: shown;
		// FE#2287: one's own request is answered, like a proposal.
		if (entry.requested && entry.ownerId === ownerId) {
			setMenu({ type: 'appointmentRequest', entry, anchor });
			return;
		}
		const actions = entryActions(entry, { ownerId, role, can });
		const formMode =
			mode === 'move'
				? actions.includes('move')
					? 'move'
					: actions.includes('propose')
						? 'propose'
						: 'list'
				: 'list';
		setMenu({ type: 'entry', entry, anchor, mode: formMode, outside });
	};

	const entryAction = (
		entry: CalendarEntry,
		action: 'show' | 'start' | 'chat' | 'join' | 'cancel' | 'remove'
	) => {
		setMenu(null);
		if (action === 'show') showEntry(entry);
		else if (action === 'start') openRoom(onStart, entry);
		else if (action === 'chat') openRoom(onOpenChat, entry);
		else if (action === 'join') onJoin?.(entry);
		else if (action === 'cancel') setCancelAsk(entry);
		else
			run(onRemoveBlocker?.(entry), {
				message: t('calendar.blockerRemoved')
			});
	};

	/** A dashed proposal in the grid: one's own to withdraw, or a request. */
	const openProposal = (proposal: MoveProposal, anchor: MenuAnchor) => {
		const found = gridProposals.find((p) => p.proposal.id === proposal.id);
		if (!found) return;
		setMenu({
			type: receivedBy(proposal, ownerId) ? 'request' : 'proposal',
			proposal,
			entry: found.entry,
			anchor
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
		// The second step has a search field: a dialog, not a menu.
		if (menu.kind) menuRole = 'dialog';
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
				kind={menu.kind}
				conversations={bookable}
				onPick={pickSlotPerson}
				onMore={moreSlotDetails}
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
		const actions: EntryAction[] = [
			...(menu.outside ? (['show'] as const) : []),
			...entryActions(entry, { ownerId, role, can })
		];
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
					else move(entry, start, end, true);
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
	} else if (menu?.type === 'request') {
		const { proposal, entry } = menu;
		menuLabel = t('calendar.proposal.requestMenu');
		menuContent = (
			<RequestMenuContent
				proposal={proposal}
				from={requestFrom(proposal, entry)}
				busy={answeringIds.includes(proposal.id)}
				onAccept={onAcceptProposal ? () => accept(proposal) : undefined}
				onDecline={
					onDeclineProposal
						? () => decline(proposal, entry)
						: undefined
				}
			/>
		);
	} else if (menu?.type === 'appointmentRequest') {
		const { entry } = menu;
		menuLabel = t('calendar.appointmentRequest.menu');
		menuContent = (
			<AppointmentRequestMenuContent
				entry={entry}
				busy={answeringIds.includes(entry.id)}
				onConfirm={
					onConfirmRequest ? () => confirmRequest(entry) : undefined
				}
				onDecline={
					onDeclineRequest ? () => declineRequest(entry) : undefined
				}
			/>
		);
	} else if (menu?.type === 'edge') {
		const { change } = menu;
		menuLabel = t('calendar.grip.menuLabel', {
			what: t(edgeLabelKey(change.edge))
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
	} else if (menu?.type === 'pause') {
		const { change } = menu;
		const windows = effectiveDay(change.day, workingPlan).windows;
		const pause = pauseOf(windows);
		menuLabel = t('calendar.grip.pauseMenu');
		menuWidth = 300;
		menuContent = pause && (
			<PauseMenuContent
				day={change.day}
				pause={pause}
				movedTo={pauseMovedTo(windows, change.edge, change.to)}
				scope={menu.scope}
				onScope={(scope) => setMenu({ ...menu, scope })}
				onChoose={(action) => {
					setMenu(null);
					applyPause(change, action, menu.scope);
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
				showGrips={showGrips}
				onShowGrips={
					gripsAvailable
						? (show) => {
								setShowGrips(show);
								writeShowGrips(ownerId, show);
							}
						: undefined
				}
				switcherStyle={switcherStyle}
				onWorkingHours={
					editHours
						? () => {
								setMenu(null);
								setDialog({ type: 'workingHours' });
							}
						: undefined
				}
				consultationHoursSummary={
					consultationHours
						? summarise(consultationHours.windows)
						: undefined
				}
				onConsultationHours={
					editConsultationHours
						? () => {
								setMenu(null);
								setDialog({ type: 'consultationHours' });
							}
						: undefined
				}
				onRepeatBlocker={
					onCreate
						? () => {
								setMenu(null);
								setDialog({ type: 'blocker' });
							}
						: undefined
				}
				onFreeDays={
					onCreate
						? () => {
								// Holidays, a bridge day: one whole day from
								// tomorrow, widened in the dialog (prototype v16).
								setMenu(null);
								const tomorrow = addDays(startOfDay(now), 1);
								setDialog({
									type: 'blocker',
									slot: {
										start: tomorrow,
										end: addDays(tomorrow, 1)
									}
								});
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
		menuWidth = 300;
		menuContent = (
			<PeopleMenuContent
				colleagues={colleagues}
				shown={shownColleagues}
				scopeHint={t(`calendar.scopeHint.${visibility.scope}`)}
				onToggle={toggleColleague}
				onShowAll={showColleagues}
				onSideBySide={
					views.includes('split')
						? () => changeView('split')
						: undefined
				}
			/>
		);
	}

	const openAt =
		(type: 'settings' | 'view' | 'jump' | 'people') =>
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
			// A white pill: the view's icon, its name and ▾ (prototype v17);
			// on the phone and the tablet the icon alone.
			<button
				type="button"
				className="calendarStage__viewButton"
				aria-haspopup="menu"
				aria-expanded={menu?.type === 'view'}
				aria-label={t('calendar.viewMenu', {
					view: t(`calendar.views.${view}`)
				})}
				onClick={openAt('view')}
				data-cy="calendar-view-menu"
			>
				<span className="calendarStage__viewIcon" aria-hidden="true">
					{VIEW_ICON[view]}
				</span>
				<span className="calendarStage__viewLabel">
					{t(`calendar.views.${view}`)}
				</span>
				<ArrowDropDownIcon fontSize="small" aria-hidden />
			</button>
		);

	// "Meine Termine", or "Termine" once colleagues are shown; with "ich"
	// and every shown colleague as avatars in front and ▾ after it, one
	// button that opens "Kalender anzeigen" (prototype v17).
	const headerTitle =
		shown.length > 0
			? t('calendar.header.shared')
			: t('navigation.booking.events');
	const header = (
		<header className="calendarStage__header">
			{consultant && onCreate && (
				<QuickTip title={t('calendar.header.newEntry')}>
					<button
						type="button"
						className="calendarStage__create"
						aria-label={t('calendar.header.newEntry')}
						onClick={() => setDialog({ type: 'appointment' })}
						data-cy="calendar-create"
					>
						<AddIcon aria-hidden />
						<span
							className="calendarStage__createLabel"
							aria-hidden="true"
						>
							{t('calendar.header.new')}
						</span>
					</button>
				</QuickTip>
			)}
			<h1 className="calendarStage__heading">
				{consultant ? (
					<button
						type="button"
						className="calendarStage__who"
						aria-haspopup="menu"
						aria-expanded={menu?.type === 'people'}
						aria-label={`${headerTitle}, ${t('calendar.people.label')}`}
						onClick={openAt('people')}
						data-cy="calendar-who"
					>
						<span
							className="calendarStage__avatars"
							aria-hidden="true"
						>
							<span className="calendarStage__avatar calAvatar--me">
								{t('calendar.people.meAvatar')}
							</span>
							{shown.map((c) => (
								<span
									key={c.id}
									className={`calendarStage__avatar ${avatarToneClass(c.displayName)}`}
								>
									{initialsOf(c.displayName)}
								</span>
							))}
						</span>
						<span className="calendarStage__title">
							{headerTitle}
						</span>
						<ArrowDropDownIcon
							className="calendarStage__caret"
							aria-hidden
						/>
					</button>
				) : (
					<span className="calendarStage__title">{headerTitle}</span>
				)}
			</h1>
			<div className="calendarStage__headerEnd">
				{viewSwitch}
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
							<CloseFullscreenIcon />
						) : (
							<OpenInFullIcon />
						)}
					</button>
				</QuickTip>
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

	// The date bar: a filled pill (‹ · Heute ▾ · ›) with "Heute" in light
	// pink, the range title, then − and + (prototype v17).
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
				<span className="calendarStage__todayPair">
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
							className="calendarStage__jump"
							aria-label={t('calendar.jump.label')}
							aria-haspopup="dialog"
							aria-expanded={menu?.type === 'jump'}
							onClick={openAt('jump')}
							data-cy="calendar-jump"
						>
							<ArrowDropDownIcon fontSize="small" />
						</button>
					</QuickTip>
				</span>
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
			{timeGridShown && (
				<div
					className="calendarStage__segmented calendarStage__zoom"
					role="group"
					aria-label={t('calendar.zoomLabel')}
					data-cy="calendar-zoom"
				>
					{(
						[
							[-1, 'calendar.zoomOut', '\u2212'],
							[1, 'calendar.zoomIn', '+']
						] as const
					).map(([direction, key, glyph]) => {
						const atBound =
							direction < 0
								? slotPx <= ZOOM_MIN
								: slotPx >= ZOOM_MAX;
						return (
							<QuickTip key={key} title={t(key)}>
								{/* A disabled button gets no hover: the tip sits on the span. */}
								<span className="calendarStage__zoomTip">
									<button
										type="button"
										className="calendarStage__segment calendarStage__zoomButton"
										aria-label={t(key)}
										disabled={atBound}
										onClick={() =>
											zoomTo(zoomStep(slotPx, direction))
										}
										data-cy={
											direction < 0
												? 'calendar-zoom-out'
												: 'calendar-zoom-in'
										}
									>
										<span aria-hidden="true">{glyph}</span>
									</button>
								</span>
							</QuickTip>
						);
					})}
				</div>
			)}
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
	// White chips: "ich" first, then who is shown; who was shown lately
	// stays as a dashed chip; "Weitere …" in red opens the people menu
	// (prototype v17).
	// Names that repeat get their Beratungsstelle on the chip, so two
	// "Bart Simpson" can be told apart (test finding C12).
	const twinNames = new Set(
		colleagues
			.map((c) => c.displayName)
			.filter((name, i, all) => all.indexOf(name) !== i)
	);
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
			className={`calendarStage__person${colleague && !pressed ? ' calendarStage__person--off' : ''}${colleague ? '' : ' calendarStage__person--me'}`}
			aria-pressed={pressed}
			title={colleague?.agencyName}
			onMouseEnter={() => pressed && setHighlight({ owner: id })}
			onFocus={() => pressed && setHighlight({ owner: id })}
			onBlur={() => setHighlight(null)}
			onClick={onClick}
			data-cy={`calendar-person-${id}`}
		>
			<span
				className={`calendarStage__personAvatar ${colleague ? avatarToneClass(name) : avatarToneClass('', true)}`}
				aria-hidden="true"
			>
				{colleague ? initialsOf(name) : t('calendar.people.meAvatar')}
			</span>
			<span>{colleague ? name : t('calendar.people.me')}</span>
			{colleague &&
				(colleague.agencyShort ||
					(twinNames.has(colleague.displayName) &&
						colleague.agencyName)) && (
					<span className="calendarStage__agency">
						{colleague.agencyShort ?? colleague.agencyName}
					</span>
				)}
		</button>
	);
	// Only while someone is shown or was shown lately (prototype v17).
	const peopleBar = consultant &&
		(shown.length > 0 || hiddenRecent.length > 0) && (
			<div
				className="calendarStage__people"
				role="group"
				aria-label={t('calendar.people.bar')}
				title={t('calendar.people.hint')}
				onMouseLeave={() => setHighlight(null)}
				data-cy="calendar-people-bar"
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
			onToggleFacet={(facet) =>
				setOnlyFacets((all) => toggle(all, facet))
			}
			onHighlightFacet={(facet) => setHighlight(facet ? { facet } : null)}
			facets={chipFacets}
			view={chipView}
			className="calendarStage__kinds"
		/>
	);

	const splitOverflows =
		split &&
		splitDays * (AXIS_PX + (shown.length + 1) * SPLIT_COLUMN_MIN_PX) >
			stageWidth;

	// While loading, the grid stays mounted under a spinner: it is what
	// reports the first visible range, and with it starts the loading
	// (reviews 4574733779, 4574779921, 4574493856). A failed load covers it
	// but keeps it mounted, so the chosen view and date survive the retry
	// (review 4575159303).
	// Shown colleagues whose calendar did not load: no "alle frei" while
	// one is missing.
	const failedIds = new Set(failedColleagues);
	const loadingIds = new Set(loadingCalendars);
	const unloaded = shown.filter((c) => failedIds.has(c.id));
	// Still loading: as unknown for shared free time, but not a failure
	// (reviews 4576313280, 4576346785).
	const stillLoading = shown.filter(
		(c) => loadingIds.has(c.id) && !failedIds.has(c.id)
	);
	const unknownIds = new Set([...failedIds, ...loadingIds]);
	// One's own calendar of another range on its way: the split view
	// knows nobody to be free either (review 4576368852).
	const ownLoading = loadingIds.has(ownerId) ? [ownerId] : [];
	const unknown = [
		...ownLoading,
		...shown.filter((c) => unknownIds.has(c.id)).map((c) => c.id)
	];

	const body: React.ReactNode = (
		<>
			{/* Covered by the error, banners included: out of reach for the
			    keyboard and screen readers as well, but mounted (reviews
			    4575868941, 4575941073). The retry sits outside. */}
			<div
				ref={setZoomRoot}
				className="calendarPage__covered"
				inert={state === 'error' || undefined}
				data-testid="calendar-covered"
			>
				{unloaded.length > 0 && (
					<div
						className="calendarPage__banner"
						role="alert"
						data-testid="calendar-colleagues-failed"
					>
						<span>
							{t('calendar.colleagueFailed', {
								names: unloaded
									.map((c) => c.displayName)
									.join(', ')
							})}
						</span>
						{onRetryColleagues && (
							<button
								type="button"
								className="calendarPage__retry"
								onClick={onRetryColleagues}
							>
								{t('calendar.error.retry')}
							</button>
						)}
					</div>
				)}
				{/* Askers too: their appointments lead to their chats
				    (review 4575917412). */}
				{conversationsFailed && (
					<div
						className="calendarPage__banner"
						role="alert"
						data-testid="calendar-conversations-failed"
					>
						<span>
							{t(
								consultant
									? 'calendar.conversationsFailed'
									: 'calendar.conversationsFailedAsker'
							)}
						</span>
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
							focusTime={splitFocus}
							days={splitDays}
							role={role}
							ownerId={ownerId}
							colleagues={shown}
							onChoosePeople={
								consultant && colleagues.length > 0
									? openAt('people')
									: undefined
							}
							entries={visible}
							busyEntries={busyEntries}
							unavailable={unknown}
							loading={[
								...ownLoading,
								...stillLoading.map((c) => c.id)
							]}
							now={now}
							workingPlan={workingPlan}
							workingPlanUnknown={
								role === 'consultant' && !workingHoursLoaded
							}
							onEdgeChange={gripsOn ? onEdgeChange : undefined}
							hourPx={slotPx * 2}
							proposals={gridProposals}
							highlight={highlight}
							muted={muted}
							flashIds={flashIds}
							onSelectRange={(range, anchor) =>
								setMenu({ type: 'slot', range, anchor })
							}
							onEntryOpen={openEntry}
							onProposalOpen={openProposal}
						/>
					) : (
						<CalendarView
							controller={controller}
							view={view}
							role={role}
							ownerId={ownerId}
							entries={visible}
							busyEntries={busyEntries}
							soonId={soonId ?? null}
							colleagues={colleagueById}
							bandPeople={shown.filter(
								(c) => !unknownIds.has(c.id)
							)}
							unavailable={unloaded}
							loading={stillLoading}
							compact={compact}
							now={fixedNow}
							initialDate={anchorDate}
							workingPlan={workingPlan}
							onEdgeChange={gripsOn ? onEdgeChange : undefined}
							slotPx={slotPx}
							proposals={gridProposals}
							highlight={highlight}
							muted={muted}
							flashIds={flashIds}
							onSelectRange={(range, anchor) =>
								setMenu({ type: 'slot', range, anchor })
							}
							onSelectDays={(start, days, anchor) =>
								setMenu({ type: 'month', start, days, anchor })
							}
							onEntryOpen={openEntry}
							onProposalOpen={openProposal}
							onEntryMove={move}
							onDatesSet={datesSet}
							onDragChange={setDragging}
						/>
					)}
				</CalendarPager>
				{view === 'list' && linksPanel}
			</div>
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
			{state === 'error' && (
				<div
					className="calendarPage__status calendarPage__status--overlay calendarPage__status--error"
					role="alert"
					data-testid="calendar-error"
				>
					<p>{t('calendar.error.title')}</p>
					<button
						type="button"
						className="calendarPage__retry"
						onClick={onRetry}
					>
						{t('calendar.error.retry')}
					</button>
				</div>
			)}
		</>
	);

	// The left column on a wide screen, the bottom sheet on the phone and
	// the tablet, there only while requests are open (prototype v15).
	const sheetShown =
		compact &&
		!fullscreen &&
		(allPending.length > 0 || requests.length > 0);
	const sheetCovers = sheetShown && sheet === 'full';
	const sideProps: CalendarSidebarProps = {
		ownerId,
		consultant,
		now,
		soonId,
		entries,
		colleagues,
		conversations: bookable,
		workingHours: workingPlan,
		workingHoursSummary: summary,
		onlyFacets,
		hiddenFacets,
		onToggleFacet: (facet) => setOnlyFacets((all) => toggle(all, facet)),
		onHighlightFacet: (facet) => setHighlight(facet ? { facet } : null),
		kindsMenuOpen: settingsOpen,
		onOpenKinds: () => setSettingsOpen(true),
		kindsCustomised: viewCustomised,
		chipFacets,
		chipView,
		openProposals: allPending,
		onOpenProposal: (proposal, entry, anchor) =>
			setMenu({ type: 'proposal', proposal, entry, anchor }),
		onWithdrawProposal: onWithdrawProposal ? withdraw : undefined,
		requests: requests.map(({ proposal, entry }) => ({
			proposal,
			entry,
			from: requestFrom(proposal, entry)
		})),
		answeringIds,
		onOpenRequest: (proposal, entry, anchor) =>
			setMenu({ type: 'request', proposal, entry, anchor }),
		onAcceptRequest: onAcceptProposal ? accept : undefined,
		onDeclineRequest: onDeclineProposal ? decline : undefined,
		onOpenEntry: (entry, anchor) => openEntry(entry, anchor, 'list', true),
		onShowEntry: showEntry,
		shownColleagues,
		onCreate: onCreate ? create : undefined,
		freeHoursState,
		onRetryFreeHours,
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
				sheetShown && 'calendarPage--sheet',
				fullscreen && 'calendarPage--fullscreen'
			]
				.filter(Boolean)
				.join(' ')}
			data-testid="calendar-page"
		>
			{!compact && !fullscreen && (
				<div
					className={`calendarSide__frame calendarSide__frame--${listMode}`}
					style={{ width: listWidth }}
					data-cy="calendar-side-frame"
				>
					<CalendarSidebar
						{...sideProps}
						mode={listMode}
						scrollRef={sideScroll}
						quickFocus={quickFocus}
						onWiden={() => {
							setListWidth(DEFAULT_LIST_WIDTH);
							setQuickFocus((n) => n + 1);
						}}
					/>
					{/* The pink grip of "Gespräche": centred on the column, so
					    it stays put while the list scrolls. */}
					<ResizableHandle
						currentWidth={listWidth}
						onResize={setListWidth}
						scrollTargetRef={sideScroll}
						minWidth={LIST_RAIL_WIDTH}
						maxWidth={SESSIONS_LIST_RESIZE.EXPANDED_MAX_WIDTH}
						ariaLabel={t('calendar.side.resize')}
						data-cy="calendar-side-resize"
					/>
				</div>
			)}
			<section
				ref={stageRef}
				className={
					// A narrow stage next to the list takes a smaller title
					// (prototype v17: 22 px under an 1100 px wide app).
					!compact && stageWidth > 0 && stageWidth < NARROW_STAGE_PX
						? 'calendarStage calendarStage--narrow'
						: 'calendarStage'
				}
				aria-label={t('navigation.booking.events')}
				data-split={split || undefined}
				// The sheet all the way up works like a dialog: what it
				// covers is out of reach until it goes down again.
				inert={sheetCovers || undefined}
			>
				{compact && (
					<div className="calendarStage__search">
						<CalendarSearch
							ownerId={ownerId}
							entries={entries}
							colleagues={colleagues}
							shownColleagues={shownColleagues}
							onlyFacets={onlyFacets}
							hiddenFacets={hiddenFacets}
							onShowEntry={showEntry}
							leading={
								<CalendarKindsButton
									customised={viewCustomised}
									open={settingsOpen}
									onOpen={() => setSettingsOpen(true)}
								/>
							}
							floating
						/>
					</div>
				)}
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
			{sheetShown && (
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
				focusKey={
					menu?.type === 'entry'
						? menu.mode
						: menu?.type === 'slot'
							? (menu.kind ?? 'slot')
							: menu?.type
				}
				onClose={() => setMenu(null)}
				data-cy={menu ? `calendar-menu-${menu.type}` : undefined}
			>
				{menuContent}
			</CalendarMenu>

			{/* "Neu" and every other way in: one "Neuer Eintrag" with the
			    tabs Termin | Sperrzeit (prototype v17). */}
			{/* Mounted only while open: it reads the profile's e-mail settings. */}
			{settingsOpen && (
				<CalendarSettingsDialog
					open
					onClose={() => setSettingsOpen(false)}
					hiddenFacets={hiddenFacets}
					onHiddenChange={setHiddenFacets}
					chipFacets={chipFacets}
					onChipsChange={(next) => {
						setChipFacets(next);
						// A chosen kind whose button leaves the row would stay
						// filtered with no way back: clear it (review
						// 4594645452).
						setOnlyFacets((all) =>
							all.filter((facet) => next.includes(facet))
						);
					}}
					chipView={chipView}
					onChipViewChange={setChipView}
					fullScreen={compact}
				/>
			)}
			{(dialog?.type === 'appointment' || dialog?.type === 'blocker') && (
				<NewEntryDialog
					open
					initialTab={dialog.type}
					slot={dialog.slot}
					initialSessionId={
						dialog.type === 'appointment'
							? dialog.sessionId
							: undefined
					}
					initialWeekdays={
						dialog.type === 'blocker' ? dialog.weekdays : undefined
					}
					initialAllDay={
						dialog.type === 'blocker' ? dialog.allDay : undefined
					}
					initialNote={
						dialog.type === 'blocker' ? dialog.note : undefined
					}
					conversations={bookable}
					entries={
						dialog.type === 'blocker' && dialog.replaces
							? entries.filter(
									(e) => e.id !== dialog.replaces?.entry.id
								)
							: entries
					}
					ownerId={ownerId}
					now={now}
					fullScreen={compact}
					onSaveAppointment={(draft) => create([draft], true)}
					onSaveBlocker={(drafts) =>
						dialog.type === 'blocker' && dialog.replaces
							? replaceBlocker(dialog.replaces, drafts)
							: create(drafts, true)
					}
					onWorkingHours={
						editHours
							? () => setDialog({ type: 'workingHours' })
							: undefined
					}
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
			{dialog?.type === 'consultationHours' &&
				editConsultationHours &&
				consultationHours && (
					<ConsultationHoursDialog
						open
						hours={consultationHours}
						fullScreen={compact}
						onSave={(hours) => {
							setDialog(null);
							run(onSaveConsultationHours?.(hours), {
								message: t('calendar.consultationHours.saved')
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
			{cancelAsk && (
				<M3Dialog
					open
					data-testid="calendar-cancel-dialog"
					title={t('calendar.cancelAsk.title')}
					description={t('calendar.cancelAsk.description', {
						name: label(cancelAsk),
						time: format(cancelAsk.start, cancelAsk.end)
					})}
					severity="error"
					fullScreen={false}
					onClose={() => setCancelAsk(null)}
					closeLabel={t('app.close')}
					actions={[
						{
							label: t('calendar.cancelAsk.keep'),
							onClick: () => setCancelAsk(null)
						},
						{
							label: t('calendar.cancelAsk.confirm'),
							primary: true,
							onClick: () => {
								const entry = cancelAsk;
								setCancelAsk(null);
								run(onCancelAppointment?.(entry), {
									message: t('calendar.cancelled')
								});
							},
							testId: 'calendar-cancel-confirm'
						}
					]}
				/>
			)}
			{createAsk && (
				<MoveConflictDialog
					conflicts={createAsk.conflicts}
					fullScreen={compact}
					title={t(
						createAsk.blocker
							? 'calendar.blocker.title'
							: 'calendar.create'
					)}
					confirmLabel={t('calendar.dialog.saveAnyway')}
					testIdPrefix="calendar-create"
					onConfirm={() => {
						createAsk.answer(true);
						setCreateAsk(null);
					}}
					onCancel={() => {
						createAsk.answer(false);
						setCreateAsk(null);
					}}
				/>
			)}
			{moveAsk && (
				<MoveConflictDialog
					conflicts={moveAsk.conflicts}
					fullScreen={compact}
					onConfirm={() => {
						moveAsk.answer(true);
						setMoveAsk(null);
					}}
					onCancel={() => {
						moveAsk.answer(false);
						setMoveAsk(null);
					}}
				/>
			)}
			{notice && (
				<M3Snackbar
					message={
						notice.weekly ? (
							<BlockerCreatedMessage
								message={notice.message}
								onWeekly={() => weekly(notice)}
							/>
						) : (
							notice.message
						)
					}
					action={
						notice.undo
							? {
									label: t('calendar.undo'),
									testId: 'calendar-undo',
									onClick: () => undo(notice)
								}
							: notice.retry
								? {
										label: t('calendar.error.retry'),
										testId: 'calendar-retry',
										onClick: () => {
											setNotice(null);
											notice.retry?.();
										}
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
