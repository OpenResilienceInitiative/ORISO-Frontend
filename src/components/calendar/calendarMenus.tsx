/**
 * The contents of every calendar menu, composed from the `ChatMenuDropdown`
 * atoms (Frank, 2026-11-14: "so changing the menu changes them
 * everywhere"). `CalendarMenu` places the card; these say what is in it.
 * All of them are presentational: text comes translated through the hooks,
 * every choice goes out through a callback.
 */
import * as React from 'react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import CheckIcon from '@mui/icons-material/Check';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import EventRepeatOutlinedIcon from '@mui/icons-material/EventRepeatOutlined';
import UndoOutlinedIcon from '@mui/icons-material/UndoOutlined';
import WbSunnyOutlinedIcon from '@mui/icons-material/WbSunnyOutlined';
import WorkHistoryOutlinedIcon from '@mui/icons-material/WorkHistoryOutlined';
import SyncOutlinedIcon from '@mui/icons-material/SyncOutlined';
import LoginOutlinedIcon from '@mui/icons-material/LoginOutlined';
import EventBusyOutlinedIcon from '@mui/icons-material/EventBusyOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import PlayArrowOutlinedIcon from '@mui/icons-material/PlayArrowOutlined';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import TodayOutlinedIcon from '@mui/icons-material/TodayOutlined';
import RestartAltOutlinedIcon from '@mui/icons-material/RestartAltOutlined';
import {
	ChatMenuDropdownDivider,
	ChatMenuDropdownGroupLabel,
	ChatMenuDropdownHeader,
	ChatMenuDropdownItem,
	ChatMenuDropdownNote,
	handleMenuKeyDown
} from '../chatMenuDropdown/ChatMenuDropdown';
import { initialsOf } from './CalendarEntryPeek';
import {
	APPOINTMENT_KINDS,
	findConflicts,
	type AppointmentKind,
	type CalendarEntry,
	type Colleague
} from './calendarModel';
import {
	CALENDAR_FACETS,
	CalendarEntryGlyph,
	FacetIcon,
	type CalendarEntryFacet
} from './CalendarEntryGlyph';
import type { EntryAction, MoveProposal } from './calendarActions';
import {
	VIEW_DIGIT,
	type CalendarViewName,
	type ViewSwitcherStyle
} from './calendarViews';
import { useEntryLabel, useRangeFormat } from './useEntryLabel';
import type { EdgeChoice } from './calendarPreferences';

/** What a free range becomes: an appointment kind or a blocker. */
export type SlotChoice = AppointmentKind | 'blocker';

const Check = ({ on }: { on: boolean }) =>
	on ? <CheckIcon fontSize="small" /> : <span aria-hidden="true" />;

/* ------------------------------------------------------------------ */
/* Free range in the time grid                                          */
/* ------------------------------------------------------------------ */

export interface SlotMenuContentProps {
	range: { start: Date; end: Date };
	/** The range lies outside the working hours: say so, still allow it. */
	outsideHours?: boolean;
	onChoose: (choice: SlotChoice) => void;
}

/**
 * Dragging over free time: the time is chosen, one click says what it
 * becomes. A blocker is entered at once (with undo), an appointment opens
 * the dialog for the conversation.
 */
export const SlotMenuContent = ({
	range,
	outsideHours,
	onChoose
}: SlotMenuContentProps) => {
	const { t } = useTranslation();
	const format = useRangeFormat();
	return (
		<>
			<ChatMenuDropdownHeader
				subtitle={t('calendar.slotMenu.as')}
				title={format(range.start, range.end)}
				titleAs="p"
			/>
			{outsideHours && (
				<ChatMenuDropdownNote tone="warning">
					{t('calendar.slotMenu.outsideHours')}
				</ChatMenuDropdownNote>
			)}
			{APPOINTMENT_KINDS.map((kind) => (
				<ChatMenuDropdownItem
					key={kind}
					role="menuitem"
					className={`calendarMenu__kind calendarMenu__kind--${kind}`}
					icon={<FacetIcon facet={kind} />}
					title={t(`calendar.kinds.${kind}`)}
					onClick={() => onChoose(kind)}
					data-cy={`calendar-slot-${kind}`}
				/>
			))}
			<ChatMenuDropdownDivider />
			<ChatMenuDropdownItem
				role="menuitem"
				className="calendarMenu__kind calendarMenu__kind--blocker"
				icon={<FacetIcon facet="blocker" />}
				title={t('calendar.blocker.menuItem')}
				description={t('calendar.slotMenu.blockerNow')}
				onClick={() => onChoose('blocker')}
				data-cy="calendar-slot-blocker"
			/>
		</>
	);
};

/* ------------------------------------------------------------------ */
/* A day (or several) in the month view                                 */
/* ------------------------------------------------------------------ */

export interface MonthDayMenuContentProps {
	/** First day, local midnight. */
	start: Date;
	/** Number of days, at least one. */
	days: number;
	onAllDay: () => void;
	onWithTime: () => void;
	onAppointment: () => void;
}

export const MonthDayMenuContent = ({
	start,
	days,
	onAllDay,
	onWithTime,
	onAppointment
}: MonthDayMenuContentProps) => {
	const { t, i18n } = useTranslation();
	const locale = i18n.language?.startsWith('en') ? 'en-GB' : 'de-DE';
	const day = new Intl.DateTimeFormat(locale, {
		weekday: 'short',
		day: 'numeric',
		month: 'long'
	});
	const last = new Date(start);
	last.setDate(last.getDate() + days - 1);
	const title =
		days === 1
			? day.format(start)
			: t('calendar.monthMenu.range', {
					from: day.format(start),
					to: day.format(last),
					days
				});
	return (
		<>
			<ChatMenuDropdownHeader
				subtitle={t('calendar.monthMenu.label')}
				title={title}
				titleAs="p"
			/>
			<ChatMenuDropdownGroupLabel>
				{t('calendar.blocker.menuItem')}
			</ChatMenuDropdownGroupLabel>
			<ChatMenuDropdownItem
				role="menuitem"
				icon={<WbSunnyOutlinedIcon fontSize="small" />}
				title={
					days === 1
						? t('calendar.monthMenu.allDay')
						: t('calendar.monthMenu.allDays', { days })
				}
				description={t('calendar.slotMenu.blockerNow')}
				onClick={onAllDay}
				data-cy="calendar-month-all-day"
			/>
			<ChatMenuDropdownItem
				role="menuitem"
				icon={<ScheduleOutlinedIcon fontSize="small" />}
				title={t('calendar.monthMenu.withTime')}
				onClick={onWithTime}
				data-cy="calendar-month-with-time"
			/>
			<ChatMenuDropdownDivider />
			<ChatMenuDropdownItem
				role="menuitem"
				icon={<EventOutlinedIcon fontSize="small" />}
				title={t('calendar.monthMenu.appointment')}
				description={t('calendar.monthMenu.appointmentHint')}
				onClick={onAppointment}
				data-cy="calendar-month-appointment"
			/>
		</>
	);
};

/* ------------------------------------------------------------------ */
/* One entry: its actions, and the inline move / proposal form          */
/* ------------------------------------------------------------------ */

const pad = (n: number) => String(n).padStart(2, '0');
const dateValue = (d: Date) =>
	`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const timeValue = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
/** `date` + `days` at `time`, on the local clock. */
const combine = (date: string, time: string, days = 0) => {
	const [y, m, d] = date.split('-').map(Number);
	const [h, min] = time.split(':').map(Number);
	if ([y, m, d, h, min].some((n) => Number.isNaN(n))) return null;
	return new Date(y, m - 1, d + days, h, min);
};
/** Calendar days from the day of `start` to the day of `end`. */
const daysApart = (start: Date, end: Date) =>
	Math.round(
		(new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime() -
			new Date(
				start.getFullYear(),
				start.getMonth(),
				start.getDate()
			).getTime()) /
			86_400_000
	);

export interface MoveFormProps {
	entry: CalendarEntry;
	/** `move` changes the own entry; `propose` asks the colleague. */
	mode: 'move' | 'propose';
	/** Own entries, to warn about overlaps. */
	entries: CalendarEntry[];
	ownerId: string;
	/** Whose confirmation a proposal waits for. */
	approverName?: string;
	onSubmit: (start: Date, end: Date) => void;
	onBack: () => void;
}

export const MoveForm = ({
	entry,
	mode,
	entries,
	ownerId,
	approverName,
	onSubmit,
	onBack
}: MoveFormProps) => {
	const { t } = useTranslation();
	const start = new Date(entry.start);
	const end = new Date(entry.end);
	const [date, setDate] = useState(dateValue(start));
	const [from, setFrom] = useState(timeValue(start));
	const [to, setTo] = useState(timeValue(end));
	// The end keeps its distance in days, so an entry over midnight or
	// over several days moves as a whole.
	const endDays = daysApart(start, end);
	const nextStart = combine(date, from);
	const nextEnd = combine(date, to, endDays);
	const invalid = !nextStart || !nextEnd || nextEnd <= nextStart;
	const conflicts = useMemo(
		() =>
			!invalid && mode === 'move'
				? findConflicts(
						{ start: nextStart!, end: nextEnd! },
						entries,
						ownerId,
						entry.id
					)
				: [],
		[invalid, mode, nextStart, nextEnd, entries, ownerId, entry.id]
	);
	return (
		<form
			className="calendarMenuForm"
			onSubmit={(event) => {
				event.preventDefault();
				if (!invalid) onSubmit(nextStart!, nextEnd!);
			}}
			data-cy="calendar-move-form"
		>
			<label className="calendarMenuForm__field">
				<span>{t('calendar.entryMenu.date')}</span>
				<input
					type="date"
					value={date}
					onChange={(e) => setDate(e.target.value)}
					required
				/>
			</label>
			<div className="calendarMenuForm__row">
				<label className="calendarMenuForm__field">
					<span>{t('calendar.entryMenu.from')}</span>
					<input
						type="time"
						value={from}
						step={900}
						onChange={(e) => setFrom(e.target.value)}
						required
					/>
				</label>
				<label className="calendarMenuForm__field">
					<span>{t('calendar.entryMenu.to')}</span>
					<input
						type="time"
						value={to}
						step={900}
						onChange={(e) => setTo(e.target.value)}
						required
					/>
				</label>
			</div>
			{invalid && (
				<ChatMenuDropdownNote tone="warning">
					{t('calendar.entryMenu.invalid')}
				</ChatMenuDropdownNote>
			)}
			{conflicts.length > 0 && (
				<ChatMenuDropdownNote tone="warning">
					{t('calendar.entryMenu.conflicts')}
				</ChatMenuDropdownNote>
			)}
			{mode === 'propose' && approverName && (
				<ChatMenuDropdownNote>
					{t('calendar.entryMenu.proposeHint', {
						name: approverName
					})}
				</ChatMenuDropdownNote>
			)}
			<div className="calendarMenuForm__actions">
				<button
					type="button"
					className="calendarMenuForm__button"
					onClick={onBack}
				>
					{t('calendar.entryMenu.back')}
				</button>
				<button
					type="submit"
					className="calendarMenuForm__button calendarMenuForm__button--primary"
					disabled={invalid}
					data-cy="calendar-move-submit"
				>
					{mode === 'move'
						? t('calendar.entryMenu.saveMove')
						: t('calendar.entryMenu.sendProposal')}
				</button>
			</div>
		</form>
	);
};

export interface EntryMenuContentProps {
	entry: CalendarEntry;
	actions: EntryAction[];
	/** The entry belongs to this colleague. */
	colleague?: Colleague;
	/** `list` shows the actions; `move`/`propose` the inline form. */
	mode: 'list' | 'move' | 'propose';
	entries: CalendarEntry[];
	ownerId: string;
	onMode: (mode: 'list' | 'move' | 'propose') => void;
	onAction: (action: 'start' | 'chat' | 'join' | 'cancel' | 'remove') => void;
	onMove: (start: Date, end: Date) => void;
}

const ACTION_ICON: Record<
	'start' | 'chat' | 'join' | 'cancel' | 'remove',
	React.ReactNode
> = {
	start: <PlayArrowOutlinedIcon fontSize="small" />,
	chat: <ChatBubbleOutlineIcon fontSize="small" />,
	join: <LoginOutlinedIcon fontSize="small" />,
	cancel: <EventBusyOutlinedIcon fontSize="small" />,
	remove: <DeleteOutlineIcon fontSize="small" />
};

export const EntryMenuContent = ({
	entry,
	actions,
	colleague,
	mode,
	entries,
	ownerId,
	onMode,
	onAction,
	onMove
}: EntryMenuContentProps) => {
	const { t } = useTranslation();
	const label = useEntryLabel();
	const format = useRangeFormat();
	const title = colleague
		? `${colleague.displayName} · ${label(entry, true)}`
		: label(entry);
	const range = entry.allDay
		? `${format(entry.start).split(',')[0]}, ${t('calendar.allDay')}`
		: format(entry.start, entry.end);
	// The move / proposal form is a dialog and may carry a heading; the
	// action list is a menu and may not.
	// Who it is with, as ORISO shows people: the colleague, the advice
	// seeker of an appointment, or "Ich" for one's own blocked time.
	const who = colleague
		? initialsOf(colleague.displayName)
		: entry.type === 'appointment' && entry.title
			? initialsOf(entry.title)
			: t('calendar.people.me');
	const header = (
		<div className="calendarMenu__head">
			<span
				className={`calendarMenu__avatar${colleague || entry.type === 'appointment' ? '' : ' calendarMenu__avatar--me'}`}
				aria-hidden="true"
			>
				{who}
			</span>
			<ChatMenuDropdownHeader
				subtitle={range}
				title={title}
				titleAs={mode === 'list' ? 'p' : 'h2'}
			/>
		</div>
	);

	if (mode !== 'list')
		return (
			<>
				{header}
				<MoveForm
					entry={entry}
					mode={mode}
					entries={entries}
					ownerId={ownerId}
					approverName={colleague?.displayName}
					onSubmit={onMove}
					onBack={() => onMode('list')}
				/>
			</>
		);

	const actionLabel = (action: EntryAction) => {
		switch (action) {
			case 'start':
				return t(`calendar.details.start.${entry.kind ?? 'video'}`);
			case 'chat':
				return t('calendar.entryMenu.chat');
			case 'join':
				return t('calendar.entryMenu.join');
			case 'move':
				return t('calendar.entryMenu.move');
			case 'propose':
				return t('calendar.entryMenu.propose');
			case 'cancel':
				return t('calendar.entryMenu.cancel');
			default:
				return t('calendar.entryMenu.remove');
		}
	};

	return (
		<>
			{header}
			{entry.address && (
				<ChatMenuDropdownNote>{entry.address}</ChatMenuDropdownNote>
			)}
			{entry.type === 'group' && (
				<ChatMenuDropdownNote>
					{t('calendar.entryMenu.groupHint')}
				</ChatMenuDropdownNote>
			)}
			{entry.type === 'busy' && (
				<ChatMenuDropdownNote>
					{t('calendar.details.busyHint')}
				</ChatMenuDropdownNote>
			)}
			{colleague && (
				<ChatMenuDropdownNote>
					{t('calendar.details.colleagueHint')}
				</ChatMenuDropdownNote>
			)}
			{actions.length > 0 && <ChatMenuDropdownDivider />}
			{actions.map((action) => {
				const form = action === 'move' || action === 'propose';
				return (
					<ChatMenuDropdownItem
						key={action}
						role="menuitem"
						icon={
							form ? (
								<EventRepeatOutlinedIcon fontSize="small" />
							) : action === 'start' ? (
								<CalendarEntryGlyph entry={entry} />
							) : (
								ACTION_ICON[action]
							)
						}
						title={actionLabel(action)}
						onClick={() =>
							form ? onMode(action) : onAction(action)
						}
						data-cy={`calendar-entry-${action}`}
					/>
				);
			})}
		</>
	);
};

/* ------------------------------------------------------------------ */
/* A pending move proposal                                              */
/* ------------------------------------------------------------------ */

export interface ProposalMenuContentProps {
	proposal: MoveProposal;
	entry: CalendarEntry;
	approverName: string;
	onWithdraw?: () => void;
}

export const ProposalMenuContent = ({
	proposal,
	entry,
	approverName,
	onWithdraw
}: ProposalMenuContentProps) => {
	const { t } = useTranslation();
	const label = useEntryLabel();
	const format = useRangeFormat();
	return (
		<>
			<ChatMenuDropdownHeader
				subtitle={t('calendar.proposal.proposed', {
					date: format(proposal.start, proposal.end)
				})}
				title={t('calendar.proposal.title', {
					title: label(entry, true)
				})}
				titleAs="p"
			/>
			<ChatMenuDropdownNote>
				{t('calendar.proposal.hint', { name: approverName })}
			</ChatMenuDropdownNote>
			{onWithdraw && (
				<>
					<ChatMenuDropdownDivider />
					<ChatMenuDropdownItem
						role="menuitem"
						icon={<UndoOutlinedIcon fontSize="small" />}
						title={t('calendar.proposal.withdraw')}
						onClick={onWithdraw}
						data-cy="calendar-proposal-withdraw"
					/>
				</>
			)}
		</>
	);
};

/* ------------------------------------------------------------------ */
/* The ⋮ settings menu                                                  */
/* ------------------------------------------------------------------ */

export interface SettingsMenuContentProps {
	/** One line, e.g. "Mo–Fr 08:00–18:00"; absent = none set. */
	workingHoursSummary?: string;
	switcherStyle: ViewSwitcherStyle;
	onWorkingHours?: () => void;
	onSwitcherStyle: (style: ViewSwitcherStyle) => void;
	onSync?: () => void;
	/** The remembered answer after dragging a grip, if any. */
	rememberedEdge?: EdgeChoice | null;
	/** "Gemerkte Auswahl vergessen": ask again next time. */
	onForgetEdge?: () => void;
}

export const SettingsMenuContent = ({
	workingHoursSummary,
	switcherStyle,
	onWorkingHours,
	onSwitcherStyle,
	onSync,
	rememberedEdge,
	onForgetEdge
}: SettingsMenuContentProps) => {
	const { t } = useTranslation();
	return (
		<>
			{onWorkingHours && (
				<ChatMenuDropdownItem
					role="menuitem"
					icon={<WorkHistoryOutlinedIcon fontSize="small" />}
					title={t('calendar.settings.workingHours')}
					description={
						workingHoursSummary ?? t('calendar.workingHours.none')
					}
					onClick={onWorkingHours}
					data-cy="calendar-settings-working-hours"
				/>
			)}
			{rememberedEdge && onForgetEdge && (
				<ChatMenuDropdownItem
					role="menuitem"
					icon={<RestartAltOutlinedIcon fontSize="small" />}
					title={t('calendar.grip.forget')}
					description={t(
						rememberedEdge === 'day'
							? 'calendar.grip.rememberedDay'
							: 'calendar.grip.rememberedWeek'
					)}
					onClick={onForgetEdge}
					data-cy="calendar-settings-forget-edge"
				/>
			)}
			<ChatMenuDropdownGroupLabel>
				{t('calendar.settings.switcher')}
			</ChatMenuDropdownGroupLabel>
			{(['menu', 'digits'] as ViewSwitcherStyle[]).map((style) => (
				<ChatMenuDropdownItem
					key={style}
					role="menuitemradio"
					aria-checked={switcherStyle === style}
					active={switcherStyle === style}
					icon={<Check on={switcherStyle === style} />}
					title={t(
						`calendar.settings.switcher${style === 'menu' ? 'Menu' : 'Digits'}`
					)}
					onClick={() => onSwitcherStyle(style)}
					data-cy={`calendar-settings-switcher-${style}`}
				/>
			))}
			<ChatMenuDropdownNote>
				{t('calendar.settings.switcherHint')}
			</ChatMenuDropdownNote>
			{onSync && (
				<>
					<ChatMenuDropdownDivider />
					<ChatMenuDropdownItem
						role="menuitem"
						icon={<SyncOutlinedIcon fontSize="small" />}
						title={t('calendar.settings.sync')}
						onClick={onSync}
						data-cy="calendar-settings-sync"
					/>
				</>
			)}
		</>
	);
};

/* ------------------------------------------------------------------ */
/* A moved working-hours grip: this day or always?                      */
/* ------------------------------------------------------------------ */

export interface EdgeMenuContentProps {
	edge: 'start' | 'end';
	day: Date;
	/** HH:mm before and after. */
	from: string;
	to: string;
	remember: boolean;
	onRemember: (remember: boolean) => void;
	onChoose: (choice: EdgeChoice) => void;
}

/**
 * After a grip was let go: "Nur an diesem Tag" stores a day exception,
 * "Immer montags" changes the weekly hours. "Auswahl merken" skips the
 * question next time; the ⋮ menu forgets it again.
 */
export const EdgeMenuContent = ({
	edge,
	day,
	from,
	to,
	remember,
	onRemember,
	onChoose
}: EdgeMenuContentProps) => {
	const { t, i18n } = useTranslation();
	const locale = i18n.language?.startsWith('en') ? 'en-GB' : 'de-DE';
	const short = new Intl.DateTimeFormat(locale, {
		weekday: 'short',
		day: 'numeric',
		month: 'numeric'
	}).format(day);
	const long = new Intl.DateTimeFormat(locale, {
		weekday: 'long',
		day: 'numeric',
		month: 'long',
		year: 'numeric'
	}).format(day);
	const what = t(
		edge === 'start' ? 'calendar.grip.start' : 'calendar.grip.end'
	);
	return (
		<>
			<ChatMenuDropdownHeader
				title={`${what} ${to}`}
				subtitle={t('calendar.grip.instead', { time: from, date: short })}
				titleAs="p"
			/>
			<ChatMenuDropdownItem
				role="menuitem"
				icon={<TodayOutlinedIcon fontSize="small" />}
				title={t('calendar.grip.onlyThisDay')}
				description={long}
				onClick={() => onChoose('day')}
				data-cy="calendar-edge-day"
			/>
			<ChatMenuDropdownItem
				role="menuitem"
				icon={<EventRepeatOutlinedIcon fontSize="small" />}
				title={t('calendar.grip.always', {
					weekdays: t(`calendar.grip.weekdays.${day.getDay()}`)
				})}
				description={t('calendar.grip.alwaysHint')}
				onClick={() => onChoose('week')}
				data-cy="calendar-edge-week"
			/>
			<ChatMenuDropdownDivider />
			<ChatMenuDropdownItem
				role="menuitemcheckbox"
				aria-checked={remember}
				active={remember}
				icon={<Check on={remember} />}
				title={t('calendar.grip.remember')}
				description={t('calendar.grip.rememberHint')}
				onClick={() => onRemember(!remember)}
				data-cy="calendar-edge-remember"
			/>
		</>
	);
};

/* ------------------------------------------------------------------ */
/* The view menu                                                        */
/* ------------------------------------------------------------------ */

export interface ViewMenuContentProps {
	views: CalendarViewName[];
	current: CalendarViewName;
	onChoose: (view: CalendarViewName) => void;
}

export const ViewMenuContent = ({
	views,
	current,
	onChoose
}: ViewMenuContentProps) => {
	const { t } = useTranslation();
	return (
		<>
			{views.map((view) => (
				<ChatMenuDropdownItem
					key={view}
					role="menuitemradio"
					aria-checked={view === current}
					active={view === current}
					icon={<Check on={view === current} />}
					title={t(`calendar.views.${view}`)}
					shortcut={VIEW_DIGIT[view]}
					onClick={() => onChoose(view)}
					data-cy={`calendar-view-${view}`}
				/>
			))}
		</>
	);
};

/* ------------------------------------------------------------------ */
/* Jump to a day ("Heute" ▾)                                            */
/* ------------------------------------------------------------------ */

export interface JumpMenuContentProps {
	now: Date;
	onJump: (date: Date) => void;
}

const startOfDay = (date: Date) => {
	const day = new Date(date);
	day.setHours(0, 0, 0, 0);
	return day;
};

export const JumpMenuContent = ({ now, onJump }: JumpMenuContentProps) => {
	const { t } = useTranslation();
	const today = startOfDay(now);
	const plus = (days: number) => {
		const d = new Date(today);
		d.setDate(d.getDate() + days);
		return d;
	};
	const nextMonday = plus((8 - today.getDay()) % 7 || 7);
	const [picked, setPicked] = useState(dateValue(today));
	const jumps: [string, Date][] = [
		['today', today],
		['tomorrow', plus(1)],
		['nextMonday', nextMonday],
		['inTwoWeeks', plus(14)]
	];
	return (
		<>
			{/* The dialog holds a menu of quick jumps and a date form. */}
			<div
				role="menu"
				aria-label={t('calendar.jump.label')}
				onKeyDown={handleMenuKeyDown}
			>
				{jumps.map(([key, date]) => (
					<ChatMenuDropdownItem
						key={key}
						role="menuitem"
						title={t(`calendar.jump.${key}`)}
						onClick={() => onJump(date)}
						data-cy={`calendar-jump-${key}`}
					/>
				))}
			</div>
			<ChatMenuDropdownDivider />
			<form
				className="calendarMenuForm"
				onSubmit={(event) => {
					event.preventDefault();
					const date = combine(picked, '00:00');
					if (date) onJump(date);
				}}
			>
				<label className="calendarMenuForm__field">
					<span>{t('calendar.jump.date')}</span>
					<input
						type="date"
						value={picked}
						onChange={(e) => setPicked(e.target.value)}
						required
					/>
				</label>
				<div className="calendarMenuForm__actions">
					<button
						type="submit"
						className="calendarMenuForm__button calendarMenuForm__button--primary"
					>
						{t('calendar.jump.go')}
					</button>
				</div>
			</form>
		</>
	);
};

/* ------------------------------------------------------------------ */
/* Pick colleagues' calendars ("Weitere …")                             */
/* ------------------------------------------------------------------ */

export interface PeopleMenuContentProps {
	colleagues: Colleague[];
	shown: string[];
	/** Who the Träger lets one see, one sentence. */
	scopeHint?: string;
	onToggle: (id: string) => void;
}

export const PeopleMenuContent = ({
	colleagues,
	shown,
	scopeHint,
	onToggle
}: PeopleMenuContentProps) => {
	const { t } = useTranslation();
	if (colleagues.length === 0)
		return (
			<ChatMenuDropdownNote>
				{t('calendar.colleaguesEmpty')}
			</ChatMenuDropdownNote>
		);
	return (
		<>
			{colleagues.map((c) => {
				const on = shown.includes(c.id);
				return (
					<ChatMenuDropdownItem
						key={c.id}
						role="menuitemcheckbox"
						aria-checked={on}
						active={on}
						icon={<Check on={on} />}
						title={c.displayName}
						description={c.agencyName}
						shortcut={c.agencyShort}
						onClick={() => onToggle(c.id)}
						data-cy={`calendar-people-${c.id}`}
					/>
				);
			})}
			{scopeHint && (
				<ChatMenuDropdownNote>{scopeHint}</ChatMenuDropdownNote>
			)}
		</>
	);
};

/* ------------------------------------------------------------------ */
/* "Was anzeigen": which kinds the calendar and the list show           */
/* ------------------------------------------------------------------ */

export interface KindsMenuContentProps {
	hidden: CalendarEntryFacet[];
	onToggle: (facet: CalendarEntryFacet) => void;
	onShowAll: () => void;
}

export const KindsMenuContent = ({
	hidden,
	onToggle,
	onShowAll
}: KindsMenuContentProps) => {
	const { t } = useTranslation();
	return (
		<>
			{CALENDAR_FACETS.map((facet) => {
				const on = !hidden.includes(facet);
				return (
					<ChatMenuDropdownItem
						key={facet}
						role="menuitemcheckbox"
						aria-checked={on}
						className={`calendarMenu__kind calendarMenu__kind--${facet}`}
						icon={<FacetIcon facet={facet} />}
						title={t(`calendar.facets.${facet}`)}
						shortcut={<Check on={on} />}
						onClick={() => onToggle(facet)}
						data-cy={`calendar-kinds-${facet}`}
					/>
				);
			})}
			<ChatMenuDropdownNote>
				{t('calendar.kindsMenu.hint')}
			</ChatMenuDropdownNote>
			{hidden.length > 0 && (
				<>
					<ChatMenuDropdownDivider />
					<ChatMenuDropdownItem
						role="menuitem"
						title={t('calendar.kindsMenu.all')}
						onClick={onShowAll}
						data-cy="calendar-kinds-all"
					/>
				</>
			)}
		</>
	);
};
