/**
 * The "Meine Termine" section (navigation entry `/booking/events`), rebuilt
 * as the counsellor calendar of ADR-032 and FE#1050. It replaces the old
 * cal.com booking list once Frank has accepted it in Storybook.
 *
 * Purely presentational: entries, colleagues, feed and import come in as
 * props, every change goes out as a callback. The container that talks to
 * UserService is written after the acceptance (spec FE#2249).
 */
import * as React from 'react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import AddIcon from '@mui/icons-material/Add';
import SyncOutlinedIcon from '@mui/icons-material/SyncOutlined';
import { CircularProgress, IconButton, Tooltip } from '@mui/material';
import { ReactComponent as CalendarIcon } from '../../resources/img/icons/calendar_outline.svg';
import { FilterChipRow } from '../displayFilter/FilterChipRow';
import { FilterChip } from '../displayFilter/FilterChip';
import { M3Snackbar } from '../m3Snackbar/M3Snackbar';
import {
	DEFAULT_VISIBILITY,
	isSoon,
	upcomingEntries,
	type AppointmentDraft,
	type AppointmentKind,
	type CalendarConversation,
	type CalendarEntry,
	type CalendarRole,
	type CalendarVisibility,
	type Colleague
} from './calendarModel';
import {
	CALENDAR_FACETS,
	CalendarEntryGlyph,
	FACET_ICON_COMPONENT,
	facetOf,
	type CalendarEntryFacet
} from './CalendarEntryGlyph';
import { CalendarView, type CalendarViewName } from './CalendarView';
import { SlotActionMenu, type SlotChoice } from './SlotActionMenu';
import { AppointmentDialog } from './AppointmentDialog';
import { BlockerDialog } from './BlockerDialog';
import { EntryDetailsDialog } from './EntryDetailsDialog';
import {
	CalendarSyncDialog,
	type CalendarFeed,
	type CalendarImport
} from './CalendarSyncDialog';
import { useEntryLabel, useRangeFormat } from './useEntryLabel';
import { useLiveNow } from './useLiveNow';
import '../sessionsList/sessionsList.styles.scss';
import './calendar.styles.scss';

export type CalendarLoadState = 'loading' | 'ready' | 'error';

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
	compact?: boolean;
	initialView?: CalendarViewName;
	now?: Date;
	onCreate?: (drafts: AppointmentDraft[]) => void;
	/**
	 * The snackbar offers to undo by moving it back. `false` refuses the
	 * move and puts the entry back.
	 */
	onMove?: (entry: CalendarEntry, start: Date, end: Date) => void | boolean;
	onCancelAppointment?: (entry: CalendarEntry) => void;
	onRemoveBlocker?: (entry: CalendarEntry) => void;
	onStart?: (entry: CalendarEntry) => void;
	onCopyFeed?: (url: string) => void;
	onResetFeed?: () => void;
	onSaveImport?: (url: string) => void;
	onRemoveImport?: () => void;
	onRetry?: () => void;
}

type Dialog =
	| {
			type: 'appointment';
			slot?: { start: Date; end: Date; kind: AppointmentKind };
	  }
	| { type: 'blocker'; slot?: { start: Date; end: Date } }
	| { type: 'details'; entry: CalendarEntry }
	| { type: 'sync' }
	| null;

interface Notice {
	message: string;
	undo?: () => void;
}

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
	compact = false,
	initialView,
	now: fixedNow,
	onCreate,
	onMove,
	onCancelAppointment,
	onRemoveBlocker,
	onStart,
	onCopyFeed,
	onResetFeed,
	onSaveImport,
	onRemoveImport,
	onRetry
}: CalendarPageProps) => {
	const { t } = useTranslation();
	const label = useEntryLabel();
	const format = useRangeFormat();
	const now = useLiveNow(fixedNow);
	const consultant = role === 'consultant';
	// Like the session list chips: none selected shows everything, selected
	// chips narrow the calendar to those kinds.
	const [onlyFacets, setOnlyFacets] = useState<CalendarEntryFacet[]>([]);
	const [shownColleagues, setShownColleagues] = useState<string[]>([]);
	const [slot, setSlot] = useState<{
		range: { start: Date; end: Date };
		anchor: { x: number; y: number };
	} | null>(null);
	const [dialog, setDialog] = useState<Dialog>(null);
	const [notice, setNotice] = useState<Notice | null>(null);

	const colleagueNames = useMemo(
		() => Object.fromEntries(colleagues.map((c) => [c.id, c.displayName])),
		[colleagues]
	);
	const visible = useMemo(
		() =>
			entries.filter(
				(e) =>
					(e.ownerId === ownerId ||
						shownColleagues.includes(e.ownerId)) &&
					(onlyFacets.length === 0 || onlyFacets.includes(facetOf(e)))
			),
		[entries, ownerId, shownColleagues, onlyFacets]
	);
	// A selected facet stays on offer after its entries are gone, so the
	// filter can always be cleared.
	const presentFacets = CALENDAR_FACETS.filter(
		(facet) =>
			onlyFacets.includes(facet) ||
			entries.some((e) => e.ownerId === ownerId && facetOf(e) === facet)
	);
	const upcoming = upcomingEntries(entries, ownerId, now);

	const toggle = <T,>(list: T[], item: T) =>
		list.includes(item) ? list.filter((x) => x !== item) : [...list, item];

	const choose = (choice: SlotChoice) => {
		if (!slot) return;
		const range = slot.range;
		setSlot(null);
		setDialog(
			choice === 'blocker'
				? { type: 'blocker', slot: range }
				: { type: 'appointment', slot: { ...range, kind: choice } }
		);
	};

	const create = (drafts: AppointmentDraft[]) => {
		onCreate?.(drafts);
		setDialog(null);
		const first = drafts[0];
		setNotice({
			// One blocker names its date; a series its count (Russian "one"
			// also covers 21, 31 …, so a series never uses the single text).
			message:
				first.type === 'blocker'
					? drafts.length === 1
						? t('calendar.blocker.createdSingle', {
								date: format(first.start, first.end)
							})
						: t('calendar.blocker.created', {
								count: drafts.length,
								date: format(first.start, first.end)
							})
					: t('calendar.created', {
							date: format(first.start, first.end)
						})
		});
	};

	const move = (entry: CalendarEntry, start: Date, end: Date) => {
		if (onMove?.(entry, start, end) === false) return false;
		setNotice({
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
		return true;
	};

	const addButton = consultant && (
		<Tooltip title={t('calendar.create')}>
			<button
				type="button"
				className="calendarPage__create"
				aria-label={t('calendar.create')}
				onClick={() => setDialog({ type: 'appointment' })}
				data-cy="calendar-create"
			>
				<AddIcon />
			</button>
		</Tooltip>
	);

	const syncButton = consultant && feed && (
		<IconButton
			aria-label={t('calendar.sync')}
			onClick={() => setDialog({ type: 'sync' })}
			data-cy="calendar-sync"
		>
			<SyncOutlinedIcon />
		</IconButton>
	);

	const filters = (presentFacets.length > 1 || onlyFacets.length > 0) && (
		<FilterChipRow
			label={t('calendar.filterLabel')}
			className="calendarPage__filters"
		>
			{presentFacets.map((facet) => (
				<FilterChip
					key={facet}
					label={t(`calendar.facets.${facet}`)}
					icon={FACET_ICON_COMPONENT[facet]}
					active={onlyFacets.includes(facet)}
					onClick={() => setOnlyFacets((all) => toggle(all, facet))}
					data-cy={`calendar-filter-${facet}`}
				/>
			))}
		</FilterChipRow>
	);

	const side = !compact && (
		<aside
			className="calendarPage__side"
			aria-label={t('calendar.upcoming')}
		>
			<section className="calendarPage__section">
				<h2 className="calendarPage__sectionTitle">
					{t('calendar.upcoming')}
				</h2>
				{upcoming.length === 0 ? (
					<p className="calendarPage__muted">
						{t('calendar.upcomingEmpty')}
					</p>
				) : (
					<ul className="calendarPage__upcoming">
						{upcoming.map((entry) => (
							<li key={entry.id}>
								<button
									type="button"
									className={`calendarPage__entry${isSoon(entry, now) ? ' calendarPage__entry--soon' : ''}`}
									onClick={() =>
										setDialog({ type: 'details', entry })
									}
								>
									<span className="calendarPage__entryIcon">
										<CalendarEntryGlyph entry={entry} />
									</span>
									<span className="calendarPage__entryText">
										<span className="calendarPage__entryTime">
											{format(entry.start, entry.end)}
										</span>
										<span className="calendarPage__entryTitle">
											{label(entry)}
										</span>
									</span>
								</button>
							</li>
						))}
					</ul>
				)}
			</section>
			{consultant && (
				<section className="calendarPage__section">
					<h2 className="calendarPage__sectionTitle">
						{t('calendar.calendars')}
					</h2>
					<ul className="calendarPage__calendars">
						<li>
							<label className="calendarPage__calendar">
								<input type="checkbox" checked disabled />
								<span>{t('calendar.myCalendar')}</span>
							</label>
						</li>
						{colleagues.map((c) => (
							<li key={c.id}>
								<label className="calendarPage__calendar">
									<input
										type="checkbox"
										checked={shownColleagues.includes(c.id)}
										onChange={() =>
											setShownColleagues((all) =>
												toggle(all, c.id)
											)
										}
										data-cy={`calendar-colleague-${c.id}`}
									/>
									<span>
										{c.displayName}
										<span className="calendarPage__muted">
											{' '}
											· {c.agencyName}
										</span>
									</span>
								</label>
							</li>
						))}
					</ul>
					<p className="calendarPage__muted calendarPage__hint">
						{colleagues.length === 0
							? t('calendar.colleaguesEmpty')
							: t(`calendar.scopeHint.${visibility.scope}`)}
					</p>
				</section>
			)}
		</aside>
	);

	let body: React.ReactNode;
	if (state === 'loading')
		body = (
			<div className="calendarPage__status" aria-busy="true">
				<CircularProgress
					size={32}
					aria-label={t('calendar.loading')}
				/>
			</div>
		);
	else if (state === 'error')
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
			<CalendarView
				role={role}
				ownerId={ownerId}
				entries={visible}
				colleagueNames={colleagueNames}
				compact={compact}
				initialView={initialView}
				now={fixedNow}
				onSelectRange={(range, anchor) => setSlot({ range, anchor })}
				onEntryClick={(entry) => setDialog({ type: 'details', entry })}
				onEntryMove={move}
				toolbarEnd={
					<>
						{filters}
						{syncButton}
					</>
				}
			/>
		);

	return (
		<div
			className={`calendarPage${compact ? ' calendarPage--compact' : ''}`}
			data-testid="calendar-page"
		>
			<header className="calendarPage__header">
				<CalendarIcon
					className="calendarPage__headerIcon"
					aria-hidden="true"
				/>
				<h1 className="calendarPage__title">
					{t('navigation.booking.events')}
				</h1>
				{addButton}
			</header>
			<div className="calendarPage__body">
				{side}
				<div className="calendarPage__main">{body}</div>
			</div>

			<SlotActionMenu
				range={slot?.range ?? null}
				anchor={slot?.anchor ?? { x: 0, y: 0 }}
				onChoose={choose}
				onClose={() => setSlot(null)}
			/>
			{dialog?.type === 'appointment' && (
				<AppointmentDialog
					open
					slot={dialog.slot}
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
			{dialog?.type === 'details' && (
				<EntryDetailsDialog
					entry={dialog.entry}
					role={role}
					ownerId={ownerId}
					colleagueName={colleagueNames[dialog.entry.ownerId]}
					fullScreen={compact}
					onStart={(entry) => {
						setDialog(null);
						onStart?.(entry);
					}}
					onCancelAppointment={(entry) => {
						setDialog(null);
						onCancelAppointment?.(entry);
						setNotice({ message: t('calendar.cancelled') });
					}}
					onRemoveBlocker={(entry) => {
						setDialog(null);
						onRemoveBlocker?.(entry);
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
									onClick: () => {
										notice.undo?.();
										setNotice(null);
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
