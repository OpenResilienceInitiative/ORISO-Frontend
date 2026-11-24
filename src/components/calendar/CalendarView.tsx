/**
 * The calendar grid (ADR-032 §1–§2): FullCalendar's MIT core in ORISO
 * tokens. The page owns the toolbar, the view and the paging and hands in
 * the controller; this component only draws entries and reports what the
 * pointer did. All data comes in through props — the view never fetches.
 *
 * Round 2 (Frank's prototype, 2026-11-14): one colour per kind, working
 * hours shaded, a "ganztägig" row, colleague entries with a tooltip, pending
 * move proposals drawn dashed, a double click opens straight into
 * "Verschieben".
 */
import * as React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import FullCalendar, {
	type CalendarController,
	type DateSelectInfo,
	type EventClickInfo,
	type EventDisplayInfo,
	type EventDropInfo,
	type EventInput
} from '@fullcalendar/react';
import classicTheme from '@fullcalendar/react/themes/classic';
import dayGridPlugin from '@fullcalendar/react/daygrid';
import timeGridPlugin from '@fullcalendar/react/timegrid';
import listPlugin from '@fullcalendar/react/list';
import interactionPlugin from '@fullcalendar/react/interaction';
import deLocale from '@fullcalendar/react/locales/de';
import { Popper } from '@mui/material';
import FreeBreakfastOutlinedIcon from '@mui/icons-material/FreeBreakfastOutlined';
import { ReactComponent as ClockIcon } from '../../resources/img/icons/clock.svg';
import enGbLocale from '@fullcalendar/react/locales/en-gb';
import frLocale from '@fullcalendar/react/locales/fr';
import ruLocale from '@fullcalendar/react/locales/ru';
import trLocale from '@fullcalendar/react/locales/tr';
import '@fullcalendar/react/skeleton.css';
import '@fullcalendar/react/themes/classic/theme.css';
import './fullCalendarGuards';
import {
	createMoveGuard,
	isMovable,
	soonEntry,
	visibleHours,
	type CalendarEntry,
	type CalendarRole,
	type Colleague,
	type MoveResult
} from './calendarModel';
import { CalendarEntryGlyph, SoonBadge, facetOf } from './CalendarEntryGlyph';
import type { MoveProposal } from './calendarActions';
import {
	dayEdgesOf,
	dayExceptionAllowed,
	gripEdges,
	effectiveDay,
	minutesOf,
	offRangesOf,
	windowsOn,
	type WorkingHours,
	type WorkingPlan
} from './calendarWorkingHours';
import {
	CalendarWorkGrip,
	type EdgeChange,
	type GripGeometry
} from './CalendarWorkGrip';
import type { PublicHoliday } from './calendarHolidays';
import {
	FC_CUSTOM_VIEWS,
	FC_VIEW,
	rangeTitleOf,
	viewOfFcType,
	type CalendarViewName
} from './calendarViews';
import {
	useEntryLabel,
	useProposalStatus,
	useRangeFormat
} from './useEntryLabel';
import {
	bandKey,
	colleagueBands,
	foldsIntoBand,
	type ColleagueBand
} from './calendarBands';
import { CalendarEntryPeek, initialsOf } from './CalendarEntryPeek';
import {
	ENTRY_DOT_AVATAR_PX,
	avatarToneClass,
	entryAvatarSize
} from './calendarAvatar';
import { CalendarPersonAvatar } from './CalendarPersonAvatar';
import { calendarLocale, fullCalendarLocale } from './calendarLocale';
import { GRID_SLOT_PX } from './calendarZoom';
import './calendar.styles.scss';

export type GridViewName = Exclude<CalendarViewName, 'split'>;

// Module constants: new arrays per render make FullCalendar reset its view.
const PLUGINS = [
	classicTheme,
	dayGridPlugin,
	timeGridPlugin,
	listPlugin,
	interactionPlugin
];
const LOCALES = [deLocale, enGbLocale, frLocale, ruLocale, trLocale];

/** A click waits this long for a second one before it opens the menu. */
const DOUBLE_CLICK_MS = 230;

/** Who or what the pointer rests on; everything else is dimmed. */
export interface CalendarHighlight {
	owner?: string;
	facet?: string;
}

export type MenuAnchor = HTMLElement | { x: number; y: number };

export interface CalendarViewProps {
	controller: CalendarController;
	view: GridViewName;
	role: CalendarRole;
	/** Signed-in counsellor or advice seeker. */
	ownerId: string;
	/** Own entries plus colleagues' entries, already redacted and filtered. */
	entries: CalendarEntry[];
	/**
	 * The same people's entries before the kind filter: the bands count
	 * these, so a hidden blocker still makes a colleague busy (review
	 * 4576423989). Defaults to `entries`.
	 */
	busyEntries?: CalendarEntry[];
	/**
	 * The one entry marked "Beginnt gleich", picked by the page so the grid
	 * and the side list agree; `null` when none is soon. Left out, the grid
	 * picks it from its own entries (review 4577641949).
	 */
	soonId?: string | null;
	/** Colleagues by id, for names, initials and the tooltip. */
	colleagues?: Record<string, Colleague>;
	/**
	 * Shown colleagues whose calendars loaded: in the time grid their
	 * timed entries fold into "k von n belegt" bands.
	 */
	bandPeople?: Colleague[];
	/** Shown colleagues whose calendars did not load: no "all busy". */
	unavailable?: Colleague[];
	/**
	 * Shown colleagues whose calendars are still loading: no "all busy"
	 * either, and the band says they are loading (review 4576313280).
	 */
	loading?: Colleague[];
	compact?: boolean;
	/** Fixed "now" for Storybook and tests. */
	now?: Date;
	/** The day the grid opens on (it remounts after the split view). */
	initialDate?: Date;
	/** Weekly hours, day exceptions and the holiday region. */
	workingPlan?: WorkingPlan;
	/**
	 * One's own Sprechstunden: a background band in the time grid
	 * (FE#2494 *3). Entries still go over them; UserService then takes
	 * that time out of the advice seekers' free times.
	 */
	consultationWindows?: WorkingHours;
	/** One-off Sprechzeiten released from the calendar (FE#2494 *2b). */
	consultationOnce?: { start: Date; end: Date }[];
	/**
	 * A grip on the edge of one's own working day was moved; without it the
	 * grips are not drawn.
	 */
	onEdgeChange?: (
		change: EdgeChange,
		anchor: { x: number; y: number }
	) => void;
	/** Height of half an hour in the time grid (the zoom), in pixels. */
	slotPx?: number;
	/** Pending move proposals, drawn dashed at the proposed time. */
	proposals?: { proposal: MoveProposal; entry: CalendarEntry }[];
	highlight?: CalendarHighlight | null;
	/** Owners whose entries are faded out (people bar). */
	muted?: string[];
	/** Entries just created: they flash twice (prototype v17). */
	flashIds?: string[];
	/** A free range in the time grid was selected (counsellors only). */
	onSelectRange?: (
		range: { start: Date; end: Date },
		anchor: { x: number; y: number }
	) => void;
	/** One or more whole days were selected (month view, all-day row). */
	onSelectDays?: (
		start: Date,
		days: number,
		anchor: { x: number; y: number }
	) => void;
	/** `move`: a double click, straight into "Verschieben". */
	onEntryOpen?: (
		entry: CalendarEntry,
		anchor: MenuAnchor,
		mode: 'list' | 'move'
	) => void;
	onProposalOpen?: (proposal: MoveProposal, anchor: MenuAnchor) => void;
	/**
	 * A colleague band was clicked or tapped: the page opens who is busy
	 * with what (Frank *16.2). Without it the click explains the band in
	 * the tooltip, as hovering does.
	 */
	onBandOpen?: (band: ColleagueBand, el: HTMLElement) => void;
	/** The band that card is about: it is outlined. */
	selectedBand?: ColleagueBand | null;
	/**
	 * An own entry was dragged to a new time. Return false, or a promise
	 * that rejects or resolves to false, to put it back.
	 */
	onEntryMove?: (entry: CalendarEntry, start: Date, end: Date) => MoveResult;
	/** The visible range changed (first render, paging, view switch). */
	onDatesSet?: (title: string, start: Date, end: Date) => void;
	/** An entry is being dragged: the page pages at the edges. */
	onDragChange?: (dragging: boolean) => void;
}

interface EventProps {
	entry?: CalendarEntry;
	proposal?: MoveProposal;
	/** Background: time outside the working hours. */
	off?: { kind: 'off' | 'break' };
	/** Background, all-day: the public holiday of that date. */
	holiday?: PublicHoliday;
	/** Background: colleagues busy in this stretch. */
	band?: ColleagueBand;
	/** Background: one's own Sprechstunde (FE#2494 *3). */
	consultation?: 'weekly' | 'once';
}

/** The usual working day the time grid shows, before any widening. */
const DAY_FROM = 7 * 60;
const DAY_TO = 21 * 60;

/**
 * Earliest start and latest end of the working plan, on the full hour:
 * the grid widens to them, so a grip always sits at its own time and
 * never at a cut-off edge of the grid (review 4574981882).
 */
const planBounds = (plan?: WorkingPlan, consultation: WorkingHours = []) => {
	const windows = [
		...(plan?.hours ?? []),
		...Object.values(plan?.exceptions ?? {}).flat(),
		...consultation
	];
	return windows.reduce(
		(bounds, w) => ({
			from: Math.min(
				bounds.from,
				Math.floor(minutesOf(w.start) / 60) * 60
			),
			to: Math.max(bounds.to, Math.ceil(minutesOf(w.end) / 60) * 60)
		}),
		{ from: DAY_FROM, to: DAY_TO }
	);
};
/** "HH:MM:00" as minutes since midnight; "24:00:00" is 1440. */
const slotMinutes = (slot: string) => minutesOf(slot.slice(0, 5));

/**
 * The hours the time grids show, for the time grid and "Nebeneinander"
 * alike: the usual day widened to the working plan, to every entry and to
 * every dashed move proposal at its proposed time, so nothing falls
 * outside (reviews 4575253322, 4581640880).
 */
const gridHours = (
	entries: Pick<CalendarEntry, 'start' | 'end' | 'allDay'>[],
	plan?: WorkingPlan,
	proposals: { proposal: Pick<MoveProposal, 'start' | 'end'> }[] = [],
	/* One's own Sprechstunden (FE#2494 *3): their band must be visible too. */
	consultation: {
		windows?: WorkingHours;
		once?: { start: Date; end: Date }[];
	} = {}
) => {
	const bounds = planBounds(plan, consultation.windows);
	return visibleHours(
		[
			...entries,
			...(consultation.once ?? []).map((once) => ({
				start: once.start.toISOString(),
				end: once.end.toISOString()
			})),
			...proposals.map(({ proposal }) => ({
				start: proposal.start,
				end: proposal.end
			}))
		],
		bounds.from,
		bounds.to
	);
};

/** {@link gridHours} as minutes since midnight. */
export const gridMinutes = (...args: Parameters<typeof gridHours>) => {
	const hours = gridHours(...args);
	return {
		firstMinute: slotMinutes(hours.min),
		lastMinute: slotMinutes(hours.max)
	};
};
const TIME_GRID_VIEWS: GridViewName[] = [
	'day',
	'threeDays',
	'workWeek',
	'week'
];

const startOfDay = (date: Date) =>
	new Date(date.getFullYear(), date.getMonth(), date.getDate());
const nextDay = (day: Date) =>
	new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
/** Minutes since midnight as a date; 24:00 is the next midnight. */
const atMinutes = (day: Date, minutes: number) =>
	new Date(
		day.getFullYear(),
		day.getMonth(),
		day.getDate(),
		Math.floor(minutes / 60),
		minutes % 60
	);

/** Where a grip at HH:mm sits in its day column. */
const gripTop = (time: string, first: number, last: number) =>
	`${(Math.min(last, Math.max(first, minutesOf(time))) - first) / ((last - first) / 100)}%`;

/** YYYY-MM-DD as the local midnight. */
const dayOfKey = (key: string) => {
	const [year, month, date] = key.split('-').map(Number);
	return new Date(year, month - 1, date);
};

/** The day column a grip sits in (FullCalendar's time-grid cell). */
const measureColumn =
	(firstMinute: number, lastMinute: number) =>
	(grip: HTMLElement): GripGeometry | null => {
		const column = grip.closest<HTMLElement>('[role="cell"][data-date]');
		if (!column) return null;
		const rect = column.getBoundingClientRect();
		return {
			top: rect.top,
			left: rect.left,
			width: rect.width,
			height: rect.height,
			firstMinute,
			lastMinute
		};
	};

/**
 * FullCalendar reads an all-day end as an exclusive date. UserService may
 * store the last day as 23:59, which would drop that day.
 */
const allDayEnd = (end: string) => {
	const date = new Date(end);
	if (
		date.getHours() ||
		date.getMinutes() ||
		date.getSeconds() ||
		date.getMilliseconds()
	)
		date.setHours(24, 0, 0, 0);
	return date;
};

/**
 * The all-day row of the time grid starts one entry tall. FullCalendar
 * evens out that row after measuring it; starting at the height of one
 * entry spares the second pass ("ResizeObserver loop …") whenever a day has
 * at most one all-day entry.
 */
const allDayCellInnerClass = (info: { view: { type: string } }) =>
	info.view.type.startsWith('timeGrid') ? 'calendarView__allDayCell' : '';

/** The face the grid's labels use; one variable file covers every weight. */
const GRID_FONT = '400 14px "Inter Variable"';

/** True when the face is loaded, or unknown here (system font, jsdom). */
const fontsSettled = () => {
	try {
		return typeof document === 'undefined' || !document.fonts?.check
			? true
			: document.fonts.check(GRID_FONT);
	} catch {
		return true;
	}
};

/**
 * FullCalendar measures its labels once mounted. Mounting it while the web
 * font is still loading makes it measure twice in one frame ("ResizeObserver
 * loop …") and the grid visibly jumps; waiting for the font (at most a
 * second) avoids both.
 */
const useFontsReady = () => {
	const [ready, setReady] = useState(fontsSettled);
	useEffect(() => {
		if (ready) return undefined;
		let active = true;
		const done = () => active && setReady(true);
		document.fonts.load(GRID_FONT).then(done, done);
		const timer = window.setTimeout(done, 1000);
		return () => {
			active = false;
			window.clearTimeout(timer);
		};
	}, [ready]);
	return ready;
};

const propsOf = (info: { event: { extendedProps: unknown } }) =>
	info.event.extendedProps as EventProps;

const NO_PEOPLE: Colleague[] = [];
const NO_IDS: string[] = [];

/** Time grids wide enough for an entry's "10:00–11:00" line. */
const WIDE_TIME_GRIDS = [FC_VIEW.day, FC_VIEW.threeDays, FC_VIEW.workWeek];

/** The time axis reads "07:00" (prototype v17). */
const SLOT_HEADER_FORMAT = {
	hour: '2-digit',
	minute: '2-digit',
	hour12: false
} as const;
/** Day heads read "Mo., 16." (prototype v17). */
const DAY_HEADER_FORMAT = { weekday: 'short', day: 'numeric' } as const;

/** Today's head in the primary colour. */
const dayHeaderInnerClass = (info: { isToday: boolean }) =>
	info.isToday
		? 'calendarView__dayHead calendarView__dayHead--today'
		: 'calendarView__dayHead';
/** The month: today's number in a pink circle, a tint on hover. */
const dayCellClass = (info: { view: { type: string } }) =>
	info.view.type.startsWith('dayGrid') ? 'calendarView__monthDay' : '';
const dayCellTopInnerClass = (info: { isToday: boolean }) =>
	info.isToday
		? 'calendarView__dayNumber calendarView__dayNumber--today'
		: 'calendarView__dayNumber';
/** The list: no dot before an entry, a light head per day. */
const LIST_DOT_CLASS = 'calendarView__listDot';
const LIST_DAY_HEADER_CLASS = 'calendarView__listDay';

/** A colleague's avatar in a band, in the colour of their chip. */
const BandAvatar = ({ name }: { name: string }) => (
	<span
		className={`calendarView__bandAvatar ${avatarToneClass(name)}`}
		aria-hidden="true"
	>
		{initialsOf(name)}
	</span>
);

const DAY_MS = 86_400_000;
/** FullCalendar's slot, and so what a click without dragging selects. */
const SLOT_MS = 30 * 60_000;
/** A press that moves further than this is a drag, not a click. */
const CLICK_SLOP_PX = 6;

export const CalendarView = ({
	controller,
	view,
	role,
	ownerId,
	entries,
	busyEntries,
	soonId: soonIdProp,
	colleagues = {},
	bandPeople = NO_PEOPLE,
	unavailable = NO_PEOPLE,
	loading = NO_PEOPLE,
	compact = false,
	now,
	initialDate,
	workingPlan,
	consultationWindows,
	consultationOnce,
	onEdgeChange,
	proposals = [],
	highlight,
	muted = [],
	flashIds = NO_IDS,
	onSelectRange,
	onSelectDays,
	onEntryOpen,
	onProposalOpen,
	onBandOpen,
	selectedBand,
	onEntryMove,
	onDatesSet,
	onDragChange,
	slotPx = GRID_SLOT_PX
}: CalendarViewProps) => {
	const { t, i18n } = useTranslation();
	const label = useEntryLabel();
	const format = useRangeFormat();
	const proposalStatus = useProposalStatus(ownerId);
	const nowDate = now ?? new Date();
	const consultant = role === 'consultant';
	const gridRef = useRef<HTMLDivElement>(null);
	/** Where the last press began: a click that moved is a drag. */
	const pressedAt = useRef<{ x: number; y: number } | null>(null);
	const clock = new Intl.DateTimeFormat(calendarLocale(i18n.language), {
		hour: '2-digit',
		minute: '2-digit'
	});
	const timeRange = (from: Date, to: Date) =>
		`${clock.format(from)}–${clock.format(to)}`;
	const fontsReady = useFontsReady();
	const [peek, setPeek] = useState<
		| {
				el: HTMLElement;
				entry: CalendarEntry;
				proposal?: MoveProposal;
		  }
		| { el: HTMLElement; band: ColleagueBand }
		| null
	>(null);

	// The days FullCalendar shows, for the off-time of each date.
	const [shownRange, setShownRange] = useState<{
		start: Date;
		end: Date;
	} | null>(null);
	const timeGrid = TIME_GRID_VIEWS.includes(view);

	// Colleagues fold into bands in the time grid; month and list keep
	// single entries.
	const people = useMemo(() => bandPeople.map((c) => c.id), [bandPeople]);
	const banded = timeGrid && people.length > 0;
	const counted = busyEntries ?? entries;
	const bands = useMemo(
		() => (banded ? colleagueBands(counted, people) : []),
		[banded, counted, people]
	);
	const gridEntries = useMemo(
		() =>
			banded
				? entries.filter((entry) => !foldsIntoBand(entry, people))
				: entries,
		[banded, entries, people]
	);
	const bandPeopleById = useMemo(
		() => new Map(bandPeople.map((c) => [c.id, c])),
		[bandPeople]
	);
	const bandLabel = (band: ColleagueBand) =>
		people.length === 1
			? t('calendar.bandOne', {
					name: colleagues[band.busy[0]]?.displayName ?? ''
				})
			: t('calendar.bandSome', {
					busy: band.busy.length,
					total: people.length
				});
	// "All busy" only when every shown calendar is known.
	const allBusy = (band: ColleagueBand) =>
		band.busy.length === people.length &&
		unavailable.length === 0 &&
		loading.length === 0;

	const offEvents = useMemo<EventInput[]>(() => {
		if (!workingPlan || !shownRange) return [];
		const out: EventInput[] = [];
		for (
			let day = startOfDay(shownRange.start);
			day < shownRange.end;
			day = nextDay(day)
		) {
			const key = day.getTime();
			const { holiday } = effectiveDay(day, workingPlan);
			// A labelled all-day marker, not a background: FullCalendar
			// paints an all-day background into the time grid too, which
			// would print the name twice. The time grid shades the day as
			// time off.
			if (holiday)
				out.push({
					id: `holiday-${key}`,
					start: day,
					end: nextDay(day),
					allDay: true,
					editable: false,
					startEditable: false,
					durationEditable: false,
					extendedProps: { holiday }
				});
			if (!timeGrid) continue;
			for (const range of offRangesOf(day, workingPlan))
				out.push({
					id: `off-${key}-${range.from}`,
					start: atMinutes(day, range.from),
					end: atMinutes(day, range.to),
					display: 'background',
					extendedProps: { off: { kind: range.kind } }
				});
		}
		return out;
	}, [workingPlan, shownRange, timeGrid]);

	const consultationEvents = useMemo<EventInput[]>(() => {
		if (
			!timeGrid ||
			!shownRange ||
			(!consultationWindows?.length && !consultationOnce?.length)
		)
			return [];
		const out: EventInput[] = [];
		for (
			let day = startOfDay(shownRange.start);
			day < shownRange.end;
			day = nextDay(day)
		)
			for (const w of windowsOn(consultationWindows ?? [], day.getDay()))
				out.push({
					id: `consultation-${day.getTime()}-${w.start}`,
					start: atMinutes(day, minutesOf(w.start)),
					end: atMinutes(day, minutesOf(w.end)),
					display: 'background',
					extendedProps: { consultation: 'weekly' }
				});
		for (const once of consultationOnce ?? [])
			out.push({
				id: `consultation-once-${once.start.getTime()}`,
				start: once.start,
				end: once.end,
				display: 'background',
				extendedProps: { consultation: 'once' }
			});
		return out;
	}, [consultationWindows, consultationOnce, shownRange, timeGrid]);

	// The grips go into FullCalendar's day columns themselves: inside a
	// background event they would sit in a layer FullCalendar hides from
	// assistive technology (aria-hidden), where nothing may take focus.
	// Each date has an all-day cell and, after it, its time-grid column.
	const gripsShown = timeGrid && !!onEdgeChange && !!workingPlan;
	const [gripColumns, setGripColumns] = useState<
		{ key: string; day: Date; el: HTMLElement }[]
	>([]);
	useEffect(() => {
		const root = gridRef.current;
		if (!gripsShown || !root) {
			setGripColumns((current) => (current.length ? [] : current));
			return undefined;
		}
		let frame = 0;
		const scan = () => {
			const columns = new Map<string, HTMLElement>();
			root.querySelectorAll<HTMLElement>(
				'[role="cell"][data-date]'
			).forEach((el) => columns.set(el.dataset.date ?? '', el));
			const next = [...columns]
				.filter(([key]) => key)
				.map(([key, el]) => ({ key, el, day: dayOfKey(key) }));
			setGripColumns((current) =>
				current.length === next.length &&
				current.every((c, i) => c.el === next[i].el)
					? current
					: next
			);
		};
		scan();
		// FullCalendar may build new columns on any update.
		const observer = new MutationObserver(() => {
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(scan);
		});
		observer.observe(root, { childList: true, subtree: true });
		return () => {
			cancelAnimationFrame(frame);
			observer.disconnect();
		};
	}, [gripsShown, shownRange, view, fontsReady]);

	// The usual working day, widened so no entry, no proposal and no grip
	// falls outside the grid.
	const hours = useMemo(
		() =>
			gridHours(entries, workingPlan, proposals, {
				windows: consultationWindows,
				once: consultationOnce
			}),
		[entries, workingPlan, proposals, consultationWindows, consultationOnce]
	);
	const firstMinute = slotMinutes(hours.min);
	const lastMinute = slotMinutes(hours.max);
	const measure = useMemo(
		() => measureColumn(firstMinute, lastMinute),
		[firstMinute, lastMinute]
	);
	// One move per entry until it is stored or put back.
	const [guardMove] = useState(createMoveGuard);

	const events = useMemo<EventInput[]>(
		() => [
			...gridEntries.map((entry) => ({
				// One appointment can be in two calendars (co-access): the
				// grid keeps one event per id, so a colleague's copy needs
				// its own.
				id:
					entry.ownerId === ownerId
						? entry.id
						: `${entry.ownerId}/${entry.id}`,
				start: entry.start,
				end: entry.allDay ? allDayEnd(entry.end) : entry.end,
				allDay: !!entry.allDay,
				title: label(entry, entry.ownerId !== ownerId),
				editable: isMovable(entry, ownerId, role),
				extendedProps: { entry }
			})),
			...proposals.map(({ proposal, entry }) => ({
				id: `proposal-${proposal.id}`,
				start: proposal.start,
				end: proposal.end,
				title: t('calendar.proposal.label'),
				editable: false,
				allDay: !!entry.allDay,
				extendedProps: { entry, proposal }
			})),
			...offEvents,
			...consultationEvents,
			...bands.map((band) => ({
				id: `band-${bandKey(band)}`,
				start: band.start,
				end: band.end,
				display: 'background',
				extendedProps: { band }
			}))
		],
		[
			gridEntries,
			proposals,
			ownerId,
			role,
			label,
			t,
			offEvents,
			consultationEvents,
			bands
		]
	);

	// "Beginnt gleich" in words and a clock, not by colour alone, on the
	// one entry the side list marks too (review 4577641949).
	const soonId =
		soonIdProp === undefined
			? soonEntry(entries, ownerId, nowDate)?.id
			: (soonIdProp ?? undefined);

	const eventClass = useCallback(
		(info: EventDisplayInfo) => {
			const { entry, proposal, off, holiday } = propsOf(info);
			if (holiday) return 'calendarView__holiday';
			if (off) return '';
			if (!entry) return 'calEntry calEntry--mirror';
			const colleague = entry.ownerId !== ownerId;
			const facet = facetOf(entry);
			const dimmed =
				(highlight?.owner && highlight.owner !== entry.ownerId) ||
				(highlight?.facet && highlight.facet !== facet);
			return [
				'calEntry',
				`calEntry--${entry.type}`,
				`calEntry--k-${facet}`,
				colleague && 'calEntry--colleague',
				// An advice seeker's request is drawn like a proposal (FE#2287).
				(proposal || entry.requested) && 'calEntry--proposal',
				!proposal && entry.requested && 'calEntry--requested',
				!proposal && entry.id === soonId && 'calEntry--soon',
				// The list is plain rows, not filled blocks (prototype v17).
				info.view.type.startsWith('list') && 'calEntry--listRow',
				!proposal &&
					!colleague &&
					flashIds.includes(entry.id) &&
					'calEntry--flash',
				dimmed && 'calEntry--dimmed',
				muted.includes(entry.ownerId) && 'calEntry--muted'
			]
				.filter(Boolean)
				.join(' ');
		},
		// nowDate is fixed in stories; in the app a re-render refreshes it.
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[ownerId, highlight?.owner, highlight?.facet, muted, soonId, flashIds]
	);

	const eventContent = (info: EventDisplayInfo) => {
		const { entry, proposal, holiday } = propsOf(info);
		if (holiday)
			return (
				<span className="calendarView__holidayLabel">
					{t('calendar.holidays.label', {
						name: t(`calendar.holidays.names.${holiday.key}`, {
							defaultValue: holiday.name
						})
					})}
				</span>
			);
		if (!entry)
			return (
				<span className="calEntry__inner">
					<span className="calEntry__time">{info.timeText}</span>
				</span>
			);
		const colleague = entry.ownerId !== ownerId;
		const owner = colleague ? colleagues[entry.ownerId] : undefined;
		const viewType = info.view.type;
		const start = info.event.start;
		const end = info.event.end;
		// "10:00–11:00" on a line of its own where columns are wide enough:
		// day, three days, work week; from 45 minutes (prototype v17).
		const rangeShown =
			WIDE_TIME_GRIDS.includes(viewType) &&
			!info.event.allDay &&
			!!start &&
			!!end &&
			end.getTime() - start.getTime() >= 45 * 60_000;
		// The month names the start; the list has a time column of its own.
		const timeShown =
			viewType.startsWith('dayGrid') &&
			!info.event.allDay &&
			info.timeText;
		// The advice seeker on one's own appointment with their real avatar
		// (FE#2325), the colleague on theirs in the colleague's colour.
		const avatarName = owner
			? owner.displayName
			: !proposal && entry.type === 'appointment'
				? entry.title
				: undefined;
		const avatarSize = entryAvatarSize(
			viewType.startsWith('list')
				? 'list'
				: viewType.startsWith('timeGrid') && !info.event.allDay
					? 'timeGrid'
					: 'dayGrid',
			start && end ? (end.getTime() - start.getTime()) / 60_000 : 0,
			slotPx
		);
		const avatar = avatarName && (
			<CalendarPersonAvatar
				className="calEntry__avatar"
				name={avatarName}
				avatar={owner ? undefined : entry.avatar}
				size={avatarSize}
			/>
		);
		// A 32 px avatar in the time grid leads the box, title and time
		// beside it; in a list row it sits on the one line.
		const lead =
			!!avatar &&
			avatarSize > ENTRY_DOT_AVATAR_PX &&
			!viewType.startsWith('list');
		const body = (
			<>
				<span className="calEntry__line">
					{!lead && avatar}
					<span className="calEntry__icon">
						<CalendarEntryGlyph
							entry={entry}
							colleague={colleague}
						/>
					</span>
					{timeShown && (
						<span className="calEntry__time">{info.timeText}</span>
					)}
					<span className="calEntry__title">
						{proposal
							? t('calendar.proposal.label')
							: info.event.title}
					</span>
					{!proposal && entry.id === soonId && <SoonBadge />}
				</span>
				{proposal && (
					<span className="calEntry__status">
						{proposalStatus(proposal)}
					</span>
				)}
				{!proposal && entry.requested && (
					<span className="calEntry__status">
						{t('calendar.appointmentRequest.status')}
					</span>
				)}
				{rangeShown && !proposal && (
					<span className="calEntry__range">
						{timeRange(start!, end!)}
					</span>
				)}
			</>
		);
		return lead ? (
			<span className="calEntry__inner calEntry__inner--lead">
				{avatar}
				<span className="calEntry__body">{body}</span>
			</span>
		) : (
			<span className="calEntry__inner">{body}</span>
		);
	};

	const backgroundClass = (info: EventDisplayInfo) => {
		const { off, band, consultation } = propsOf(info);
		if (consultation)
			return consultation === 'once'
				? 'calendarView__consultation calendarView__consultation--once'
				: 'calendarView__consultation';
		if (band)
			return allBusy(band)
				? 'calendarView__band calendarView__band--all'
				: 'calendarView__band';
		if (off)
			return off.kind === 'break'
				? 'calendarView__offHours calendarView__offHours--break'
				: 'calendarView__offHours';
		return '';
	};

	const backgroundContent = (info: EventDisplayInfo) => {
		const { off, band, consultation } = propsOf(info);
		if (consultation)
			return (
				<span
					className="calendarView__consultationLabel"
					data-cy="calendar-consultation-band"
				>
					<span className="calendarView__consultationPill">
						<ClockIcon aria-hidden focusable="false" />
						{t(
							consultation === 'once'
								? 'calendar.consultationHours.bandOnce'
								: 'calendar.consultationHours.band'
						)}
					</span>
				</span>
			);
		if (band) {
			const busy = band.busy
				.map((id) => bandPeopleById.get(id))
				.filter((c): c is Colleague => !!c);
			// Fills the band, so hovering or tapping anywhere on it explains
			// who is busy and who is free. Where there is room it also shows
			// who: avatar and name as in the people bar (Frank *16); the
			// stylesheet decides by the band's own size.
			return (
				<span
					className="calendarView__bandFill"
					data-band={bandKey(band)}
					data-selected={
						selectedBand && bandKey(selectedBand) === bandKey(band)
							? 'true'
							: undefined
					}
					data-cy="calendar-band"
				>
					<span className="calendarView__bandLabel">
						{people.length === 1 && busy[0] && (
							<BandAvatar name={busy[0].displayName} />
						)}
						<span className="calendarView__bandText">
							{bandLabel(band)}
						</span>
					</span>
					{people.length > 1 && (
						<span
							className="calendarView__bandPeople"
							data-count={busy.length > 3 ? 'many' : busy.length}
						>
							{busy.map((c) => (
								<span
									key={c.id}
									className="calendarView__bandPerson"
								>
									<BandAvatar name={c.displayName} />
									<span className="calendarView__bandName">
										{c.displayName}
									</span>
								</span>
							))}
						</span>
					)}
				</span>
			);
		}
		// Centred between the two pause grips, a quiet pill with a cup
		// (Frank *7.3), not in the top left corner.
		return off?.kind === 'break' ? (
			<span className="calendarView__breakLabel">
				<span className="calendarView__breakPill">
					<FreeBreakfastOutlinedIcon aria-hidden />
					{t('calendar.workingHours.break')}
				</span>
			</span>
		) : null;
	};

	// The entry's own element knows which entry it shows, so hover, focus
	// and the tooltip need no lookup through FullCalendar.
	/** What a screen reader hears for an entry in the grid. */
	const ariaLabelOf = (entry: CalendarEntry, proposal?: MoveProposal) => {
		const own = entry.ownerId === ownerId && !proposal;
		return [
			proposal
				? `${t('calendar.proposal.label')} · ${proposalStatus(proposal)}`
				: entry.requested
					? `${label(entry, !own)} · ${t('calendar.appointmentRequest.status')}`
					: label(entry, !own),
			own ? '' : colleagues[entry.ownerId]?.displayName,
			entry.allDay
				? t('calendar.allDay')
				: // A proposal stands at the proposed time: say that one.
					format(
						proposal?.start ?? entry.start,
						proposal?.end ?? entry.end
					)
		]
			.filter(Boolean)
			.join(', ');
	};
	const eventDidMount = (info: {
		el: HTMLElement;
		event: { extendedProps: unknown };
	}) => {
		const { entry, proposal } = propsOf(info);
		if (!entry) return;
		info.el.dataset.entryId = entry.id;
		info.el.dataset.owner = entry.ownerId;
		info.el.dataset.facet = facetOf(entry);
		if (proposal) info.el.dataset.proposalId = proposal.id;
		if (!info.el.hasAttribute('tabindex')) info.el.tabIndex = 0;
		info.el.setAttribute('aria-label', ariaLabelOf(entry, proposal));
	};
	// FullCalendar mounts an entry's element once and keeps it when only
	// the time changes: the name follows the time, or a moved or accepted
	// appointment would still be read out at its old time.
	useEffect(() => {
		// By owner too: a co-access appointment is in two calendars.
		const byId = new Map(
			entries.map((entry) => [`${entry.ownerId}/${entry.id}`, entry])
		);
		gridRef.current
			?.querySelectorAll<HTMLElement>('[data-entry-id]')
			.forEach((el) => {
				const proposalId = el.dataset.proposalId;
				const found = proposalId
					? proposals.find((p) => p.proposal.id === proposalId)
					: undefined;
				const entry = proposalId
					? found?.entry
					: byId.get(`${el.dataset.owner}/${el.dataset.entryId}`);
				if (!entry) return;
				const name = ariaLabelOf(entry, found?.proposal);
				if (el.getAttribute('aria-label') !== name)
					el.setAttribute('aria-label', name);
			});
	});

	// Colleague entries and proposals explain themselves on hover and on
	// keyboard focus, at once (Frank: tooltips show immediately).
	const findPeek = (target: EventTarget | null) => {
		const bandEl = (target as HTMLElement | null)?.closest?.<HTMLElement>(
			'[data-band]'
		);
		if (bandEl) {
			const band = bands.find((b) => bandKey(b) === bandEl.dataset.band);
			return band ? { el: bandEl, band } : null;
		}
		const el = (target as HTMLElement | null)?.closest?.<HTMLElement>(
			'[data-entry-id]'
		);
		if (!el) return null;
		const proposalId = el.dataset.proposalId;
		if (proposalId) {
			const found = proposals.find((p) => p.proposal.id === proposalId);
			return found ? { el, ...found } : null;
		}
		const entry = entries.find(
			(e) => e.id === el.dataset.entryId && e.ownerId === el.dataset.owner
		);
		if (!entry || entry.ownerId === ownerId) return null;
		return { el, entry };
	};
	// FullCalendar lays its column frame over background events, so the
	// pointer finds a band by position, not by the element on top.
	const bandAt = (x: number, y: number) => {
		const el = document
			.elementsFromPoint?.(x, y)
			.find((node) => (node as HTMLElement).dataset?.band) as
			| HTMLElement
			| undefined;
		const band = el && bands.find((b) => bandKey(b) === el.dataset.band);
		return el && band ? { el, band } : null;
	};
	const followBand = (event: React.MouseEvent) => {
		const byTarget = findPeek(event.target);
		const next =
			bandAt(event.clientX, event.clientY) ??
			(byTarget && 'band' in byTarget ? byTarget : null);
		if (next)
			setPeek((current) => (current?.el === next.el ? current : next));
		else
			setPeek((current) =>
				current && 'band' in current ? null : current
			);
	};

	const showPeek = (event: React.SyntheticEvent) => {
		// FullCalendar's frame lies over the bands: a pointer over the frame
		// may still be on a band, e.g. once a click's selection shadow is
		// gone and the browser reports the frame (Frank *16.2).
		const pointer =
			event.type === 'mouseover' ? (event as React.MouseEvent) : null;
		const next =
			findPeek(event.target) ??
			(pointer && bands.length > 0
				? bandAt(pointer.clientX, pointer.clientY)
				: null);
		setPeek((current) =>
			current?.el === next?.el ? current : (next ?? null)
		);
	};

	// FullCalendar reports the range after every update; only a real change
	// may reach the page, or React loops.
	const datesSetRef = useRef(onDatesSet);
	datesSetRef.current = onDatesSet;
	const lastRange = useRef('');
	// The title names the days shown, "16.–20. November 2026" for the work
	// week (prototype v17), not FullCalendar's "November 2026".
	const titleLocale = calendarLocale(i18n.language);
	const datesSet = useCallback(
		(info: {
			start: Date;
			end: Date;
			view: {
				type: string;
				title: string;
				currentStart: Date;
				currentEnd: Date;
			};
		}) => {
			const shown = viewOfFcType(info.view.type);
			const title = shown
				? rangeTitleOf(
						shown,
						info.view.currentStart,
						info.view.currentEnd,
						titleLocale
					)
				: info.view.title;
			const key = `${info.start.getTime()}-${info.end.getTime()}-${title}`;
			if (key === lastRange.current) return;
			lastRange.current = key;
			setShownRange({ start: info.start, end: info.end });
			datesSetRef.current?.(title, info.start, info.end);
		},
		[titleLocale]
	);

	// One click opens the actions, two open "Verschieben" straight away.
	const clickTimer = useRef<number | undefined>(undefined);
	useEffect(() => () => window.clearTimeout(clickTimer.current), []);
	const eventClick = (info: EventClickInfo) => {
		const { entry, proposal } = propsOf(info);
		if (!entry) return;
		const el = info.el as HTMLElement;
		const jsEvent = info.jsEvent as MouseEvent;
		window.clearTimeout(clickTimer.current);
		setPeek(null);
		if (proposal) {
			onProposalOpen?.(proposal, el);
			return;
		}
		if (jsEvent?.detail >= 2) {
			onEntryOpen?.(entry, el, 'move');
			return;
		}
		// Keyboard (detail 0) opens at once.
		if (!jsEvent?.detail) {
			onEntryOpen?.(entry, el, 'list');
			return;
		}
		clickTimer.current = window.setTimeout(
			() => onEntryOpen?.(entry, el, 'list'),
			DOUBLE_CLICK_MS
		);
	};

	const select = (info: DateSelectInfo) => {
		const pointer = info.jsEvent as MouseEvent | undefined;
		const anchor = { x: pointer?.clientX ?? 0, y: pointer?.clientY ?? 0 };
		if (info.allDay) {
			const days = Math.max(
				1,
				Math.round((info.end.getTime() - info.start.getTime()) / DAY_MS)
			);
			onSelectDays?.(info.start, days, anchor);
			return;
		}
		// A click on a band explains the band; only dragging over it offers
		// "Eintragen als". The menu would otherwise open at once and, as a
		// modal, keep the pointer from every other band (Frank *16.2).
		const clicked = info.end.getTime() - info.start.getTime() <= SLOT_MS;
		const band =
			clicked && pointer
				? bandAt(pointer.clientX, pointer.clientY)
				: null;
		if (band) {
			info.view.calendar.unselect();
			openBand(band);
			return;
		}
		onSelectRange?.({ start: info.start, end: info.end }, anchor);
	};

	/**
	 * A band was clicked: the page opens its card, or without a page the
	 * tooltip explains it. A mouse click arrives through `select` (the
	 * browser sends no click: FullCalendar swaps the element under the
	 * pointer), a tap through the click handler.
	 */
	const openBand = (found: { el: HTMLElement; band: ColleagueBand }) => {
		if (!onBandOpen) {
			setPeek(found);
			return;
		}
		setPeek(null);
		onBandOpen(found.band, found.el);
	};

	const peekColleague =
		peek && 'entry' in peek ? colleagues[peek.entry.ownerId] : undefined;
	const names = (list: Colleague[]) =>
		list.map((c) => c.displayName).join(', ');
	/**
	 * Who is busy in a band and who is free. The bands count all-day
	 * entries too, so a colleague away all day is never free in one
	 * (reviews 4576346789, 4576368849).
	 */
	const bandPeek = (band: ColleagueBand) => {
		const busy = new Set(band.busy);
		return {
			busy: bandPeople.filter((c) => busy.has(c.id)),
			free: bandPeople.filter((c) => !busy.has(c.id))
		};
	};
	const peekPeople = peek && 'band' in peek ? bandPeek(peek.band) : null;
	// The band whose card is open needs no tooltip on top of it.
	const peekIsCard =
		!!peek &&
		'band' in peek &&
		!!selectedBand &&
		bandKey(peek.band) === bandKey(selectedBand);

	return (
		<div
			ref={gridRef}
			className={`calendarView${compact ? ' calendarView--compact' : ''}`}
			data-testid="calendar-view"
			onMouseOver={showPeek}
			onMouseLeave={() => setPeek(null)}
			onMouseMove={bands.length > 0 ? followBand : undefined}
			// Pointer, not mouse: FullCalendar's drag may cancel the mouse
			// events of a press, never the pointer's.
			onPointerDownCapture={(event) => {
				pressedAt.current = { x: event.clientX, y: event.clientY };
			}}
			// A tap on a band opens it (Frank *16.2); see `openBand`.
			// Dragging over a band books one's own time instead, and an
			// entry, grip or link on top of a band keeps its own click.
			onClick={(event) => {
				const down = pressedAt.current;
				pressedAt.current = null;
				if (
					down &&
					Math.hypot(event.clientX - down.x, event.clientY - down.y) >
						CLICK_SLOP_PX
				)
					return;
				if (
					(event.target as HTMLElement).closest?.(
						'[data-entry-id], .calendarGrip, a, button'
					)
				)
					return;
				const next =
					bandAt(event.clientX, event.clientY) ??
					findPeek(event.target);
				if (next?.band) openBand({ el: next.el, band: next.band });
			}}
			onFocus={showPeek}
			onBlur={() => setPeek(null)}
		>
			{fontsReady && (
				<FullCalendar
					controller={controller}
					plugins={PLUGINS}
					locales={LOCALES}
					locale={fullCalendarLocale(i18n.language)}
					views={FC_CUSTOM_VIEWS}
					initialView={FC_VIEW[view]}
					initialDate={initialDate ?? now}
					now={now}
					headerToolbar={false}
					height="100%"
					firstDay={1}
					nowIndicator
					allDaySlot
					allDayText={t('calendar.allDay')}
					slotMinTime={hours.min}
					slotMaxTime={hours.max}
					// The zoom sets the height; the hour labels must not hold
					// it up (they are taller than the closest-out steps).
					slotMinHeight={slotPx}
					slotHeaderInnerClass="calendarView__slotLabel"
					slotHeaderFormat={SLOT_HEADER_FORMAT}
					dayHeaderFormat={DAY_HEADER_FORMAT}
					dayHeaderInnerClass={dayHeaderInnerClass}
					dayCellClass={dayCellClass}
					dayCellTopInnerClass={dayCellTopInnerClass}
					moreLinkClass="calendarView__more"
					viewClass="calendarView__frame"
					listItemEventBeforeClass={LIST_DOT_CLASS}
					listDayHeaderClass={LIST_DAY_HEADER_CLASS}
					scrollTime="08:00:00"
					dayMaxEvents={3}
					backgroundEventClass={backgroundClass}
					backgroundEventContent={backgroundContent}
					allDayHeaderClass="calendarView__allDayHeader"
					dayCellInnerClass={allDayCellInnerClass}
					selectable={consultant}
					selectMirror
					editable={consultant}
					eventDurationEditable={false}
					events={events}
					eventClass={eventClass}
					eventContent={eventContent}
					eventDidMount={eventDidMount}
					noEventsContent={t('calendar.noEvents')}
					datesSet={datesSet}
					select={select}
					eventClick={eventClick}
					eventDragStart={() => {
						setPeek(null);
						onDragChange?.(true);
					}}
					eventDragStop={() => onDragChange?.(false)}
					eventDrop={(info: EventDropInfo) => {
						const { entry } = propsOf(info);
						if (!entry || !info.event.start || !info.event.end) {
							info.revert();
							return;
						}
						const { start, end } = info.event;
						guardMove(
							entry.id,
							() => onEntryMove?.(entry, start, end),
							info.revert
						);
					}}
				/>
			)}
			{gripsShown &&
				gripColumns.map(({ key, day, el }) => {
					// Only dates whose own hours UserService keeps and
					// shows (review 4577586484).
					if (!dayExceptionAllowed(day, nowDate)) return null;
					const edges = dayEdgesOf(day, workingPlan);
					if (!edges) return null;
					return createPortal(
						gripEdges(edges).map(({ edge, time }) => {
							return (
								<CalendarWorkGrip
									key={edge}
									edge={edge}
									day={day}
									time={time}
									windows={edges.windows}
									exception={edges.exception}
									measure={measure}
									onChange={onEdgeChange}
									style={{
										top: gripTop(
											time,
											firstMinute,
											lastMinute
										)
									}}
								/>
							);
						}),
						el,
						`grip-${key}`
					);
				})}
			<Popper
				open={!!peek && !peekIsCard}
				anchorEl={peek?.el}
				placement="top-start"
				modifiers={[{ name: 'offset', options: { offset: [0, 6] } }]}
				className="calendarPeekPopper"
			>
				{/* Popper's root already is the `role="tooltip"`. */}
				{peek && 'band' in peek && (
					<div
						className="calendarPeek calendarPeek--band calendarPeek--tip"
						data-cy="calendar-band-peek"
					>
						<strong className="calendarPeek__when">
							{format(peek.band.start, peek.band.end)}
						</strong>
						<span>
							{t('calendar.bandBusy', {
								names: names(peekPeople?.busy ?? [])
							})}
						</span>
						{!!peekPeople?.free.length && (
							<span>
								{t('calendar.bandFree', {
									names: names(peekPeople.free)
								})}
							</span>
						)}
						{unavailable.length > 0 && (
							<span>
								{t('calendar.bandUnknown', {
									names: names(unavailable)
								})}
							</span>
						)}
						{loading.length > 0 && (
							<span>
								{t('calendar.bandLoading', {
									names: names(loading)
								})}
							</span>
						)}
						<span className="calendarPeek__hint">
							{t('calendar.bandHint')}
						</span>
					</div>
				)}
				{peek && 'entry' in peek && (
					<CalendarEntryPeek
						variant="tip"
						entry={peek.entry}
						colleague={peekColleague}
						proposal={peek.proposal}
						proposalStatus={
							peek.proposal
								? proposalStatus(peek.proposal)
								: undefined
						}
					/>
				)}
			</Popper>
		</div>
	);
};
