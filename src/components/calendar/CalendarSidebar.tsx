/**
 * The left column of "Meine Termine", built like the one of "Gespräche"
 * (Frank's prototype, 2026-11-14): search with the display filter on its
 * left, the kind chips, open requests, "Als Nächstes", quick entry and the
 * working hours. On a phone the same column fills the bottom sheet; the
 * kind chips are then in the stage and quick entry folds behind a "+".
 */
import * as React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Popper, TextField } from '@mui/material';
import dayjs from 'dayjs';
import AddIcon from '@mui/icons-material/Add';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import { ListSearchField } from '../listSearchField/ListSearchField';
import { FilterChipRow } from '../displayFilter/FilterChipRow';
import { FilterChip } from '../displayFilter/FilterChip';
import { DisplayFilterButton } from '../displayFilter/DisplayFilterButton';
import { OrisoDatePicker } from '../form/OrisoDatePicker';
import { OrisoTimePicker } from '../form/OrisoTimePicker';
import { OrisoSelect } from '../form/OrisoSelect';
import { orisoTextFieldSx } from '../form/orisoInputDesign';
import {
	upcomingEntries,
	type AppointmentDraft,
	type CalendarConversation,
	type CalendarEntry,
	type Colleague
} from './calendarModel';
import {
	CALENDAR_FACETS,
	CalendarEntryGlyph,
	FACET_ICON_COMPONENT,
	FacetIcon,
	facetOf,
	type CalendarEntryFacet
} from './CalendarEntryGlyph';
import type { MoveProposal } from './calendarActions';
import { nextFreeHours } from './calendarFreeTime';
import {
	DEFAULT_QUICK_DURATION,
	QUICK_DURATIONS,
	dateField,
	fieldsFromEntry,
	parseQuickEntry,
	quickEntryGaps,
	rangeFromFields,
	timeField,
	type QuickDuration,
	type QuickFields,
	type QuickKind
} from './calendarQuickEntry';
import { useShortTime } from './calendarShortTime';
import type { WorkingHours, WorkingPlan } from './calendarWorkingHours';
import { CalendarEntryPeek, initialsOf } from './CalendarEntryPeek';
import { calendarLocale } from './calendarLocale';
import type { CalendarListMode } from './calendarPreferences';
import { useEntryLabel, useRangeFormat } from './useEntryLabel';

const QUICK_KINDS: QuickKind[] = [
	'video',
	'phone',
	'onsite',
	'chat',
	'blocker'
];
const MAX_UPCOMING = 5;
const MAX_SEARCH_RESULTS = 8;

/** What creating from the quick entry reports (see `onCreate`). */
export type QuickCreateResult = void | boolean | Promise<unknown>;

/**
 * Whether the entries the next free hours come from (this week's own) are
 * in: `loading` and `failed` offer none, `failed` with a retry.
 */
export type FreeHoursState = 'ready' | 'loading' | 'failed';

export interface CalendarSidebarProps {
	ownerId: string;
	consultant: boolean;
	now: Date;
	/** Every loaded entry (own and colleagues'). */
	entries: CalendarEntry[];
	colleagues: Colleague[];
	conversations: CalendarConversation[];
	/** Weekly hours or the whole plan (exceptions, holidays). */
	workingHours: WorkingHours | WorkingPlan;
	/** One line, e.g. "Mo–Fr 08:00–18:00"; absent = none set. */
	workingHoursSummary?: string;
	onlyFacets: CalendarEntryFacet[];
	hiddenFacets: CalendarEntryFacet[];
	onToggleFacet: (facet: CalendarEntryFacet) => void;
	onHighlightFacet: (facet: CalendarEntryFacet | null) => void;
	kindsMenuOpen: boolean;
	onOpenKinds: (anchor: HTMLElement) => void;
	openProposals: { proposal: MoveProposal; entry: CalendarEntry }[];
	onOpenProposal?: (
		proposal: MoveProposal,
		entry: CalendarEntry,
		anchor: HTMLElement
	) => void;
	onWithdrawProposal?: (proposal: MoveProposal) => void;
	onOpenEntry: (entry: CalendarEntry, anchor: HTMLElement) => void;
	/**
	 * "Zum Chat mit …" beside an upcoming appointment that has a
	 * conversation (Frank, prototype v15); without it there is no button.
	 */
	onOpenChat?: (entry: CalendarEntry) => void;
	/** Colleagues shown: search finds their entries too. */
	shownColleagues: string[];
	/**
	 * `false`, or a promise that rejects or resolves to `false`, means it
	 * was not created: the quick entry keeps its draft.
	 */
	onCreate?: (drafts: AppointmentDraft[]) => QuickCreateResult;
	/** This week's own entries are in: see {@link FreeHoursState}. */
	freeHoursState?: FreeHoursState;
	onRetryFreeHours?: () => void;
	/** "Mehr Angaben …": the full dialog with what the line already says. */
	onMoreDetails?: (draft: {
		kind?: QuickKind;
		start?: Date;
		end?: Date;
		sessionId?: number;
	}) => void;
	onWorkingHours?: () => void;
	/** `sheet`: the phone's bottom sheet (no kind chips, quick entry folded). */
	variant?: 'column' | 'sheet';
	/** Sheet: quick entry is unfolded. */
	quickOpen?: boolean;
	onQuickToggle?: () => void;
	/**
	 * How wide the column is (Frank, prototype v15): `compact` leaves out
	 * quick entry and the working hours, `rail` shows avatar and start
	 * time per appointment.
	 */
	mode?: CalendarListMode;
	/** The scrolling column, for the grip's Up and Down keys. */
	scrollRef?: React.Ref<HTMLElement>;
	/** "+" in the narrow column: open it wide with quick entry ready. */
	onWiden?: () => void;
	/** Counts up to focus the quick entry line. */
	quickFocus?: number;
}

export const CalendarSidebar = ({
	ownerId,
	consultant,
	now,
	entries,
	colleagues,
	conversations,
	workingHours,
	workingHoursSummary,
	onlyFacets,
	hiddenFacets,
	onToggleFacet,
	onHighlightFacet,
	kindsMenuOpen,
	onOpenKinds,
	openProposals,
	onOpenProposal,
	onWithdrawProposal,
	onOpenEntry,
	onOpenChat,
	shownColleagues,
	onCreate,
	freeHoursState,
	onRetryFreeHours,
	onMoreDetails,
	onWorkingHours,
	variant = 'column',
	quickOpen = false,
	onQuickToggle,
	mode = 'full',
	scrollRef,
	onWiden,
	quickFocus
}: CalendarSidebarProps) => {
	const sheet = variant === 'sheet';
	const rail = !sheet && mode === 'rail';
	const narrow = !sheet && mode !== 'full';
	const { t, i18n } = useTranslation();
	const clock = useMemo(
		() =>
			new Intl.DateTimeFormat(calendarLocale(i18n.language), {
				hour: '2-digit',
				minute: '2-digit'
			}),
		[i18n.language]
	);
	const label = useEntryLabel();
	const format = useRangeFormat();
	const shortTime = useShortTime();
	const colleagueById = useMemo(
		() => Object.fromEntries(colleagues.map((c) => [c.id, c])),
		[colleagues]
	);
	const own = entries.filter((e) => e.ownerId === ownerId);

	// --- Als Nächstes: nearest at the bottom, next to the quick entry ---
	const upcoming = upcomingEntries(
		own.filter((e) => !hiddenFacets.includes(facetOf(e))),
		ownerId,
		now,
		MAX_UPCOMING
	).reverse();
	const [peek, setPeek] = useState<{
		el: HTMLElement;
		entry: CalendarEntry;
	} | null>(null);

	const kindsButton = (
		<CalendarKindsButton
			customised={hiddenFacets.length > 0}
			open={kindsMenuOpen}
			onOpen={onOpenKinds}
		/>
	);
	/** The rail: who (initials) and when (start time), nothing else. */
	const railFace = (who: string, start: Date | string) => (
		<>
			<span className="calendarSide__railAvatar" aria-hidden="true">
				{initialsOf(who)}
			</span>
			<span className="calendarSide__railClock" aria-hidden="true">
				{clock.format(new Date(start))}
			</span>
		</>
	);

	return (
		<aside
			ref={scrollRef}
			className={[
				'calendarSide',
				sheet && 'calendarSide--sheet',
				narrow && `calendarSide--${mode}`
			]
				.filter(Boolean)
				.join(' ')}
			aria-label={sheet ? undefined : t('calendar.side.label')}
			data-cy="calendar-side"
		>
			{/* As in "Gespräche": the display filter sits at the left of the
			    search field (Frank, 2026-11-14); the rail keeps only it. */}
			{/* On the phone and the tablet the search sits at the very top of
			    the calendar instead (Frank, prototype v15). */}
			{rail
				? kindsButton
				: !sheet && (
						<CalendarSearch
							ownerId={ownerId}
							entries={entries}
							colleagues={colleagues}
							shownColleagues={shownColleagues}
							onOpenEntry={onOpenEntry}
							leading={kindsButton}
						/>
					)}

			{!sheet && !rail && (
				<CalendarKindChips
					ownerId={ownerId}
					now={now}
					entries={entries}
					onlyFacets={onlyFacets}
					hiddenFacets={hiddenFacets}
					onToggleFacet={onToggleFacet}
					onHighlightFacet={onHighlightFacet}
					className="calendarSide__chips"
				/>
			)}

			{openProposals.length > 0 && (
				<section className="calendarSide__section">
					<h2 className="calendarSide__title">
						{t('calendar.proposal.open')}
					</h2>
					<ul className="calendarSide__list">
						{openProposals.map(({ proposal, entry }) => (
							<li
								key={proposal.id}
								className="calendarSide__request"
								data-cy={`calendar-request-${proposal.id}`}
							>
								<button
									type="button"
									className={`calendarSide__row calendarSide__row--proposal calendarSide__row--k-${facetOf(entry)}`}
									aria-label={
										rail
											? `${t('calendar.proposal.title', {
													title: label(entry, true)
												})}, ${format(proposal.start, proposal.end)}`
											: undefined
									}
									onClick={(e) =>
										onOpenProposal?.(
											proposal,
											entry,
											e.currentTarget
										)
									}
								>
									{rail &&
										railFace(
											label(entry, true),
											proposal.start
										)}
									<span className="calendarSide__rowIcon">
										<CalendarEntryGlyph
											entry={entry}
											colleague
										/>
									</span>
									<span className="calendarSide__rowText">
										<span className="calendarSide__rowName">
											{t('calendar.proposal.title', {
												title: label(entry, true)
											})}
										</span>
										<span className="calendarSide__rowMeta">
											{format(
												proposal.start,
												proposal.end
											)}{' '}
											·{' '}
											{t('calendar.proposal.waitingFor', {
												name:
													colleagueById[entry.ownerId]
														?.displayName ?? ''
											})}
										</span>
									</span>
								</button>
								{onWithdrawProposal && !rail && (
									<button
										type="button"
										className="calendarSide__textButton"
										onClick={() =>
											onWithdrawProposal(proposal)
										}
										data-cy={`calendar-request-withdraw-${proposal.id}`}
									>
										{t('calendar.proposal.withdraw')}
									</button>
								)}
							</li>
						))}
					</ul>
				</section>
			)}

			{/* Not on the phone and the tablet: the calendar shows what is
			    next (Frank, prototype v15). */}
			{!sheet && (
				<section className="calendarSide__section">
					<h2 className="calendarSide__title">
						{t('calendar.upcoming')}
					</h2>
					{upcoming.length === 0 ? (
						<p className="calendarSide__muted">
							{t('calendar.upcomingEmpty')}
						</p>
					) : (
						<ul
							className="calendarSide__list"
							data-cy="calendar-upcoming"
						>
							{upcoming.map((entry) => (
								<li
									key={entry.id}
									className="calendarSide__upcoming"
								>
									<button
										type="button"
										className={`calendarSide__row calendarSide__row--k-${facetOf(entry)}`}
										aria-describedby={
											peek?.entry.id === entry.id
												? 'calendar-upcoming-peek'
												: undefined
										}
										onMouseEnter={(e) =>
											setPeek({
												el: e.currentTarget,
												entry
											})
										}
										onMouseLeave={() => setPeek(null)}
										onFocus={(e) =>
											setPeek({
												el: e.currentTarget,
												entry
											})
										}
										onBlur={() => setPeek(null)}
										onClick={(e) => {
											setPeek(null);
											onOpenEntry(entry, e.currentTarget);
										}}
										aria-label={
											rail
												? `${label(entry)}, ${shortTime(
														new Date(entry.start),
														now,
														new Date(entry.end)
													)}`
												: undefined
										}
										data-cy={`calendar-upcoming-${entry.id}`}
									>
										{rail &&
											railFace(label(entry), entry.start)}
										<span className="calendarSide__rowIcon">
											<CalendarEntryGlyph entry={entry} />
										</span>
										<span className="calendarSide__rowName">
											{label(entry)}
										</span>
										<span className="calendarSide__rowTime">
											{shortTime(
												new Date(entry.start),
												now,
												new Date(entry.end)
											)}
										</span>
									</button>
									{onOpenChat &&
										!rail &&
										entry.type === 'appointment' &&
										entry.sessionId !== undefined && (
											<button
												type="button"
												className="calendarSide__chat"
												aria-label={t(
													'calendar.upcomingChat',
													{ name: label(entry) }
												)}
												title={t(
													'calendar.upcomingChat',
													{
														name: label(entry)
													}
												)}
												onClick={() =>
													onOpenChat(entry)
												}
												data-cy={`calendar-upcoming-chat-${entry.id}`}
											>
												<ChatBubbleOutlineIcon fontSize="small" />
											</button>
										)}
								</li>
							))}
						</ul>
					)}
					<Popper
						open={!!peek}
						anchorEl={peek?.el}
						placement="right-start"
						className="calendarPeekPopper"
						id="calendar-upcoming-peek"
						modifiers={[
							{ name: 'offset', options: { offset: [0, 8] } }
						]}
					>
						{/* Popper's root is the `role="tooltip"` the row points at. */}
						{peek && (
							<CalendarEntryPeek entry={peek.entry} clickHint />
						)}
					</Popper>
				</section>
			)}

			{consultant && onCreate && sheet && (
				<div className="calendarSide__quickRow">
					<span className="calendarSide__title">
						{t('calendar.quick.title')}
					</span>
					<button
						type="button"
						className="calendarSide__quickToggle"
						aria-expanded={quickOpen}
						aria-controls="calendar-quick-panel"
						aria-label={
							quickOpen
								? t('calendar.quick.close')
								: t('calendar.quick.title')
						}
						onClick={onQuickToggle}
						data-cy="calendar-quick-toggle"
					>
						<AddIcon fontSize="small" />
					</button>
				</div>
			)}
			{consultant && onCreate && narrow && onWiden && (
				<div className="calendarSide__quickRow">
					<span className="calendarSide__title">
						{t('calendar.quick.title')}
					</span>
					<button
						type="button"
						className="calendarSide__quickToggle"
						aria-label={t('calendar.quick.title')}
						onClick={onWiden}
						data-cy="calendar-quick-widen"
					>
						<AddIcon fontSize="small" />
					</button>
				</div>
			)}
			{/* Folded on the phone or in the narrow column it stays mounted,
			    so the draft survives. */}
			{consultant && onCreate && (
				<div
					id="calendar-quick-panel"
					className="calendarSide__quick"
					hidden={(sheet && !quickOpen) || narrow}
				>
					<QuickEntry
						ownerId={ownerId}
						now={now}
						entries={entries}
						conversations={conversations}
						workingHours={workingHours}
						onCreate={onCreate}
						freeHours={freeHoursState}
						onRetryFreeHours={onRetryFreeHours}
						onMoreDetails={onMoreDetails}
						autoFocus={sheet && quickOpen}
						focusSignal={quickFocus}
						hideTitle={sheet}
					/>
				</div>
			)}

			{/* On the phone and the tablet the hours live in ⋮. */}
			{consultant && onWorkingHours && !narrow && !sheet && (
				<button
					type="button"
					className="calendarSide__hours"
					onClick={onWorkingHours}
					data-cy="calendar-working-hours"
				>
					{workingHoursSummary
						? t('calendar.workingHours.summary', {
								hours: workingHoursSummary
							})
						: t('calendar.workingHours.none')}
					<span className="calendarSide__hoursAction">
						{workingHoursSummary
							? t('calendar.workingHours.change')
							: t('calendar.workingHours.set')}
					</span>
				</button>
			)}
		</aside>
	);
};

/* ------------------------------------------------------------------ */

/** "Was anzeigen", the display filter at the left of the search field. */
export const CalendarKindsButton = ({
	customised,
	open,
	onOpen
}: {
	customised: boolean;
	open: boolean;
	onOpen: (anchor: HTMLElement) => void;
}) => {
	const { t } = useTranslation();
	const anchor = useRef<HTMLSpanElement>(null);
	return (
		<span ref={anchor} className="calendarSide__kindsAnchor">
			<DisplayFilterButton
				label={t('calendar.kindsMenu.label')}
				customised={customised}
				customisedLabel={t('calendar.kindsMenu.customised')}
				open={open}
				onClick={() => anchor.current && onOpen(anchor.current)}
				compact
				data-cy="calendar-kinds-button"
			/>
		</span>
	);
};

export interface CalendarSearchProps {
	ownerId: string;
	/** Every loaded entry (own and colleagues'). */
	entries: CalendarEntry[];
	colleagues: Colleague[];
	/** Colleagues shown: search finds their entries too. */
	shownColleagues: string[];
	onOpenEntry: (entry: CalendarEntry, anchor: HTMLElement) => void;
	/** At the left of the field (the display filter in the column). */
	leading?: React.ReactNode;
	/** The results float over what is below (top of the calendar). */
	floating?: boolean;
}

/**
 * Search in one's own and the shown colleagues' entries: in the left
 * column on a wide screen, at the very top of the calendar on the phone
 * and the tablet.
 */
export const CalendarSearch = ({
	ownerId,
	entries,
	colleagues,
	shownColleagues,
	onOpenEntry,
	leading,
	floating = false
}: CalendarSearchProps) => {
	const { t } = useTranslation();
	const label = useEntryLabel();
	const format = useRangeFormat();
	const [query, setQuery] = useState('');
	const colleagueById = useMemo(
		() => Object.fromEntries(colleagues.map((c) => [c.id, c])),
		[colleagues]
	);

	const results = useMemo(() => {
		const q = query.trim().toLowerCase();
		if (!q) return [];
		return entries
			.filter(
				(e) =>
					e.ownerId === ownerId || shownColleagues.includes(e.ownerId)
			)
			.filter((e) =>
				[
					label(e, e.ownerId !== ownerId),
					e.title,
					e.address,
					colleagueById[e.ownerId]?.displayName
				]
					.filter(Boolean)
					.some((text) => text!.toLowerCase().includes(q))
			)
			.sort(
				(a, b) =>
					new Date(a.start).getTime() - new Date(b.start).getTime()
			)
			.slice(0, MAX_SEARCH_RESULTS);
	}, [query, entries, ownerId, shownColleagues, label, colleagueById]);

	return (
		<>
			<ListSearchField
				leading={leading}
				value={query}
				onChange={setQuery}
				placeholder={t('calendar.search.placeholder')}
				clearLabel={t('calendar.search.clear')}
				className="calendarSide__search"
			/>
			{query.trim() && (
				<section
					className={`calendarSide__section${floating ? ' calendarSearch__results' : ''}`}
					aria-label={t('calendar.search.results')}
				>
					{results.length === 0 ? (
						<p className="calendarSide__muted">
							{t('calendar.search.empty')}
						</p>
					) : (
						<ul className="calendarSide__list">
							{results.map((entry) => (
								<li key={entry.id}>
									<button
										type="button"
										className={`calendarSide__row calendarSide__row--k-${facetOf(entry)}`}
										onClick={(e) =>
											onOpenEntry(entry, e.currentTarget)
										}
									>
										<span className="calendarSide__rowIcon">
											<CalendarEntryGlyph
												entry={entry}
												colleague={
													entry.ownerId !== ownerId
												}
											/>
										</span>
										<span className="calendarSide__rowName">
											{label(
												entry,
												entry.ownerId !== ownerId
											)}
										</span>
										<span className="calendarSide__rowTime">
											{format(entry.start)}
										</span>
									</button>
								</li>
							))}
						</ul>
					)}
				</section>
			)}
		</>
	);
};

/* ------------------------------------------------------------------ */

export interface CalendarKindChipsProps {
	ownerId: string;
	now: Date;
	entries: CalendarEntry[];
	onlyFacets: CalendarEntryFacet[];
	hiddenFacets: CalendarEntryFacet[];
	onToggleFacet: (facet: CalendarEntryFacet) => void;
	onHighlightFacet: (facet: CalendarEntryFacet | null) => void;
	/** Pinned at the right end (the display filter button on the phone). */
	trailing?: React.ReactNode;
	className?: string;
}

/**
 * One chip per kind of own entry, with the number still ahead. In the left
 * column on a wide screen, in row 2 under the header on the phone.
 */
export const CalendarKindChips = ({
	ownerId,
	now,
	entries,
	onlyFacets,
	hiddenFacets,
	onToggleFacet,
	onHighlightFacet,
	trailing,
	className
}: CalendarKindChipsProps) => {
	const { t } = useTranslation();
	const own = entries.filter((e) => e.ownerId === ownerId);
	// A selected kind stays on offer after its entries are gone, so the
	// filter can always be cleared (reviews 4574504546, 4574493851).
	const presentFacets = CALENDAR_FACETS.filter(
		(facet) =>
			onlyFacets.includes(facet) || own.some((e) => facetOf(e) === facet)
	);
	const futureCount = (facet: CalendarEntryFacet) =>
		own.filter(
			(e) =>
				facetOf(e) === facet &&
				new Date(e.end).getTime() > now.getTime()
		).length;

	return (
		<FilterChipRow
			label={t('calendar.filterLabel')}
			className={className}
			trailing={trailing}
		>
			{presentFacets
				.filter(
					(facet) =>
						!hiddenFacets.includes(facet) ||
						onlyFacets.includes(facet)
				)
				.map((facet) => (
					<span
						key={facet}
						className={`calendarSide__chip calendarSide__chip--k-${facet}`}
						onMouseEnter={() => onHighlightFacet(facet)}
						onMouseLeave={() => onHighlightFacet(null)}
						onFocus={() => onHighlightFacet(facet)}
						onBlur={() => onHighlightFacet(null)}
					>
						<FilterChip
							label={t(`calendar.facets.${facet}`)}
							icon={FACET_ICON_COMPONENT[facet]}
							active={onlyFacets.includes(facet)}
							count={futureCount(facet)}
							onClick={() => onToggleFacet(facet)}
							data-cy={`calendar-filter-${facet}`}
						/>
					</span>
				))}
		</FilterChipRow>
	);
};

/* ------------------------------------------------------------------ */

interface QuickEntryProps {
	ownerId: string;
	now: Date;
	entries: CalendarEntry[];
	conversations: CalendarConversation[];
	workingHours: WorkingHours | WorkingPlan;
	onCreate: (drafts: AppointmentDraft[]) => QuickCreateResult;
	/**
	 * Free hours are offered only when this week's entries are in, so none
	 * that is actually busy is offered (review 4576313283).
	 */
	freeHours?: FreeHoursState;
	onRetryFreeHours?: () => void;
	onMoreDetails?: CalendarSidebarProps['onMoreDetails'];
	/** Focus the line when shown (the phone folds it open on demand). */
	autoFocus?: boolean;
	/** The folding row above already names it (phone sheet). */
	hideTitle?: boolean;
	/** Focus the line each time this counts up. */
	focusSignal?: number;
}

/**
 * "Do 14 Uhr Video ruhiges": day, time, kind and conversation from one line.
 * The kind chips and the free-hour pills fill in what typing leaves out.
 */
export const QuickEntry = ({
	ownerId,
	now,
	entries,
	conversations,
	workingHours,
	onCreate,
	freeHours = 'ready',
	onRetryFreeHours,
	onMoreDetails,
	autoFocus = false,
	hideTitle = false,
	focusSignal
}: QuickEntryProps) => {
	const { t } = useTranslation();
	const format = useRangeFormat();
	const shortTime = useShortTime();
	const inputRef = useRef<HTMLInputElement>(null);
	useEffect(() => {
		if (autoFocus) inputRef.current?.focus();
	}, [autoFocus]);
	useEffect(() => {
		if (focusSignal) inputRef.current?.focus();
	}, [focusSignal]);
	const [text, setText] = useState('');
	const [kind, setKind] = useState<QuickKind | undefined>();
	const [sessionId, setSessionId] = useState<number | undefined>();
	const [fields, setFields] = useState<Partial<QuickFields>>({
		duration: DEFAULT_QUICK_DURATION
	});
	/** "1 Std | 30 Min": how long the offered free time is. */
	const [slot, setSlot] = useState<30 | 60>(60);
	const parsed = parseQuickEntry(text, { now, conversations, kind });
	const range = rangeFromFields(fields);
	const entry = {
		kind: parsed.kind,
		start: range?.start,
		end: range?.end,
		sessionId: sessionId ?? parsed.sessionId
	};
	const touched = !!(text.trim() || kind || fields.date || fields.time);
	const gaps = touched ? quickEntryGaps(entry) : [];
	const free = useMemo(
		() =>
			nextFreeHours({
				entries,
				ownerId,
				hours: workingHours,
				now,
				minutes: slot
			}),
		[entries, ownerId, workingHours, now, slot]
	);
	const type = (value: string) => {
		setText(value);
		const typed = parseQuickEntry(value, { now, conversations, kind });
		// A conversation the line names replaces an earlier pick; a line
		// that names none keeps it; a name that fits several drops it, so
		// "who" blocks saving until one is chosen (review 4575297354).
		if (typed.sessionId !== undefined) setSessionId(typed.sessionId);
		else if (typed.ambiguous) setSessionId(undefined);
		// The line prefills what it names; the fields stay what is saved.
		const prefill = fieldsFromEntry(typed);
		if (Object.keys(prefill).length > 0)
			setFields((current) => ({ ...current, ...prefill }));
	};
	const effectiveKind = entry.kind;
	const conversation = conversations.find(
		(c) => c.sessionId === entry.sessionId
	);

	const reset = () => {
		setText('');
		setKind(undefined);
		setSessionId(undefined);
		setFields({ duration: DEFAULT_QUICK_DURATION });
	};

	// One creation at a time; a draft changed while it ran stays (reviews
	// 4575297363, 4575297365).
	const [saving, setSaving] = useState(false);
	const draftKey = JSON.stringify([text, kind, sessionId, fields]);
	const latestDraft = useRef(draftKey);
	latestDraft.current = draftKey;

	const submit = () => {
		if (
			saving ||
			gaps.length > 0 ||
			!entry.start ||
			!entry.end ||
			!effectiveKind
		)
			return;
		const submitted = draftKey;
		setSaving(true);
		const result = onCreate([
			effectiveKind === 'blocker'
				? { type: 'blocker', start: entry.start, end: entry.end }
				: {
						type: 'appointment',
						start: entry.start,
						end: entry.end,
						kind: effectiveKind,
						sessionId: entry.sessionId
					}
		]);
		// The draft goes only once the entry exists; a failure keeps it.
		Promise.resolve(result).then(
			(created) => {
				setSaving(false);
				if (created !== false && latestDraft.current === submitted)
					reset();
			},
			() => setSaving(false)
		);
	};

	let status: string;
	if (!touched) status = t('calendar.quick.hint');
	else if (gaps.length > 0)
		status = t('calendar.quick.missing', {
			list: gaps.map((g) => t(`calendar.quick.gaps.${g}`)).join(', ')
		});
	else
		status = [
			effectiveKind === 'blocker'
				? t('calendar.blocker.menuItem')
				: t(`calendar.kinds.${effectiveKind}`),
			conversation?.username,
			format(entry.start!, entry.end)
		]
			.filter(Boolean)
			.join(' · ');

	const suggestions =
		effectiveKind && effectiveKind !== 'blocker' && !entry.sessionId
			? conversations.slice(0, 4)
			: [];

	return (
		<section
			className="calendarSide__section calendarQuick"
			data-cy="calendar-quick"
		>
			{hideTitle ? null : (
				<h2 className="calendarSide__title">
					{t('calendar.quick.title')}
				</h2>
			)}
			<form
				className="calendarQuick__form"
				onSubmit={(e) => {
					e.preventDefault();
					submit();
				}}
			>
				{/* The same outlined field as Tag, Beginn and Dauer below
				    (Frank, prototype v15). */}
				<TextField
					inputRef={inputRef}
					className="calendarQuick__input"
					value={text}
					onChange={(e) => type(e.target.value)}
					placeholder={t('calendar.quick.placeholder')}
					fullWidth
					sx={[orisoTextFieldSx, { '&': { marginTop: 0 } }]}
					inputProps={{
						'aria-label': t('calendar.quick.title'),
						'aria-describedby': 'calendar-quick-status',
						'data-cy': 'calendar-quick-input'
					}}
				/>
				{/* Tag on its own row, then Beginn and Dauer side by side:
				    the product's date, time and select fields. */}
				<div className="calendarQuick__when">
					<div
						className="calendarQuick__day"
						data-cy="calendar-quick-date"
					>
						<OrisoDatePicker
							label={t('calendar.quick.date')}
							value={fields.date ? dayjs(fields.date) : null}
							onChange={(day) =>
								setFields((f) => ({
									...f,
									date: day?.isValid()
										? day.format('YYYY-MM-DD')
										: undefined
								}))
							}
							weekStart={1}
						/>
					</div>
					<div data-cy="calendar-quick-time">
						<OrisoTimePicker
							label={t('calendar.quick.time')}
							ampm={false}
							value={
								fields.time
									? dayjs(
											`${fields.date ?? dateField(now)}T${fields.time}`
										)
									: null
							}
							onChange={(time) =>
								setFields((f) => ({
									...f,
									time: time?.isValid()
										? time.format('HH:mm')
										: undefined
								}))
							}
							cancelLabel={t('app.cancel')}
						/>
					</div>
					<div data-cy="calendar-quick-duration">
						<OrisoSelect
							label={t('calendar.quick.duration')}
							value={String(
								fields.duration ?? DEFAULT_QUICK_DURATION
							)}
							options={QUICK_DURATIONS.map((d) => ({
								value: String(d),
								label: t('calendar.quick.minutes', { count: d })
							}))}
							onChange={(event) =>
								setFields((f) => ({
									...f,
									duration: Number(
										event.target.value
									) as QuickDuration
								}))
							}
						/>
					</div>
				</div>
				<div
					className="calendarQuick__kinds"
					role="group"
					aria-label={t('calendar.quick.kind')}
				>
					{QUICK_KINDS.map((k) => (
						<button
							key={k}
							type="button"
							className={`calendarQuick__kind calendarQuick__kind--k-${k}`}
							aria-pressed={effectiveKind === k}
							onClick={() => setKind(kind === k ? undefined : k)}
							data-cy={`calendar-quick-kind-${k}`}
						>
							<FacetIcon facet={k} />
							<span>
								{k === 'blocker'
									? t('calendar.blocker.menuItem')
									: t(`calendar.kinds.${k}`)}
							</span>
						</button>
					))}
				</div>
				<div className="calendarQuick__free">
					<div className="calendarQuick__freeHead">
						<span className="calendarQuick__freeLabel">
							{slot === 60
								? t('calendar.quick.freeHours')
								: t('calendar.quick.freeHalf')}
						</span>
						<div
							className="calendarQuick__slot"
							role="group"
							aria-label={t('calendar.quick.slot')}
						>
							{([60, 30] as const).map((m) => (
								<button
									key={m}
									type="button"
									className="calendarQuick__slotButton"
									aria-pressed={slot === m}
									onClick={() => setSlot(m)}
									data-cy={`calendar-quick-slot-${m}`}
								>
									{m === 60
										? t('calendar.quick.hour')
										: t('calendar.quick.halfHour')}
								</button>
							))}
						</div>
					</div>
					{freeHours === 'loading' && (
						<p className="calendarQuick__freeNote" role="status">
							{t('calendar.quick.freeLoading')}
						</p>
					)}
					{freeHours === 'failed' && (
						<p className="calendarQuick__freeNote" role="status">
							<span>{t('calendar.quick.freeUnavailable')}</span>
							{onRetryFreeHours && (
								<button
									type="button"
									className="calendarQuick__freeRetry"
									onClick={onRetryFreeHours}
									data-cy="calendar-quick-free-retry"
								>
									{t('calendar.error.retry')}
								</button>
							)}
						</p>
					)}
					{freeHours === 'ready' && free.length > 0 && (
						<div className="calendarQuick__freeRow">
							{free.map((start) => (
								<button
									key={start.getTime()}
									type="button"
									className="calendarQuick__freePill"
									onClick={() => {
										setFields((f) => ({
											...f,
											date: dateField(start),
											time: timeField(start),
											duration: slot
										}));
										inputRef.current?.focus();
									}}
									data-cy="calendar-quick-free"
								>
									{shortTime(start, now)}
								</button>
							))}
						</div>
					)}
				</div>
				{suggestions.length > 0 && (
					<div
						className="calendarQuick__who"
						role="group"
						aria-label={t('calendar.quick.who')}
					>
						{suggestions.map((c) => (
							<button
								key={c.sessionId}
								type="button"
								className="calendarQuick__person"
								onClick={() => setSessionId(c.sessionId)}
							>
								{c.username}
							</button>
						))}
					</div>
				)}
				<p
					id="calendar-quick-status"
					className="calendarQuick__status"
					aria-live="polite"
				>
					{status}
				</p>
				<div className="calendarQuick__actions">
					{onMoreDetails && (
						<button
							type="button"
							className="calendarSide__textButton"
							onClick={() => {
								onMoreDetails({
									...entry,
									kind: effectiveKind
								});
								reset();
							}}
						>
							{t('calendar.quick.more')}
						</button>
					)}
					<button
						type="submit"
						className="calendarQuick__save"
						disabled={saving || gaps.length > 0 || !touched}
						data-cy="calendar-quick-save"
					>
						{t('calendar.quick.save')}
					</button>
				</div>
			</form>
		</section>
	);
};
