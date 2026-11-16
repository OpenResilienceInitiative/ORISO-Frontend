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
import CloseIcon from '@mui/icons-material/Close';
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
import ViewDayIcon from '@mui/icons-material/ViewDay';
import ViewWeekIcon from '@mui/icons-material/ViewWeek';
import GridViewOutlinedIcon from '@mui/icons-material/GridViewOutlined';
import ListIcon from '@mui/icons-material/List';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import {
	ChatMenuDropdownDivider,
	ChatMenuDropdownGroupLabel,
	ChatMenuDropdownHeader,
	ChatMenuDropdownItem,
	ChatMenuDropdownItemContent,
	ChatMenuDropdownNote,
	handleMenuKeyDown
} from '../chatMenuDropdown/ChatMenuDropdown';
import { initialsOf } from './CalendarEntryPeek';
import { avatarToneClass } from './calendarAvatar';
import {
	APPOINTMENT_KINDS,
	findConflicts,
	type AppointmentKind,
	type CalendarConversation,
	type CalendarEntry,
	type Colleague
} from './calendarModel';
import { CalendarEntryGlyph, FacetIcon, facetOf } from './CalendarEntryGlyph';
import type { EntryAction, MoveProposal } from './calendarActions';
import { type CalendarViewName, type ViewSwitcherStyle } from './calendarViews';
import { useEntryLabel, useRangeFormat } from './useEntryLabel';
import type { EdgeChoice } from './calendarPreferences';
import { calendarLocale } from './calendarLocale';
import {
	edgeLabelKey,
	type TimeWindow,
	type WorkEdge
} from './calendarWorkingHours';

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
	/** Second step: the kind is chosen, now who it is with. */
	kind?: AppointmentKind;
	conversations?: CalendarConversation[];
	/** A conversation picked: the appointment is entered at once. */
	onPick?: (sessionId: number) => void;
	/** "Mehr Angaben …": the full dialog, time and kind filled in. */
	onMore?: () => void;
}

/** The most conversations the second step lists; the search finds the rest. */
const SLOT_PEOPLE = 8;

/**
 * "Mit wem?" (prototype v17): the second step in the same card. A search
 * field, the conversations with their avatars, one click enters the
 * appointment.
 */
const SlotPeopleStep = ({
	range,
	kind,
	conversations,
	onPick,
	onMore
}: {
	range: { start: Date; end: Date };
	kind: AppointmentKind;
	conversations: CalendarConversation[];
	onPick: (sessionId: number) => void;
	onMore?: () => void;
}) => {
	const { t } = useTranslation();
	const format = useRangeFormat();
	const [query, setQuery] = useState('');
	const needle = query.trim().toLowerCase().replace(/\s+/g, '_');
	const found = conversations
		.filter((c) => c.username.toLowerCase().includes(needle))
		.slice(0, SLOT_PEOPLE);
	return (
		<>
			<ChatMenuDropdownHeader
				subtitle={format(range.start, range.end)}
				title={t(`calendar.nouns.${kind}`)}
				titleAs="h2"
			/>
			{/* Not ListSearchField: that is the pill search on top of a master
			    list, with a 48 px leading menu or filter slot and its own
			    clear button. Here the field is the labelled "Mit wem?" input
			    of a 280 px menu step, where a leading menu would be a second,
			    empty menu inside the menu (CodeRabbit pre-merge check). */}
			<input
				type="search"
				className="calendarMenu__search"
				value={query}
				onChange={(event) => setQuery(event.target.value)}
				placeholder={t('calendar.slotMenu.whoPlaceholder')}
				aria-label={t('calendar.slotMenu.who')}
				data-cy="calendar-slot-search"
			/>
			{found.length > 0 ? (
				<div
					className="calendarMenu__people"
					role="group"
					aria-label={t('calendar.slotMenu.conversations')}
				>
					{found.map((c) => (
						<ChatMenuDropdownItem
							key={c.sessionId}
							className="calendarMenu__person"
							onClick={() => onPick(c.sessionId)}
							data-cy={`calendar-slot-person-${c.sessionId}`}
						>
							<span
								className={`calendarMenu__avatar ${avatarToneClass(c.username)}`}
								aria-hidden="true"
							>
								{initialsOf(c.username)}
							</span>
							<ChatMenuDropdownItemContent title={c.username} />
						</ChatMenuDropdownItem>
					))}
				</div>
			) : (
				<ChatMenuDropdownNote>
					{t('calendar.slotMenu.noneFound')}
				</ChatMenuDropdownNote>
			)}
			{onMore && (
				<>
					<ChatMenuDropdownDivider />
					<ChatMenuDropdownItem
						icon={<EditNoteOutlinedIcon fontSize="small" />}
						title={t('calendar.quick.more')}
						onClick={onMore}
						data-cy="calendar-slot-more"
					/>
				</>
			)}
		</>
	);
};

/**
 * Dragging over free time: the time is chosen, one click says what it
 * becomes. A blocker is entered at once (with undo); an appointment asks
 * "Mit wem?" in the same card and is entered with the conversation picked
 * (prototype v17).
 */
export const SlotMenuContent = ({
	range,
	outsideHours,
	onChoose,
	kind,
	conversations = [],
	onPick,
	onMore
}: SlotMenuContentProps) => {
	const { t } = useTranslation();
	const format = useRangeFormat();
	if (kind && onPick)
		return (
			<SlotPeopleStep
				range={range}
				kind={kind}
				conversations={conversations}
				onPick={onPick}
				onMore={onMore}
			/>
		);
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
	const locale = calendarLocale(i18n.language);
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
	onAction: (
		action: 'show' | 'start' | 'chat' | 'join' | 'cancel' | 'remove'
	) => void;
	onMove: (start: Date, end: Date) => void;
}

const ACTION_ICON: Record<
	'show' | 'start' | 'chat' | 'join' | 'cancel' | 'remove',
	React.ReactNode
> = {
	show: <EventOutlinedIcon fontSize="small" />,
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
	const facet = facetOf(entry);
	const noun =
		entry.type === 'appointment' ? (entry.kind ?? 'video') : entry.type;
	// Who it is with, in the avatar tone ORISO gives that name: the
	// colleague or the advice seeker of an appointment; other entries show
	// their kind (prototype v17).
	const person =
		colleague?.displayName ??
		(entry.type === 'appointment' ? entry.title : undefined);
	// One's own appointment: "Sie und <Name>", both avatars stacked.
	const partner =
		!colleague && entry.type === 'appointment' ? entry.title : undefined;
	// The move / proposal form is a dialog and may carry a heading; the
	// action list is a menu and may not.
	const header = (
		<>
			<div className="calendarMenu__head">
				{person ? (
					<span
						className={`calendarMenu__avatar ${avatarToneClass(person)}`}
						aria-hidden="true"
					>
						{initialsOf(person)}
					</span>
				) : (
					<span
						className={`calendarMenu__kdot calendarMenu__kind--${facet}`}
						aria-hidden="true"
					>
						<FacetIcon facet={facet} />
					</span>
				)}
				<ChatMenuDropdownHeader
					subtitle={range}
					title={title}
					titleAs={mode === 'list' ? 'p' : 'h2'}
				/>
			</div>
			<p className="calendarMenu__tagRow">
				<span className="calendarMenu__tag">
					<FacetIcon facet={facet} />
					{t(`calendar.nouns.${noun}`)}
				</span>
			</p>
			{partner && (
				<p className="calendarMenu__who" data-cy="calendar-entry-who">
					<span className="calendarMenu__stack" aria-hidden="true">
						<span
							className={`calendarMenu__mini ${avatarToneClass('', true)}`}
						>
							{t('calendar.people.me')}
						</span>
						<span
							className={`calendarMenu__mini ${avatarToneClass(partner)}`}
						>
							{initialsOf(partner)}
						</span>
					</span>
					{t('calendar.entryMenu.withYou', { name: partner })}
				</p>
			)}
		</>
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
			case 'show':
				return t('calendar.entryMenu.show');
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

	// What each action does, under its name (prototype v17).
	const name = entry.title;
	const actionHint = (action: EntryAction): string | undefined => {
		switch (action) {
			case 'show':
				return t('calendar.entryMenu.showSub');
			case 'start':
				return name
					? t('calendar.entryMenu.startSub', { name })
					: undefined;
			case 'chat':
				return name
					? t('calendar.entryMenu.chatSub', { name })
					: undefined;
			case 'join':
				return t('calendar.entryMenu.joinSub');
			case 'move':
				return t('calendar.entryMenu.moveSub');
			case 'propose':
				return colleague
					? t('calendar.entryMenu.proposeSub', {
							name: colleague.displayName
						})
					: undefined;
			case 'cancel':
				return name
					? t('calendar.entryMenu.cancelSub', { name })
					: undefined;
			default:
				return undefined;
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
						description={actionHint(action)}
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
/* A proposal waiting for one's own answer ("Offene Anfragen")          */
/* ------------------------------------------------------------------ */

export interface RequestMenuContentProps {
	proposal: MoveProposal;
	/** The appointment's time the proposal was made for. */
	from: { start: string; end: string };
	/** The answer is on its way. */
	busy?: boolean;
	onAccept?: () => void;
	onDecline?: () => void;
}

export const RequestMenuContent = ({
	proposal,
	from,
	busy,
	onAccept,
	onDecline
}: RequestMenuContentProps) => {
	const { t } = useTranslation();
	const format = useRangeFormat();
	const name = proposal.proposerName ?? t('calendar.proposal.someone');
	return (
		<>
			<div className="calendarMenu__head">
				<span
					className={`calendarMenu__avatar ${avatarToneClass(name)}`}
					aria-hidden="true"
				>
					{initialsOf(name)}
				</span>
				<ChatMenuDropdownHeader
					subtitle={t('calendar.proposal.from', { name })}
					title={t('calendar.proposal.requestMenu')}
					titleAs="p"
				/>
			</div>
			<ChatMenuDropdownNote>
				{t('calendar.proposal.change', {
					from: format(from.start, from.end),
					to: format(proposal.start, proposal.end)
				})}
			</ChatMenuDropdownNote>
			<ChatMenuDropdownNote>
				{t('calendar.proposal.requestHint')}
			</ChatMenuDropdownNote>
			{(onAccept || onDecline) && <ChatMenuDropdownDivider />}
			{onAccept && (
				<ChatMenuDropdownItem
					role="menuitem"
					icon={<CheckIcon fontSize="small" />}
					title={t('calendar.proposal.accept')}
					description={t('calendar.proposal.acceptHint')}
					disabled={busy}
					onClick={onAccept}
					data-cy="calendar-request-accept"
				/>
			)}
			{onDecline && (
				<ChatMenuDropdownItem
					role="menuitem"
					icon={<CloseIcon fontSize="small" />}
					title={t('calendar.proposal.decline')}
					description={t('calendar.proposal.declineHint')}
					disabled={busy}
					onClick={onDecline}
					data-cy="calendar-request-decline"
				/>
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
	/** "Sperrzeit mit Wiederholung": the blocker form, for a series. */
	onRepeatBlocker?: () => void;
	/** "Freie Tage eintragen …": an all-day blocker from tomorrow. */
	onFreeDays?: () => void;
	onSwitcherStyle: (style: ViewSwitcherStyle) => void;
	onSync?: () => void;
	/** The remembered answer after dragging a grip, if any. */
	rememberedEdge?: EdgeChoice | null;
	/** "Gemerkte Auswahl vergessen": ask again next time. */
	onForgetEdge?: () => void;
	/**
	 * Whether the working-hours and pause grips show; with
	 * `onShowGrips` a checkable item switches them (Frank *7.2).
	 */
	showGrips?: boolean;
	onShowGrips?: (show: boolean) => void;
}

export const SettingsMenuContent = ({
	workingHoursSummary,
	switcherStyle,
	onWorkingHours,
	onRepeatBlocker,
	onFreeDays,
	onSwitcherStyle,
	onSync,
	rememberedEdge,
	onForgetEdge,
	showGrips = true,
	onShowGrips
}: SettingsMenuContentProps) => {
	const { t } = useTranslation();
	const forget = rememberedEdge && onForgetEdge;
	// Prototype v17: what to set up first, then how the views are chosen.
	const anyAbove =
		onWorkingHours ||
		onShowGrips ||
		onRepeatBlocker ||
		onFreeDays ||
		onSync ||
		forget;
	return (
		<>
			{onWorkingHours && (
				<ChatMenuDropdownItem
					role="menuitem"
					icon={<WorkHistoryOutlinedIcon fontSize="small" />}
					title={t('calendar.workingHours.title')}
					description={
						workingHoursSummary ?? t('calendar.workingHours.none')
					}
					onClick={onWorkingHours}
					data-cy="calendar-settings-working-hours"
				/>
			)}
			{onShowGrips && (
				<ChatMenuDropdownItem
					role="menuitemcheckbox"
					aria-checked={showGrips}
					icon={<ScheduleOutlinedIcon fontSize="small" />}
					title={t('calendar.settings.grips')}
					description={t('calendar.settings.gripsSub')}
					shortcut={<Check on={showGrips} />}
					onClick={() => onShowGrips(!showGrips)}
					data-cy="calendar-settings-grips"
				/>
			)}
			{onRepeatBlocker && (
				<ChatMenuDropdownItem
					role="menuitem"
					icon={<FacetIcon facet="blocker" />}
					title={t('calendar.settings.repeatBlocker')}
					onClick={onRepeatBlocker}
					data-cy="calendar-settings-repeat-blocker"
				/>
			)}
			{onFreeDays && (
				<ChatMenuDropdownItem
					role="menuitem"
					icon={<FacetIcon facet="blocker" />}
					title={t('calendar.settings.freeDays')}
					description={t('calendar.settings.freeDaysHint')}
					onClick={onFreeDays}
					data-cy="calendar-settings-free-days"
				/>
			)}
			{onSync && (
				<ChatMenuDropdownItem
					role="menuitem"
					icon={<SyncOutlinedIcon fontSize="small" />}
					title={t('calendar.settings.sync')}
					onClick={onSync}
					data-cy="calendar-settings-sync"
				/>
			)}
			{forget && (
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
			{anyAbove && <ChatMenuDropdownDivider />}
			<ChatMenuDropdownGroupLabel>
				{t('calendar.settings.switcher')}
			</ChatMenuDropdownGroupLabel>
			{(['menu', 'digits'] as ViewSwitcherStyle[]).map((style) => {
				const name = style === 'menu' ? 'Menu' : 'Digits';
				return (
					<ChatMenuDropdownItem
						key={style}
						role="menuitemradio"
						aria-checked={switcherStyle === style}
						active={switcherStyle === style}
						title={t(`calendar.settings.switcher${name}`)}
						description={t(`calendar.settings.switcher${name}Sub`)}
						shortcut={<Check on={switcherStyle === style} />}
						onClick={() => onSwitcherStyle(style)}
						data-cy={`calendar-settings-switcher-${style}`}
					/>
				);
			})}
			<ChatMenuDropdownNote>
				{t('calendar.settings.switcherHint')}
			</ChatMenuDropdownNote>
		</>
	);
};

/* ------------------------------------------------------------------ */
/* A moved working-hours grip: this day or always?                      */
/* ------------------------------------------------------------------ */

export interface EdgeMenuContentProps {
	edge: WorkEdge;
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
	const locale = calendarLocale(i18n.language);
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
	const what = t(edgeLabelKey(edge));
	return (
		<>
			<ChatMenuDropdownHeader
				title={`${what} ${to}`}
				subtitle={t('calendar.grip.instead', {
					time: from,
					date: short
				})}
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
/* A pause grip pulled onto the other one                               */
/* ------------------------------------------------------------------ */

export type PauseAction = 'delete' | 'move';

export interface PauseMenuContentProps {
	day: Date;
	/** The pause now. */
	pause: TimeWindow;
	/** Where "verschieben" puts it; none when it cannot move. */
	movedTo: TimeWindow | null;
	scope: EdgeChoice;
	onScope: (scope: EdgeChoice) => void;
	onChoose: (action: PauseAction) => void;
}

/**
 * "Pause löschen" or "Pause verschieben auf …", for this day or every
 * such weekday (Frank, prototype v16).
 */
export const PauseMenuContent = ({
	day,
	pause,
	movedTo,
	scope,
	onScope,
	onChoose
}: PauseMenuContentProps) => {
	const { t, i18n } = useTranslation();
	const locale = calendarLocale(i18n.language);
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
	return (
		<>
			<ChatMenuDropdownHeader
				title={t('calendar.grip.pauseTitle', {
					start: pause.start,
					end: pause.end
				})}
				subtitle={short}
				titleAs="p"
			/>
			<ChatMenuDropdownItem
				role="menuitem"
				icon={<DeleteOutlineIcon fontSize="small" />}
				title={t('calendar.grip.pauseDelete')}
				onClick={() => onChoose('delete')}
				data-cy="calendar-pause-delete"
			/>
			{movedTo && (
				<ChatMenuDropdownItem
					role="menuitem"
					icon={<ScheduleOutlinedIcon fontSize="small" />}
					title={t('calendar.grip.pauseMove', {
						start: movedTo.start,
						end: movedTo.end
					})}
					description={t('calendar.grip.pauseMoveHint')}
					onClick={() => onChoose('move')}
					data-cy="calendar-pause-move"
				/>
			)}
			<ChatMenuDropdownDivider />
			<ChatMenuDropdownGroupLabel>
				{t('calendar.grip.pauseScope')}
			</ChatMenuDropdownGroupLabel>
			<ChatMenuDropdownItem
				role="menuitemradio"
				aria-checked={scope === 'day'}
				active={scope === 'day'}
				icon={<Check on={scope === 'day'} />}
				title={t('calendar.grip.onlyThisDay')}
				description={long}
				onClick={() => onScope('day')}
				data-cy="calendar-pause-scope-day"
			/>
			<ChatMenuDropdownItem
				role="menuitemradio"
				aria-checked={scope === 'week'}
				active={scope === 'week'}
				icon={<Check on={scope === 'week'} />}
				title={t('calendar.grip.always', {
					weekdays: t(`calendar.grip.weekdays.${day.getDay()}`)
				})}
				description={t('calendar.grip.alwaysHint')}
				onClick={() => onScope('week')}
				data-cy="calendar-pause-scope-week"
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

/** One icon per view, in the menu, on the view button and the digits row. */
export const VIEW_ICON: Record<CalendarViewName, React.ReactNode> = {
	day: <ViewDayIcon fontSize="small" />,
	threeDays: <ViewWeekIcon fontSize="small" />,
	workWeek: <ViewWeekIcon fontSize="small" />,
	week: <ViewWeekIcon fontSize="small" />,
	month: <GridViewOutlinedIcon fontSize="small" />,
	list: <ListIcon fontSize="small" />,
	split: <ViewColumnIcon fontSize="small" />
};

/**
 * A menu row with something at its right end: the check of the chosen
 * view, or the date a quick jump goes to (prototype v17).
 */
const MetaRow = ({
	icon,
	title,
	meta,
	description
}: {
	icon?: React.ReactNode;
	title: React.ReactNode;
	meta?: React.ReactNode;
	description?: React.ReactNode;
}) => (
	<>
		{icon && <span className="chatMenuDropdown__itemIcon">{icon}</span>}
		<span className="chatMenuDropdown__itemCenter">
			<span className="chatMenuDropdown__itemTitleRow">
				<span className="chatMenuDropdown__itemTitle">{title}</span>
				{meta && <span className="calendarMenuMeta">{meta}</span>}
			</span>
			{description && (
				<span className="chatMenuDropdown__itemDescription">
					{description}
				</span>
			)}
		</span>
	</>
);

export const ViewMenuContent = ({
	views,
	current,
	onChoose
}: ViewMenuContentProps) => {
	const { t } = useTranslation();
	return (
		<>
			{views.map((view) => (
				<React.Fragment key={view}>
					{/* "Nebeneinander" is a view of another kind: a line before it. */}
					{view === 'split' && <ChatMenuDropdownDivider />}
					<ChatMenuDropdownItem
						role="menuitemradio"
						aria-checked={view === current}
						active={view === current}
						onClick={() => onChoose(view)}
						data-cy={`calendar-view-${view}`}
					>
						<MetaRow
							icon={VIEW_ICON[view]}
							title={t(`calendar.views.${view}`)}
							meta={
								view === current ? (
									<CheckIcon fontSize="small" aria-hidden />
								) : undefined
							}
							description={
								view === 'split'
									? t('calendar.split.label')
									: undefined
							}
						/>
					</ChatMenuDropdownItem>
				</React.Fragment>
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
	const { t, i18n } = useTranslation();
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
		['dayAfterTomorrow', plus(2)],
		['nextMonday', nextMonday],
		['inTwoWeeks', plus(14)]
	];
	// Each jump says where it lands: "Mo., 16.11." (prototype v17).
	const dayFormat = new Intl.DateTimeFormat(calendarLocale(i18n.language), {
		weekday: 'short',
		day: '2-digit',
		month: '2-digit'
	});
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
						onClick={() => onJump(date)}
						data-cy={`calendar-jump-${key}`}
					>
						<MetaRow
							title={t(`calendar.jump.${key}`)}
							meta={dayFormat.format(date)}
						/>
					</ChatMenuDropdownItem>
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
	/** "Ganze Beratungsstelle zeigen": every colleague of one's own centre. */
	onShowAll?: (ids: string[]) => void;
	/** "Nebeneinander ansehen". */
	onSideBySide?: () => void;
}

/** A tick box, an avatar and a name: one person in "Kalender anzeigen". */
const PersonRow = ({
	on,
	name,
	avatar,
	toneClass
}: {
	on: boolean;
	name: string;
	avatar: string;
	toneClass: string;
}) => (
	<>
		<span
			className={`calendarPeopleMenu__check${on ? ' calendarPeopleMenu__check--on' : ''}`}
			aria-hidden="true"
		>
			{on && <CheckIcon />}
		</span>
		<span
			className={`calendarPeopleMenu__avatar ${toneClass}`}
			aria-hidden="true"
		>
			{avatar}
		</span>
		<span className="chatMenuDropdown__itemTitle">{name}</span>
	</>
);

/**
 * "Kalender anzeigen" (prototype v17): one's own calendar, always on, then
 * the colleagues by Beratungsstelle, the whole own centre at once, the
 * side-by-side view and what the Träger lets one see.
 */
export const PeopleMenuContent = ({
	colleagues,
	shown,
	scopeHint,
	onToggle,
	onShowAll,
	onSideBySide
}: PeopleMenuContentProps) => {
	const { t } = useTranslation();
	const groups = useMemo(() => {
		const byAgency = new Map<string, Colleague[]>();
		colleagues.forEach((c) =>
			byAgency.set(c.agencyName, [
				...(byAgency.get(c.agencyName) ?? []),
				c
			])
		);
		return [...byAgency.entries()];
	}, [colleagues]);
	const ownCentre = colleagues.filter((c) => c.relation === 'sameAgency');
	return (
		<>
			<div className="calendarPeopleMenu__head" role="presentation">
				<strong>{t('calendar.people.label')}</strong>
				<span>{t('calendar.people.alwaysMine')}</span>
			</div>
			<ChatMenuDropdownItem
				role="menuitemcheckbox"
				aria-checked={true}
				disabled
				data-cy="calendar-people-me"
			>
				<PersonRow
					on
					name={t('navigation.booking.events')}
					avatar={t('calendar.people.meAvatar')}
					toneClass={avatarToneClass('', true)}
				/>
			</ChatMenuDropdownItem>
			{colleagues.length === 0 && (
				<ChatMenuDropdownNote>
					{t('calendar.colleaguesEmpty')}
				</ChatMenuDropdownNote>
			)}
			{groups.map(([agency, people]) => (
				<React.Fragment key={agency}>
					<ChatMenuDropdownGroupLabel>
						{[
							agency,
							people[0].agencyShort,
							people[0].relation === 'sameTenant' &&
								t('calendar.people.sameTenant')
						]
							.filter(Boolean)
							.join(' · ')}
					</ChatMenuDropdownGroupLabel>
					{people.map((c) => {
						const on = shown.includes(c.id);
						return (
							<ChatMenuDropdownItem
								key={c.id}
								role="menuitemcheckbox"
								aria-checked={on}
								active={on}
								onClick={() => onToggle(c.id)}
								data-cy={`calendar-people-${c.id}`}
							>
								<PersonRow
									on={on}
									name={c.displayName}
									avatar={initialsOf(c.displayName)}
									toneClass={avatarToneClass(c.displayName)}
								/>
							</ChatMenuDropdownItem>
						);
					})}
				</React.Fragment>
			))}
			{((onShowAll && ownCentre.length > 0) || onSideBySide) && (
				<ChatMenuDropdownDivider />
			)}
			{onShowAll && ownCentre.length > 0 && (
				<ChatMenuDropdownItem
					role="menuitem"
					icon={<GroupsOutlinedIcon />}
					title={t('calendar.people.wholeAgency')}
					description={ownCentre[0].agencyName}
					onClick={() => onShowAll(ownCentre.map((c) => c.id))}
					data-cy="calendar-people-whole-agency"
				/>
			)}
			{onSideBySide && (
				<ChatMenuDropdownItem
					role="menuitem"
					icon={<ViewColumnIcon />}
					title={t('calendar.people.split')}
					onClick={onSideBySide}
					data-cy="calendar-people-split"
				/>
			)}
			{scopeHint && (
				<ChatMenuDropdownNote>{scopeHint}</ChatMenuDropdownNote>
			)}
		</>
	);
};
