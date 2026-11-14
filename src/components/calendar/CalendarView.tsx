/**
 * The calendar grid (ADR-032 §1–§2): FullCalendar's MIT core, ORISO tokens,
 * our own toolbar. Day, week, month and list for counsellors; phones get
 * list, day and month. All data comes in through props — the view never
 * fetches.
 */
import * as React from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import FullCalendar, {
	useCalendarController,
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
import enGbLocale from '@fullcalendar/react/locales/en-gb';
import frLocale from '@fullcalendar/react/locales/fr';
import ruLocale from '@fullcalendar/react/locales/ru';
import trLocale from '@fullcalendar/react/locales/tr';
import { IconButton } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import '@fullcalendar/react/skeleton.css';
import '@fullcalendar/react/themes/classic/theme.css';
import { ButtonGroup } from '../buttonGroup/ButtonGroup';
import {
	isMovable,
	isSoon,
	settleMove,
	visibleHours,
	type CalendarEntry,
	type CalendarRole,
	type MoveResult
} from './calendarModel';
import { CalendarEntryGlyph } from './CalendarEntryGlyph';
import { useEntryLabel } from './useEntryLabel';
import { fullCalendarLocale } from './calendarLocale';
import './calendar.styles.scss';

export type CalendarViewName = 'day' | 'week' | 'month' | 'list';

// Module constants: new arrays per render make FullCalendar reset its view.
const PLUGINS = [
	classicTheme,
	dayGridPlugin,
	timeGridPlugin,
	listPlugin,
	interactionPlugin
];
const LOCALES = [deLocale, enGbLocale, frLocale, ruLocale, trLocale];

const FC_VIEW: Record<CalendarViewName, string> = {
	day: 'timeGridDay',
	week: 'timeGridWeek',
	month: 'dayGridMonth',
	list: 'listWeek'
};

export interface CalendarViewProps {
	role: CalendarRole;
	/** Signed-in counsellor or advice seeker. */
	ownerId: string;
	/** Own entries plus colleagues' entries, already redacted. */
	entries: CalendarEntry[];
	/** Display names of colleagues whose entries are included. */
	colleagueNames?: Record<string, string>;
	compact?: boolean;
	initialView?: CalendarViewName;
	/** Fixed "now" for Storybook and tests. */
	now?: Date;
	/** A free range was selected (counsellors only). */
	onSelectRange?: (
		range: { start: Date; end: Date },
		anchor: { x: number; y: number }
	) => void;
	onEntryClick?: (entry: CalendarEntry) => void;
	/**
	 * An own entry was dragged. Return false, or a promise that rejects or
	 * resolves to false, to put it back.
	 */
	onEntryMove?: (entry: CalendarEntry, start: Date, end: Date) => MoveResult;
	/** Extra controls on the right of the toolbar (filters, sync …). */
	toolbarEnd?: React.ReactNode;
	/** The visible range changed (first render, paging, view switch). */
	onRangeChange?: (start: Date, end: Date) => void;
}

export const CalendarView = ({
	role,
	ownerId,
	entries,
	colleagueNames = {},
	compact = false,
	initialView,
	now,
	onSelectRange,
	onEntryClick,
	onEntryMove,
	toolbarEnd,
	onRangeChange
}: CalendarViewProps) => {
	const { t, i18n } = useTranslation();
	const label = useEntryLabel();
	const [title, setTitle] = useState('');
	const views: CalendarViewName[] = compact
		? ['list', 'day', 'month']
		: ['day', 'week', 'month', 'list'];
	const [view, setView] = useState<CalendarViewName>(
		initialView ?? (compact ? 'list' : 'week')
	);
	const controller = useCalendarController();
	const nowDate = now ?? new Date();
	const consultant = role === 'consultant';

	// The usual working day, widened so no entry falls outside the grid.
	const hours = useMemo(() => visibleHours(entries), [entries]);

	const events = useMemo<EventInput[]>(
		() =>
			entries.map((entry) => ({
				id: entry.id,
				start: entry.start,
				end: entry.end,
				title: label(entry, entry.ownerId !== ownerId),
				editable: isMovable(entry, ownerId, role),
				extendedProps: { entry }
			})),
		[entries, ownerId, role, label]
	);

	// The selection preview (selectMirror) is an event without an entry.
	const entryOf = (info: { event: { extendedProps: unknown } }) =>
		(info.event.extendedProps as { entry?: CalendarEntry }).entry;

	const eventClass = (info: EventDisplayInfo) => {
		const entry = entryOf(info);
		if (!entry) return 'calEntry calEntry--mirror';
		const colleague = entry.ownerId !== ownerId;
		return [
			'calEntry',
			`calEntry--${entry.type}`,
			colleague && 'calEntry--colleague',
			!colleague &&
				entry.type === 'appointment' &&
				isSoon(entry, nowDate) &&
				'calEntry--soon'
		]
			.filter(Boolean)
			.join(' ');
	};

	const eventContent = (info: EventDisplayInfo) => {
		const entry = entryOf(info);
		if (!entry)
			return (
				<span className="calEntry__inner">
					<span className="calEntry__time">{info.timeText}</span>
				</span>
			);
		const colleague = entry.ownerId !== ownerId;
		const owner = colleague ? colleagueNames[entry.ownerId] : undefined;
		return (
			<span className="calEntry__inner">
				<span className="calEntry__icon">
					<CalendarEntryGlyph entry={entry} colleague={colleague} />
				</span>
				<span className="calEntry__text">
					{info.timeText &&
						!info.view.type.startsWith('timeGrid') && (
							<span className="calEntry__time">
								{info.timeText}
							</span>
						)}
					<span className="calEntry__title">
						{owner ? `${owner} · ` : ''}
						{info.event.title}
					</span>
				</span>
			</span>
		);
	};

	// FullCalendar reports the range after every update; only a real change
	// may set state, or React loops.
	const rangeChange = useRef(onRangeChange);
	rangeChange.current = onRangeChange;
	const lastRange = useRef('');
	const datesSet = useCallback(
		(info: { start: Date; end: Date; view: { title: string } }) => {
			setTitle((previous) =>
				previous === info.view.title ? previous : info.view.title
			);
			const key = `${info.start.getTime()}-${info.end.getTime()}`;
			if (key !== lastRange.current) {
				lastRange.current = key;
				rangeChange.current?.(info.start, info.end);
			}
		},
		[]
	);

	const changeView = (next: CalendarViewName) => {
		setView(next);
		controller.changeView(FC_VIEW[next]);
	};

	return (
		<div
			className={`calendarView${compact ? ' calendarView--compact' : ''}`}
			data-testid="calendar-view"
		>
			<div className="calendarView__toolbar">
				<div className="calendarView__nav">
					<IconButton
						aria-label={t('calendar.previous')}
						onClick={() => controller.prev()}
						size="small"
					>
						<ChevronLeftIcon />
					</IconButton>
					<IconButton
						aria-label={t('calendar.next')}
						onClick={() => controller.next()}
						size="small"
					>
						<ChevronRightIcon />
					</IconButton>
					<button
						type="button"
						className="calendarView__today"
						onClick={() => controller.today()}
					>
						{t('calendar.today')}
					</button>
					<h2 className="calendarView__title" aria-live="polite">
						{title}
					</h2>
				</div>
				<div className="calendarView__end">
					<ButtonGroup
						variant="outline"
						ariaLabel={t('calendar.viewSwitch')}
						className="calendarView__views"
						disableAutoStack
						items={views.map((name) => ({
							id: name,
							label: t(`calendar.views.${name}`),
							variant: name === view ? 'tonal' : 'outline',
							ariaLabel: `${t(`calendar.views.${name}`)}${name === view ? ' ✓' : ''}`,
							onClick: () => changeView(name)
						}))}
					/>
					{toolbarEnd}
				</div>
			</div>
			<div className="calendarView__grid">
				<FullCalendar
					controller={controller}
					plugins={PLUGINS}
					locales={LOCALES}
					locale={fullCalendarLocale(i18n.language)}
					initialView={FC_VIEW[view]}
					initialDate={now}
					now={now}
					headerToolbar={false}
					height="100%"
					firstDay={1}
					nowIndicator
					allDaySlot={false}
					slotMinTime={hours.min}
					slotMaxTime={hours.max}
					scrollTime="08:00:00"
					dayMaxEvents={3}
					selectable={consultant}
					selectMirror
					editable={consultant}
					eventDurationEditable={false}
					events={events}
					eventClass={eventClass}
					eventContent={eventContent}
					noEventsContent={t('calendar.noEvents')}
					datesSet={datesSet}
					select={(info: DateSelectInfo) => {
						const pointer = info.jsEvent as MouseEvent | undefined;
						onSelectRange?.(
							{ start: info.start, end: info.end },
							{
								x: pointer?.clientX ?? 0,
								y: pointer?.clientY ?? 0
							}
						);
					}}
					eventClick={(info: EventClickInfo) => {
						const entry = entryOf(info);
						if (entry) onEntryClick?.(entry);
					}}
					eventDrop={(info: EventDropInfo) => {
						const entry = entryOf(info);
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
			</div>
		</div>
	);
};
