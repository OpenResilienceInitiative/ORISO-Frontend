/**
 * "Nebeneinander": one column per person — the signed-in counsellor first,
 * then every colleague whose calendar is shown (Frank's prototype,
 * 2026-11-14). Columns are at least 210px wide; when they do not fit, they
 * scroll sideways with the shared hover arrows at the edges. Time in which
 * everybody is free (within one's working hours, day exceptions and public
 * holidays included) is marked "alle frei"; it counts every entry, also the
 * kinds the display filter hides. One's own column carries the grips of the
 * working day.
 *
 * - 1 day: one's own column, with the time axis, stays on the left while
 *   the colleagues scroll under it.
 * - 3 days (Frank, 2026-11-14): the columns are grouped by day — a day
 *   header over that day's people, a stronger line between days, "free for
 *   everyone" per day and each day with its own time axis; nothing sticks.
 *
 * FullCalendar has no resource columns in its MIT core, so this grid is our
 * own; it reads the same entries, classes and callbacks as `CalendarView`.
 */
import * as React from 'react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Tooltip } from '@mui/material';
import {
	HoverScrollArrows,
	stepTargetIndex,
	type ScrollDirection
} from '../hoverScrollArrows/HoverScrollArrows';
import type { CalendarEntry, CalendarRole, Colleague } from './calendarModel';
import { CalendarEntryGlyph, facetOf } from './CalendarEntryGlyph';
import type { MoveProposal } from './calendarActions';
import { freeForEveryone } from './calendarFreeTime';
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
import { CalendarEntryPeek, initialsOf } from './CalendarEntryPeek';
import type { CalendarHighlight, MenuAnchor } from './CalendarView';
import { useEntryLabel } from './useEntryLabel';
import { calendarLocale } from './calendarLocale';

/** Shown hours, the same as the time grid's. */
const FIRST_HOUR = 7;
const LAST_HOUR = 21;
const HOUR_PX = 48;
const AXIS_PX = 52;
/** Frank: a column never gets narrower than this. */
export const SPLIT_COLUMN_MIN_PX = 210;
const SNAP_MINUTES = 15;
const DOUBLE_CLICK_MS = 230;

/** "1 Tag | 3 Tage" */
export const SPLIT_DAY_CHOICES = [1, 3] as const;
export type SplitDays = (typeof SPLIT_DAY_CHOICES)[number];

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
const dateKey = (date: Date) =>
	`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
/**
 * Where `date` falls on the clock of `day`, in minutes: below 0 before
 * that day, 24 · 60 or more after it. Wall-clock time, not elapsed time,
 * so 08:30 sits at 08:30 on a 23- or 25-hour day too.
 */
const clockMinutes = (day: Date, date: Date) => {
	const days = Math.round(
		(startOfDay(date).getTime() - day.getTime()) / 86_400_000
	);
	return (
		days * 24 * 60 +
		date.getHours() * 60 +
		date.getMinutes() +
		Math.round(date.getSeconds() / 60)
	);
};
/** The local time `minutes` past the start of `day`. */
const atClock = (day: Date, minutes: number) => {
	const date = new Date(day);
	date.setHours(0, minutes, 0, 0);
	return date;
};
const toPx = (minutes: number) => ((minutes - FIRST_HOUR * 60) / 60) * HOUR_PX;
const clampMinutes = (m: number) =>
	Math.min(LAST_HOUR * 60, Math.max(FIRST_HOUR * 60, m));

/**
 * Where a step of the side arrows can land. One day: each colleague
 * column's left edge, measured from the right edge of one's own sticky
 * column. Several days: every column's left edge (nothing sticks).
 */
export const splitColumnTargets = (track: HTMLElement) => {
	const max = Math.max(0, track.scrollWidth - track.clientWidth);
	const clamp = (x: number) => Math.min(max, Math.max(0, Math.round(x)));
	const grouped = track.querySelector(':scope > .calendarSplit__group');
	let targets: number[];
	if (grouped) {
		const origin =
			track.getBoundingClientRect().left +
			track.clientLeft -
			track.scrollLeft;
		targets = Array.from(
			track.querySelectorAll<HTMLElement>('.calendarSplit__column')
		).map((c) => clamp(c.getBoundingClientRect().left - origin));
	} else {
		const columns = Array.from(track.children) as HTMLElement[];
		const own = columns[0]?.offsetWidth ?? 0;
		targets = columns.slice(1).map((c) => clamp(c.offsetLeft - own));
	}
	return Array.from(new Set([0, ...targets, max])).sort((a, b) => a - b);
};

/** Side-by-side lanes for entries that overlap within one column. */
const layoutLanes = (entries: CalendarEntry[]) => {
	const sorted = [...entries].sort(
		(a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
	);
	const laneEnds: number[] = [];
	const lane = new Map<string, number>();
	for (const e of sorted) {
		const start = new Date(e.start).getTime();
		let index = laneEnds.findIndex((end) => end <= start);
		if (index === -1) index = laneEnds.push(0) - 1;
		laneEnds[index] = new Date(e.end).getTime();
		lane.set(e.id, index);
	}
	return { lane, lanes: Math.max(1, laneEnds.length) };
};

export interface SplitPerson {
	id: string;
	/** Colleagues only; one's own column has none. */
	colleague?: Colleague;
}

export interface CalendarSplitViewProps {
	/** The first day shown. */
	day: Date;
	/** How many days side by side; 1 keeps one's own column sticky. */
	days?: SplitDays;
	role: CalendarRole;
	ownerId: string;
	/** Colleagues whose calendars are shown, in that order. */
	colleagues: Colleague[];
	/** Every visible entry (own and colleagues'), already filtered. */
	entries: CalendarEntry[];
	/**
	 * Every entry of the people shown, unfiltered: "alle frei" must not
	 * count a hidden kind as free. Defaults to `entries`.
	 */
	busyEntries?: CalendarEntry[];
	now: Date;
	/** Weekly hours, day exceptions and the holiday region. */
	workingPlan?: WorkingPlan;
	/** A grip in one's own column was moved; without it none is drawn. */
	onEdgeChange?: (
		change: EdgeChange,
		anchor: { x: number; y: number }
	) => void;
	proposals?: { proposal: MoveProposal; entry: CalendarEntry }[];
	highlight?: CalendarHighlight | null;
	muted?: string[];
	onSelectRange?: (
		range: { start: Date; end: Date },
		anchor: { x: number; y: number }
	) => void;
	onEntryOpen?: (
		entry: CalendarEntry,
		anchor: MenuAnchor,
		mode: 'list' | 'move'
	) => void;
	onProposalOpen?: (proposal: MoveProposal, anchor: MenuAnchor) => void;
}

/** One day of the grid, with what it shows. */
interface SplitDay {
	day: Date;
	end: Date;
	key: string;
	entries: CalendarEntry[];
	free: { start: Date; end: Date }[];
	offHours: { from: number; to: number; kind: 'off' | 'break' }[];
	holiday?: PublicHoliday;
}

/** One's own body column, for dragging a grip. */
const measureBody = (grip: HTMLElement): GripGeometry | null => {
	const body = grip.closest<HTMLElement>('.calendarSplit__body');
	if (!body) return null;
	const rect = body.getBoundingClientRect();
	return {
		top: rect.top,
		left: rect.left,
		width: rect.width,
		height: rect.height,
		firstMinute: FIRST_HOUR * 60,
		lastMinute: LAST_HOUR * 60
	};
};

export const CalendarSplitView = ({
	day: dayInput,
	days = 1,
	role,
	ownerId,
	colleagues,
	entries,
	busyEntries,
	now,
	workingPlan,
	onEdgeChange,
	proposals = [],
	highlight,
	muted = [],
	onSelectRange,
	onEntryOpen,
	onProposalOpen
}: CalendarSplitViewProps) => {
	const { t, i18n } = useTranslation();
	const label = useEntryLabel();
	const locale = calendarLocale(i18n.language);
	const first = useMemo(() => startOfDay(dayInput), [dayInput]);
	const grouped = days > 1;
	const scrollRef = useRef<HTMLDivElement>(null);
	const [ownWidth, setOwnWidth] = useState(AXIS_PX + SPLIT_COLUMN_MIN_PX);
	const [selection, setSelection] = useState<{
		day: number;
		from: number;
		to: number;
	} | null>(null);
	const clickTimer = useRef<number | undefined>(undefined);
	useEffect(() => () => window.clearTimeout(clickTimer.current), []);

	// All-day entries make a column's head taller. Every head takes the
	// height of the tallest, so the timed bodies start at the same offset
	// and 10:00 is level across columns (review 4574775727).
	const evenHeads = useRef(() => {
		const track = scrollRef.current;
		if (!track) return;
		const heads = Array.from(
			track.querySelectorAll<HTMLElement>('.calendarSplit__head')
		);
		heads.forEach((head) => {
			head.style.minHeight = '';
		});
		const tallest = Math.max(0, ...heads.map((head) => head.offsetHeight));
		if (tallest > 0)
			heads.forEach((head) => {
				head.style.minHeight = `${tallest}px`;
			});
	});
	useLayoutEffect(() => evenHeads.current());
	useEffect(() => {
		const track = scrollRef.current;
		if (!track || typeof ResizeObserver === 'undefined') return undefined;
		// Narrower columns wrap their heads onto more lines.
		const observer = new ResizeObserver(() => evenHeads.current());
		observer.observe(track);
		return () => observer.disconnect();
	}, []);

	const people: SplitPerson[] = [
		{ id: ownerId },
		...colleagues.map((c) => ({ id: c.id, colleague: c }))
	];
	const shownDays: SplitDay[] = useMemo(
		() =>
			Array.from({ length: days }, (_, i) => {
				const day = addDays(first, i);
				const end = addDays(day, 1);
				const plan = workingPlan ?? { hours: [] };
				const offHours = offRangesOf(day, plan)
					.map((r) => ({
						from: clampMinutes(r.from),
						to: clampMinutes(r.to),
						kind: r.kind
					}))
					.filter((r) => r.to > r.from);
				return {
					day,
					end,
					key: dateKey(day),
					entries: entries.filter(
						(e) => new Date(e.start) < end && new Date(e.end) > day
					),
					free: freeForEveryone({
						entries: busyEntries ?? entries,
						people: [ownerId, ...colleagues.map((c) => c.id)],
						day,
						hours: plan,
						now
					}),
					offHours,
					holiday: effectiveDay(day, plan).holiday
				};
			}),
		[
			first,
			days,
			entries,
			busyEntries,
			ownerId,
			colleagues,
			workingPlan,
			now
		]
	);
	const overlaps = (d: SplitDay, e: { start: string; end: string }) =>
		new Date(e.start) < d.end && new Date(e.end) > d.day;

	useEffect(() => {
		const own = scrollRef.current?.firstElementChild as HTMLElement | null;
		if (!own || typeof ResizeObserver === 'undefined') return undefined;
		let frame = 0;
		const observer = new ResizeObserver(() => {
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(() => setOwnWidth(own.offsetWidth));
		});
		observer.observe(own);
		return () => {
			cancelAnimationFrame(frame);
			observer.disconnect();
		};
	}, [grouped]);

	// Start the day at 08:00, like the time grid.
	useEffect(() => {
		scrollRef.current?.scrollTo({ top: HOUR_PX });
	}, []);

	const step = (direction: ScrollDirection) => {
		const track = scrollRef.current;
		if (!track) return;
		const targets = splitColumnTargets(track);
		const index = stepTargetIndex(targets, track.scrollLeft, direction);
		if (index !== null)
			track.scrollTo({ left: targets[index], behavior: 'smooth' });
	};

	const open = (
		event: React.MouseEvent<HTMLElement>,
		entry: CalendarEntry,
		proposal?: MoveProposal
	) => {
		event.stopPropagation();
		const el = event.currentTarget;
		window.clearTimeout(clickTimer.current);
		if (proposal) {
			onProposalOpen?.(proposal, el);
			return;
		}
		if (event.detail >= 2) onEntryOpen?.(entry, el, 'move');
		else if (event.detail === 0) onEntryOpen?.(entry, el, 'list');
		else
			clickTimer.current = window.setTimeout(
				() => onEntryOpen?.(entry, el, 'list'),
				DOUBLE_CLICK_MS
			);
	};

	const minuteAt = (event: React.PointerEvent<HTMLElement>) => {
		const bounds = event.currentTarget.getBoundingClientRect();
		const minutes =
			FIRST_HOUR * 60 + ((event.clientY - bounds.top) / HOUR_PX) * 60;
		return clampMinutes(Math.floor(minutes / SNAP_MINUTES) * SNAP_MINUTES);
	};

	const selectable = role === 'consultant' && !!onSelectRange;
	/** Dragging over free time in one's own column of that day. */
	const ownBodyEvents = (day: Date) =>
		selectable
			? {
					onPointerDown: (event: React.PointerEvent<HTMLElement>) => {
						if (event.button !== 0) return;
						if ((event.target as HTMLElement).closest('.calEntry'))
							return;
						event.currentTarget.setPointerCapture?.(
							event.pointerId
						);
						const at = minuteAt(event);
						setSelection({ day: day.getTime(), from: at, to: at });
					},
					onPointerMove: (event: React.PointerEvent<HTMLElement>) => {
						if (!selection) return;
						const at = minuteAt(event);
						setSelection((s) => (s ? { ...s, to: at } : s));
					},
					onPointerUp: (event: React.PointerEvent<HTMLElement>) => {
						if (!selection) return;
						const a = Math.min(selection.from, selection.to);
						let b = Math.max(selection.from, selection.to);
						if (b - a < SNAP_MINUTES) b = a + 60;
						else b += SNAP_MINUTES;
						const selected = new Date(selection.day);
						const start = atClock(selected, a);
						const end = atClock(selected, b);
						onSelectRange?.(
							{ start, end },
							{ x: event.clientX, y: event.clientY }
						);
						setSelection(null);
					},
					onPointerCancel: () => setSelection(null)
				}
			: {};

	const renderEntry = (
		day: Date,
		entry: CalendarEntry,
		lane: number,
		lanes: number,
		proposal?: MoveProposal
	) => {
		const from = clampMinutes(
			Math.max(
				0,
				clockMinutes(day, new Date(proposal?.start ?? entry.start))
			)
		);
		const to = clampMinutes(
			Math.min(
				24 * 60,
				clockMinutes(day, new Date(proposal?.end ?? entry.end))
			)
		);
		if (to <= from) return null;
		const colleague = entry.ownerId !== ownerId;
		const facet = facetOf(entry);
		const dimmed =
			(highlight?.owner && highlight.owner !== entry.ownerId) ||
			(highlight?.facet && highlight.facet !== facet);
		const className = [
			'calEntry',
			'calendarSplit__entry',
			`calEntry--${entry.type}`,
			`calEntry--k-${facet}`,
			colleague && 'calEntry--colleague',
			proposal && 'calEntry--proposal',
			dimmed && 'calEntry--dimmed',
			muted.includes(entry.ownerId) && 'calEntry--muted'
		]
			.filter(Boolean)
			.join(' ');
		const timeText = `${new Intl.DateTimeFormat(locale, {
			hour: '2-digit',
			minute: '2-digit'
		}).format(new Date(proposal?.start ?? entry.start))}`;
		const button = (
			<button
				key={proposal ? `p-${proposal.id}` : entry.id}
				type="button"
				className={className}
				style={{
					top: toPx(from),
					height: Math.max(18, toPx(to) - toPx(from) - 2),
					left: `calc(${(lane / lanes) * 100}% + 2px)`,
					width: `calc(${100 / lanes}% - 4px)`
				}}
				onClick={(event) => open(event, entry, proposal)}
				data-entry-id={entry.id}
				data-cy={`calendar-split-entry-${entry.id}`}
			>
				<span className="calEntry__inner">
					<span className="calEntry__icon">
						<CalendarEntryGlyph
							entry={entry}
							colleague={colleague}
						/>
					</span>
					<span className="calEntry__text">
						<span className="calEntry__time">{timeText}</span>
						<span className="calEntry__title">
							{proposal
								? `${t('calendar.proposal.label')} · ${t('calendar.proposal.waiting')}`
								: label(entry, colleague)}
						</span>
					</span>
				</span>
			</button>
		);
		if (!colleague && !proposal) return button;
		return (
			<Tooltip
				key={proposal ? `p-${proposal.id}` : entry.id}
				enterDelay={0}
				enterNextDelay={0}
				placement="top-start"
				slotProps={{ tooltip: { className: 'calendarPeekTooltip' } }}
				title={
					<CalendarEntryPeek
						entry={entry}
						proposal={proposal}
						colleague={colleagues.find(
							(c) => c.id === entry.ownerId
						)}
					/>
				}
			>
				{button}
			</Tooltip>
		);
	};

	const hours = Array.from(
		{ length: LAST_HOUR - FIRST_HOUR },
		(_, i) => FIRST_HOUR + i
	);
	const hourFormat = new Intl.DateTimeFormat(locale, {
		hour: '2-digit',
		minute: '2-digit'
	});
	const today = startOfDay(now).getTime();
	const dayHeadFormat = new Intl.DateTimeFormat(locale, {
		weekday: 'short',
		day: '2-digit',
		month: '2-digit'
	});

	/** The grips of one's own working day, where they fall in the grid. */
	const edgeGrips = (d: SplitDay) => {
		const edges = workingPlan ? dayEdgesOf(d.day, workingPlan) : null;
		if (!edges || !onEdgeChange) return null;
		return (['start', 'end'] as const).map((edge) => {
			const time = edge === 'start' ? edges.start : edges.end;
			const minutes = minutesOf(time);
			if (minutes < FIRST_HOUR * 60 || minutes > LAST_HOUR * 60)
				return null;
			return (
				<CalendarWorkGrip
					key={edge}
					edge={edge}
					day={d.day}
					time={time}
					windows={edges.windows}
					exception={edges.exception}
					measure={measureBody}
					onChange={onEdgeChange}
					style={{ top: toPx(minutes) }}
				/>
			);
		});
	};

	const column = (person: SplitPerson, index: number, d: SplitDay) => {
		const { day } = d;
		const own = index === 0;
		const sticky = own && !grouped;
		const isToday = today === day.getTime();
		const nowMinutes = clockMinutes(day, now);
		const mine = d.entries.filter((e) => e.ownerId === person.id);
		const timed = mine.filter((e) => !e.allDay);
		const allDay = mine.filter((e) => e.allDay);
		const ownProposals = proposals.filter(
			(p) => p.entry.ownerId === person.id && overlaps(d, p.proposal)
		);
		const { lane, lanes } = layoutLanes([
			...timed,
			...ownProposals.map((p) => ({
				...p.entry,
				id: `p-${p.proposal.id}`,
				start: p.proposal.start,
				end: p.proposal.end
			}))
		]);
		const name = person.colleague?.displayName ?? t('calendar.people.me');
		return (
			<div
				key={person.id}
				className={[
					'calendarSplit__column',
					own && 'calendarSplit__column--own',
					sticky && 'calendarSplit__column--sticky'
				]
					.filter(Boolean)
					.join(' ')}
				style={{
					minWidth: (own ? AXIS_PX : 0) + SPLIT_COLUMN_MIN_PX
				}}
				data-day={d.key}
				data-cy={
					grouped
						? `calendar-split-column-${person.id}-${d.key}`
						: `calendar-split-column-${person.id}`
				}
			>
				<div className="calendarSplit__head">
					{own && <span className="calendarSplit__axisHead" />}
					<div className="calendarSplit__person">
						<span
							className={`calendarSplit__avatar${own ? ' calendarSplit__avatar--me' : ''}`}
							aria-hidden="true"
						>
							{own ? t('calendar.people.me') : initialsOf(name)}
						</span>
						<span className="calendarSplit__name">{name}</span>
						{person.colleague?.agencyShort && (
							<span
								className="calendarSplit__agency"
								title={person.colleague.agencyName}
							>
								{person.colleague.agencyShort}
							</span>
						)}
					</div>
					{own && d.holiday && (
						<div className="calendarSplit__holiday">
							{t('calendar.holidays.label', {
								name: t(
									`calendar.holidays.names.${d.holiday.key}`,
									{
										defaultValue: d.holiday.name
									}
								)
							})}
						</div>
					)}
					{allDay.length > 0 && (
						<div className="calendarSplit__allDay">
							{allDay.map((e) => (
								<button
									key={e.id}
									type="button"
									className={`calEntry calEntry--${e.type} calEntry--k-${facetOf(e)}${own ? '' : ' calEntry--colleague'}`}
									onClick={(event) => open(event, e)}
								>
									<span className="calEntry__inner">
										<span className="calEntry__title">
											{label(e, !own)} ·{' '}
											{t('calendar.allDay')}
										</span>
									</span>
								</button>
							))}
						</div>
					)}
				</div>
				<div className="calendarSplit__bodyRow">
					{own && (
						<div className="calendarSplit__axis" aria-hidden="true">
							{hours.map((h) => (
								<span
									key={h}
									className="calendarSplit__hour"
									style={{ top: (h - FIRST_HOUR) * HOUR_PX }}
								>
									{hourFormat.format(atClock(day, h * 60))}
								</span>
							))}
						</div>
					)}
					<div
						className="calendarSplit__body"
						style={{ height: (LAST_HOUR - FIRST_HOUR) * HOUR_PX }}
						{...(own ? ownBodyEvents(day) : {})}
					>
						{hours.map((h) => (
							<span
								key={h}
								className="calendarSplit__line"
								style={{ top: (h - FIRST_HOUR) * HOUR_PX }}
							/>
						))}
						{d.offHours.map((o) => (
							<span
								key={`off-${o.from}`}
								className={`calendarSplit__offHours${o.kind === 'break' ? ' calendarSplit__offHours--break' : ''}`}
								style={{
									top: toPx(o.from),
									height: toPx(o.to) - toPx(o.from)
								}}
							/>
						))}
						{own && onEdgeChange && edgeGrips(d)}
						{d.free.map((f) => {
							const from = clampMinutes(
								clockMinutes(day, f.start)
							);
							const to = clampMinutes(clockMinutes(day, f.end));
							if (to <= from) return null;
							return (
								<span
									key={`free-${f.start.getTime()}`}
									className="calendarSplit__free"
									style={{
										top: toPx(from),
										height: toPx(to) - toPx(from)
									}}
								>
									{own && to - from >= 30 && (
										<span className="calendarSplit__freeLabel">
											{t('calendar.split.free')}
										</span>
									)}
								</span>
							);
						})}
						{selection &&
							own &&
							selection.day === day.getTime() && (
								<span
									className="calendarSplit__selection"
									style={{
										top: toPx(
											Math.min(
												selection.from,
												selection.to
											)
										),
										height:
											(Math.abs(
												selection.to - selection.from
											) /
												60) *
												HOUR_PX +
											(HOUR_PX * SNAP_MINUTES) / 60
									}}
								/>
							)}
						{isToday &&
							nowMinutes >= FIRST_HOUR * 60 &&
							nowMinutes <= LAST_HOUR * 60 && (
								<span
									className="calendarSplit__now"
									style={{ top: toPx(nowMinutes) }}
								/>
							)}
						{timed.map((e) =>
							renderEntry(day, e, lane.get(e.id) ?? 0, lanes)
						)}
						{ownProposals.map((p) =>
							renderEntry(
								day,
								p.entry,
								lane.get(`p-${p.proposal.id}`) ?? 0,
								lanes,
								p.proposal
							)
						)}
					</div>
				</div>
			</div>
		);
	};

	return (
		<div className="calendarSplit" data-testid="calendar-split-view">
			<HoverScrollArrows
				targetRef={scrollRef}
				targets={splitColumnTargets}
				onStep={step}
				startInset={grouped ? 0 : ownWidth}
				edgeZone={96}
				data-cy="calendar-split-arrows"
				sx={{ flex: 1, minHeight: 0 }}
			>
				<div
					ref={scrollRef}
					className={`calendarSplit__scroll${grouped ? ' calendarSplit__scroll--days' : ''}`}
					role="group"
					aria-label={t('calendar.split.label')}
				>
					{grouped
						? shownDays.map((d) => {
								const head = dayHeadFormat.format(d.day);
								return (
									<section
										key={d.key}
										className={`calendarSplit__group${today === d.day.getTime() ? ' calendarSplit__group--today' : ''}`}
										aria-label={head}
										data-cy={`calendar-split-day-${d.key}`}
									>
										<div className="calendarSplit__groupHead">
											{head}
										</div>
										<div className="calendarSplit__groupColumns">
											{people.map((p, i) =>
												column(p, i, d)
											)}
										</div>
									</section>
								);
							})
						: people.map((p, i) => column(p, i, shownDays[0]))}
				</div>
			</HoverScrollArrows>
			{colleagues.length === 0 && (
				<p className="calendarSplit__empty">
					{t('calendar.split.empty')}
				</p>
			)}
		</div>
	);
};
