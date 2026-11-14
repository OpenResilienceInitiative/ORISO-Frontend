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
import enGbLocale from '@fullcalendar/react/locales/en-gb';
import frLocale from '@fullcalendar/react/locales/fr';
import ruLocale from '@fullcalendar/react/locales/ru';
import trLocale from '@fullcalendar/react/locales/tr';
import '@fullcalendar/react/skeleton.css';
import '@fullcalendar/react/themes/classic/theme.css';
import './fullCalendarGuards';
import {
	isMovable,
	isSoon,
	settleMove,
	visibleHours,
	type CalendarEntry,
	type CalendarRole,
	type Colleague,
	type MoveResult
} from './calendarModel';
import { CalendarEntryGlyph, facetOf } from './CalendarEntryGlyph';
import type { MoveProposal } from './calendarActions';
import {
	dayEdgesOf,
	effectiveDay,
	minutesOf,
	offRangesOf,
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
	type CalendarViewName
} from './calendarViews';
import { useEntryLabel, useRangeFormat } from './useEntryLabel';
import { CalendarEntryPeek, initialsOf } from './CalendarEntryPeek';
import { fullCalendarLocale } from './calendarLocale';
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
	/** Colleagues by id, for names, initials and the tooltip. */
	colleagues?: Record<string, Colleague>;
	compact?: boolean;
	/** Fixed "now" for Storybook and tests. */
	now?: Date;
	/** The day the grid opens on (it remounts after the split view). */
	initialDate?: Date;
	/** Weekly hours, day exceptions and the holiday region. */
	workingPlan?: WorkingPlan;
	/**
	 * A grip on the edge of one's own working day was moved; without it the
	 * grips are not drawn.
	 */
	onEdgeChange?: (
		change: EdgeChange,
		anchor: { x: number; y: number }
	) => void;
	/** Pending move proposals, drawn dashed at the proposed time. */
	proposals?: { proposal: MoveProposal; entry: CalendarEntry }[];
	highlight?: CalendarHighlight | null;
	/** Owners whose entries are faded out (people bar). */
	muted?: string[];
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
}

/** The usual working day the time grid shows, before any widening. */
const DAY_FROM = 7 * 60;
const DAY_TO = 21 * 60;

/**
 * Earliest start and latest end of the working plan, on the full hour:
 * the grid widens to them, so a grip always sits at its own time and
 * never at a cut-off edge of the grid (review 4574981882).
 */
const planBounds = (plan?: WorkingPlan) => {
	const windows = [
		...(plan?.hours ?? []),
		...Object.values(plan?.exceptions ?? {}).flat()
	];
	return windows.reduce(
		(bounds, w) => ({
			from: Math.min(bounds.from, Math.floor(minutesOf(w.start) / 60) * 60),
			to: Math.max(bounds.to, Math.ceil(minutesOf(w.end) / 60) * 60)
		}),
		{ from: DAY_FROM, to: DAY_TO }
	);
};
/** "HH:MM:00" as minutes since midnight; "24:00:00" is 1440. */
const slotMinutes = (slot: string) => minutesOf(slot.slice(0, 5));
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

const DAY_MS = 86_400_000;

export const CalendarView = ({
	controller,
	view,
	role,
	ownerId,
	entries,
	colleagues = {},
	compact = false,
	now,
	initialDate,
	workingPlan,
	onEdgeChange,
	proposals = [],
	highlight,
	muted = [],
	onSelectRange,
	onSelectDays,
	onEntryOpen,
	onProposalOpen,
	onEntryMove,
	onDatesSet,
	onDragChange
}: CalendarViewProps) => {
	const { t, i18n } = useTranslation();
	const label = useEntryLabel();
	const format = useRangeFormat();
	const nowDate = now ?? new Date();
	const consultant = role === 'consultant';
	const gridRef = useRef<HTMLDivElement>(null);
	const fontsReady = useFontsReady();
	const [peek, setPeek] = useState<{
		el: HTMLElement;
		entry: CalendarEntry;
		proposal?: MoveProposal;
	} | null>(null);

	// The days FullCalendar shows, for the off-time of each date.
	const [shownRange, setShownRange] = useState<{
		start: Date;
		end: Date;
	} | null>(null);
	const timeGrid = TIME_GRID_VIEWS.includes(view);
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

	// The usual working day, widened so no entry and no grip falls outside
	// the grid.
	const hours = useMemo(() => {
		const bounds = planBounds(workingPlan);
		return visibleHours(entries, bounds.from, bounds.to);
	}, [entries, workingPlan]);
	const firstMinute = slotMinutes(hours.min);
	const lastMinute = slotMinutes(hours.max);
	const measure = useMemo(
		() => measureColumn(firstMinute, lastMinute),
		[firstMinute, lastMinute]
	);

	const events = useMemo<EventInput[]>(
		() => [
			...entries.map((entry) => ({
				id: entry.id,
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
			...offEvents
		],
		[entries, proposals, ownerId, role, label, t, offEvents]
	);

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
				proposal && 'calEntry--proposal',
				!colleague &&
					!proposal &&
					entry.type === 'appointment' &&
					isSoon(entry, nowDate) &&
					'calEntry--soon',
				dimmed && 'calEntry--dimmed',
				muted.includes(entry.ownerId) && 'calEntry--muted'
			]
				.filter(Boolean)
				.join(' ');
		},
		// nowDate is fixed in stories; in the app a re-render refreshes it.
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[ownerId, highlight?.owner, highlight?.facet, muted]
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
		const timeGrid = info.view.type.startsWith('timeGrid');
		return (
			<span className="calEntry__inner">
				{owner && (
					<span className="calEntry__initials" aria-hidden="true">
						{initialsOf(owner.displayName)}
					</span>
				)}
				{!owner &&
					!proposal &&
					entry.type === 'appointment' &&
					entry.title && (
						<span
							className="calEntry__initials calEntry__initials--asker"
							aria-hidden="true"
						>
							{initialsOf(entry.title)}
						</span>
					)}
				<span className="calEntry__icon">
					<CalendarEntryGlyph entry={entry} colleague={colleague} />
				</span>
				<span className="calEntry__text">
					{info.timeText && !timeGrid && (
						<span className="calEntry__time">{info.timeText}</span>
					)}
					<span className="calEntry__title">
						{proposal ? (
							<>
								{t('calendar.proposal.label')}
								<span className="calEntry__waiting">
									{' · '}
									{t('calendar.proposal.waiting')}
								</span>
							</>
						) : (
							<>
								{owner ? `${owner.displayName} · ` : ''}
								{info.event.title}
							</>
						)}
					</span>
				</span>
			</span>
		);
	};

	const backgroundClass = (info: EventDisplayInfo) => {
		const { off } = propsOf(info);
		if (off)
			return off.kind === 'break'
				? 'calendarView__offHours calendarView__offHours--break'
				: 'calendarView__offHours';
		return '';
	};

	const backgroundContent = (info: EventDisplayInfo) =>
		propsOf(info).off?.kind === 'break' ? (
			<span className="calendarView__breakLabel">
				{t('calendar.workingHours.break')}
			</span>
		) : null;

	// The entry's own element knows which entry it shows, so hover, focus
	// and the tooltip need no lookup through FullCalendar.
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
		const own = entry.ownerId === ownerId && !proposal;
		info.el.setAttribute(
			'aria-label',
			[
				proposal
					? `${t('calendar.proposal.label')} · ${t('calendar.proposal.waiting')}`
					: label(entry, !own),
				own ? '' : colleagues[entry.ownerId]?.displayName,
				entry.allDay
					? t('calendar.allDay')
					: format(entry.start, entry.end)
			]
				.filter(Boolean)
				.join(', ')
		);
	};

	// Colleague entries and proposals explain themselves on hover and on
	// keyboard focus, at once (Frank: tooltips show immediately).
	const findPeek = (target: EventTarget | null) => {
		const el = (target as HTMLElement | null)?.closest?.<HTMLElement>(
			'[data-entry-id]'
		);
		if (!el) return null;
		const proposalId = el.dataset.proposalId;
		if (proposalId) {
			const found = proposals.find((p) => p.proposal.id === proposalId);
			return found ? { el, ...found } : null;
		}
		const entry = entries.find((e) => e.id === el.dataset.entryId);
		if (!entry || entry.ownerId === ownerId) return null;
		return { el, entry };
	};
	const showPeek = (event: React.SyntheticEvent) => {
		const next = findPeek(event.target);
		setPeek((current) =>
			current?.el === next?.el ? current : (next ?? null)
		);
	};

	// FullCalendar reports the range after every update; only a real change
	// may reach the page, or React loops.
	const datesSetRef = useRef(onDatesSet);
	datesSetRef.current = onDatesSet;
	const lastRange = useRef('');
	const datesSet = useCallback(
		(info: { start: Date; end: Date; view: { title: string } }) => {
			const key = `${info.start.getTime()}-${info.end.getTime()}-${info.view.title}`;
			if (key === lastRange.current) return;
			lastRange.current = key;
			setShownRange({ start: info.start, end: info.end });
			datesSetRef.current?.(info.view.title, info.start, info.end);
		},
		[]
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
		onSelectRange?.({ start: info.start, end: info.end }, anchor);
	};

	const peekColleague = peek ? colleagues[peek.entry.ownerId] : undefined;

	return (
		<div
			ref={gridRef}
			className={`calendarView${compact ? ' calendarView--compact' : ''}`}
			data-testid="calendar-view"
			onMouseOver={showPeek}
			onMouseLeave={() => setPeek(null)}
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
						settleMove(
							onEntryMove?.(entry, info.event.start, info.event.end),
							info.revert
						);
					}}
				/>
			)}
			{gripsShown &&
				gripColumns.map(({ key, day, el }) => {
					const edges = dayEdgesOf(day, workingPlan);
					if (!edges) return null;
					return createPortal(
						(['start', 'end'] as const).map((edge) => {
							const time =
								edge === 'start' ? edges.start : edges.end;
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
										top: gripTop(time, firstMinute, lastMinute)
									}}
								/>
							);
						}),
						el,
						`grip-${key}`
					);
				})}
			<Popper
				open={!!peek}
				anchorEl={peek?.el}
				placement="top-start"
				modifiers={[{ name: 'offset', options: { offset: [0, 6] } }]}
				className="calendarPeekPopper"
			>
				{/* Popper's root already is the `role="tooltip"`. */}
				{peek && (
					<CalendarEntryPeek
						entry={peek.entry}
						colleague={peekColleague}
						proposal={peek.proposal}
					/>
				)}
			</Popper>
		</div>
	);
};
