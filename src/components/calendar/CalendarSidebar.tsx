/**
 * The left column of "Meine Termine", built like the one of "Gespräche"
 * (Frank's prototype v17): it lies on the grey page, with search and the
 * display filter on its left, five round kind chips, open requests, "Als
 * Nächstes" as pill cards, a pink "Jetzt", quick entry in its own white box
 * and the working hours. On a phone the same column fills the bottom sheet;
 * the kind chips are then in the stage and quick entry folds behind the "+"
 * beside "Jetzt".
 */
import * as React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Popper, TextField } from '@mui/material';
import dayjs from 'dayjs';
import AddIcon from '@mui/icons-material/Add';
import ScheduleIcon from '@mui/icons-material/Schedule';
import { ListSearchField } from '../listSearchField/ListSearchField';
import { FilterChipRow } from '../displayFilter/FilterChipRow';
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
	CalendarEntryGlyph,
	FacetIcon,
	SoonBadge,
	facetOf,
	facetShown,
	type CalendarEntryFacet
} from './CalendarEntryGlyph';
import type { MoveProposal } from './calendarActions';
import { nextFreeHours } from './calendarFreeTime';
import {
	DEFAULT_QUICK_DURATION,
	QUICK_DURATIONS,
	dateField,
	durationChoices,
	fieldsFromEntry,
	parseQuickEntry,
	quickEntryGaps,
	rangeFromFields,
	timeField,
	type QuickFields,
	type QuickKind
} from './calendarQuickEntry';
import { useShortTime } from './calendarShortTime';
import {
	isWithinWorkingHours,
	type WorkingHours,
	type WorkingPlan
} from './calendarWorkingHours';
import { CalendarEntryPeek, initialsOf } from './CalendarEntryPeek';
import { avatarToneClass } from './calendarAvatar';
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
/** The round kind chips: one kind at a time (group dates: "Was anzeigen"). */
const KIND_CHIPS: CalendarEntryFacet[] = QUICK_KINDS;
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
	/**
	 * The one entry marked "Beginnt gleich", the same the grid marks
	 * (review 4577641949).
	 */
	soonId?: string;
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
	/**
	 * Proposals colleagues sent for one's own appointments, with the time
	 * each was made for (`from`): at the top of "Offene Anfragen".
	 */
	requests?: {
		proposal: MoveProposal;
		entry: CalendarEntry;
		from: { start: string; end: string };
	}[];
	/** Requests whose answer is on its way: their buttons rest. */
	answeringIds?: string[];
	onOpenRequest?: (
		proposal: MoveProposal,
		entry: CalendarEntry,
		anchor: HTMLElement
	) => void;
	onAcceptRequest?: (proposal: MoveProposal) => void;
	onDeclineRequest?: (proposal: MoveProposal, entry: CalendarEntry) => void;
	onOpenEntry: (entry: CalendarEntry, anchor: HTMLElement) => void;
	/**
	 * A search result or an "Als Nächstes" row: move the calendar to its
	 * day and time. "Zum Chat" lives in the entry's menu (Frank *4).
	 */
	onShowEntry: (entry: CalendarEntry) => void;
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
	soonId,
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
	requests = [],
	answeringIds = [],
	onOpenRequest,
	onAcceptRequest,
	onDeclineRequest,
	onOpenEntry,
	onShowEntry,
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
	/** The rail shows who (the lead) and the start time, nothing else. */
	const railClock = (start: Date | string) =>
		rail && (
			<span className="calendarSide__railClock" aria-hidden="true">
				{clock.format(new Date(start))}
			</span>
		);
	const quick = consultant && !!onCreate;

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
							onlyFacets={onlyFacets}
							hiddenFacets={hiddenFacets}
							onShowEntry={onShowEntry}
							leading={kindsButton}
						/>
					)}

			{!sheet && !rail && (
				<CalendarKindChips
					ownerId={ownerId}
					now={now}
					entries={entries}
					onlyFacets={onlyFacets}
					onToggleFacet={onToggleFacet}
					onHighlightFacet={onHighlightFacet}
					className="calendarSide__chips"
				/>
			)}

			{(openProposals.length > 0 || requests.length > 0) && (
				<section
					className="calendarSide__section"
					aria-labelledby="calendar-requests-title"
					data-cy="calendar-requests"
				>
					<h2
						className="calendarSide__title"
						id="calendar-requests-title"
					>
						{t('calendar.proposal.open')}
					</h2>
					<ul className="calendarSide__list">
						{/* Waiting for one's own answer first: they need it. */}
						{requests.map(({ proposal, entry, from }) => {
							const name =
								proposal.proposerName ??
								t('calendar.proposal.someone');
							const change = {
								from: format(from.start, from.end),
								to: format(proposal.start, proposal.end)
							};
							const busy = answeringIds.includes(proposal.id);
							return (
								<li
									key={proposal.id}
									className="calendarSide__request calendarSide__request--received"
									data-cy={`calendar-received-${proposal.id}`}
								>
									<button
										type="button"
										className="calendarSide__row calendarSide__row--received"
										aria-label={t(
											'calendar.proposal.requestLabel',
											{ name, ...change }
										)}
										aria-haspopup="menu"
										onClick={(e) =>
											onOpenRequest?.(
												proposal,
												entry,
												e.currentTarget
											)
										}
									>
										<span
											className="calendarSide__lead"
											aria-hidden="true"
										>
											<span
												className={`calendarSide__avatar ${avatarToneClass(name)}`}
											>
												{initialsOf(name)}
											</span>
										</span>
										{railClock(proposal.start)}
										<span className="calendarSide__rowText">
											<span className="calendarSide__rowName">
												{name}
											</span>
											<span className="calendarSide__rowMeta calendarSide__requestChange">
												{t(
													'calendar.proposal.change',
													change
												)}
											</span>
										</span>
									</button>
									{!rail &&
										(onAcceptRequest ||
											onDeclineRequest) && (
											<div className="calendarSide__requestActions">
												{onDeclineRequest && (
													<button
														type="button"
														className="calendarSide__textButton"
														disabled={busy}
														aria-label={t(
															'calendar.proposal.declineLabel',
															{ name, ...change }
														)}
														onClick={() =>
															onDeclineRequest(
																proposal,
																entry
															)
														}
														data-cy={`calendar-received-decline-${proposal.id}`}
													>
														{t(
															'calendar.proposal.decline'
														)}
													</button>
												)}
												{onAcceptRequest && (
													<button
														type="button"
														className="calendarSide__textButton calendarSide__textButton--filled"
														disabled={busy}
														aria-label={t(
															'calendar.proposal.acceptLabel',
															{ name, ...change }
														)}
														onClick={() =>
															onAcceptRequest(
																proposal
															)
														}
														data-cy={`calendar-received-accept-${proposal.id}`}
													>
														{t(
															'calendar.proposal.accept'
														)}
													</button>
												)}
											</div>
										)}
								</li>
							);
						})}
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
									<CardLead entry={entry} />
									{railClock(proposal.start)}
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
										className={`calendarSide__row calendarSide__row--k-${facetOf(entry)}${entry.id === soonId ? ' calendarSide__row--soon' : ''}`}
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
										// Jumps to the entry in the calendar (it
										// flashes there) and opens its actions,
										// "Zum Chat" among them (Frank *4, *7).
										onClick={(e) => {
											setPeek(null);
											onShowEntry(entry);
											onOpenEntry(entry, e.currentTarget);
										}}
										aria-label={
											rail
												? `${label(entry)}, ${shortTime(
														new Date(entry.start),
														now,
														new Date(entry.end)
													)}${entry.id === soonId ? `, ${t('calendar.soon')}` : ''}`
												: undefined
										}
										data-cy={`calendar-upcoming-${entry.id}`}
									>
										<CardLead entry={entry} />
										{railClock(entry.start)}
										<span className="calendarSide__rowName">
											{label(entry)}
										</span>
										{entry.id === soonId && !rail && (
											<SoonBadge />
										)}
										<span className="calendarSide__rowTime">
											{shortTime(
												new Date(entry.start),
												now,
												new Date(entry.end)
											)}
										</span>
									</button>
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
							<CalendarEntryPeek
								entry={peek.entry}
								now={now}
								clickHint
							/>
						)}
					</Popper>
				</section>
			)}

			{/* "Jetzt" between what is next and what comes in (prototype
			    v17); in the sheet and the narrow column the "+" beside it
			    opens quick entry. */}
			{(!sheet || quick) && (
				<div className="calendarSide__now" data-cy="calendar-now">
					<span className="calendarSide__nowLabel" aria-hidden="true">
						{t('calendar.side.now')}
					</span>
					{quick && sheet && (
						<button
							type="button"
							className="calendarSide__nowAdd"
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
							<AddIcon />
						</button>
					)}
					{quick && narrow && onWiden && (
						<button
							type="button"
							className="calendarSide__nowAdd"
							aria-label={t('calendar.quick.title')}
							onClick={onWiden}
							data-cy="calendar-quick-widen"
						>
							<AddIcon />
						</button>
					)}
				</div>
			)}
			{/* Folded on the phone or in the narrow column it stays mounted,
			    so the draft survives. */}
			{quick && (
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
					/>
				</div>
			)}

			{/* On the phone and the tablet the hours live in ⋮. Plain text on
			    the grey page with a clock and "Ändern" (prototype v17). */}
			{consultant && onWorkingHours && !narrow && !sheet && (
				<p className="calendarSide__work">
					<ScheduleIcon
						className="calendarSide__workIcon"
						aria-hidden
					/>
					<span className="calendarSide__workText">
						{workingHoursSummary
							? t('calendar.workingHours.summary', {
									hours: workingHoursSummary
								})
							: t('calendar.workingHours.none')}
					</span>
					<button
						type="button"
						className="calendarSide__workButton"
						onClick={onWorkingHours}
						data-cy="calendar-working-hours"
					>
						{workingHoursSummary
							? t('calendar.workingHours.change')
							: t('calendar.workingHours.set')}
					</button>
				</p>
			)}
		</aside>
	);
};

/**
 * Who an entry is with (prototype v17): the advice seeker's avatar in their
 * tone with a small kind badge, or the kind's icon in a white dot when there
 * is no one to show (group dates, blocked time, a colleague's entry without
 * a name).
 */
const CardLead = ({ entry }: { entry: CalendarEntry }) => {
	const facet = facetOf(entry);
	if (entry.type === 'appointment' && entry.title)
		return (
			<span className="calendarSide__lead" aria-hidden="true">
				<span
					className={`calendarSide__avatar ${avatarToneClass(entry.title)}`}
				>
					{initialsOf(entry.title)}
				</span>
				<span className="calendarSide__leadKind">
					<FacetIcon facet={facet} />
				</span>
			</span>
		);
	return (
		<span className="calendarSide__kdot" aria-hidden="true">
			<FacetIcon facet={facet} />
		</span>
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
	/**
	 * The display filter: search finds only what the grid shows, so a
	 * picked result is there where the calendar lands (review 4589304604).
	 */
	onlyFacets?: CalendarEntryFacet[];
	hiddenFacets?: CalendarEntryFacet[];
	/** A result was picked: move the calendar to its day and time. */
	onShowEntry: (entry: CalendarEntry) => void;
	/** At the left of the field (the display filter in the column). */
	leading?: React.ReactNode;
	/** The results float over what is below (top of the calendar). */
	floating?: boolean;
}

/**
 * Search in one's own and the shown colleagues' entries: in the left
 * column on a wide screen, at the very top of the calendar on the phone
 * and the tablet. A result moves the calendar to that day and time
 * (prototype v17); the entry's actions are one click on it there.
 */
export const CalendarSearch = ({
	ownerId,
	entries,
	colleagues,
	shownColleagues,
	onlyFacets = [],
	hiddenFacets = [],
	onShowEntry,
	leading,
	floating = false
}: CalendarSearchProps) => {
	const { t } = useTranslation();
	const label = useEntryLabel();
	const format = useRangeFormat();
	const [query, setQuery] = useState('');
	/** The results close once one is picked; typing opens them again. */
	const [picked, setPicked] = useState(false);
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
					(e.ownerId === ownerId ||
						shownColleagues.includes(e.ownerId)) &&
					facetShown(facetOf(e), onlyFacets, hiddenFacets)
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
	}, [
		query,
		entries,
		ownerId,
		shownColleagues,
		onlyFacets,
		hiddenFacets,
		label,
		colleagueById
	]);

	return (
		<>
			<ListSearchField
				leading={leading}
				value={query}
				onChange={(value) => {
					setQuery(value);
					setPicked(false);
				}}
				placeholder={t('calendar.search.placeholder')}
				clearLabel={t('calendar.search.clear')}
				className="calendarSide__search"
			/>
			{query.trim() && !picked && (
				<section
					className={`calendarSide__section${floating ? ' calendarSearch__results' : ''}`}
					aria-label={t('calendar.search.results')}
				>
					{results.length === 0 ? (
						<p className="calendarSide__muted">
							{t('calendar.search.empty')}
						</p>
					) : (
						<ul className="calendarSide__results">
							{results.map((entry) => (
								<li key={entry.id}>
									<button
										type="button"
										className="calendarSide__result"
										onClick={() => {
											setPicked(true);
											onShowEntry(entry);
										}}
										data-cy={`calendar-search-${entry.id}`}
									>
										<span className="calendarSide__resultIcon">
											<CalendarEntryGlyph
												entry={entry}
												colleague={
													entry.ownerId !== ownerId
												}
											/>
										</span>
										<span className="calendarSide__rowText">
											<span className="calendarSide__rowName">
												{label(
													entry,
													entry.ownerId !== ownerId
												)}
											</span>
											<span className="calendarSide__rowMeta">
												{format(entry.start, entry.end)}
											</span>
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
	onToggleFacet: (facet: CalendarEntryFacet) => void;
	onHighlightFacet: (facet: CalendarEntryFacet | null) => void;
	/** Pinned at the right end (the display filter button on the phone). */
	trailing?: React.ReactNode;
	className?: string;
}

/**
 * Five round icon chips, one per kind (prototype v17): one kind at a time;
 * the chosen chip turns dark and names the kind with the number of own
 * entries still ahead. Clicking it again shows all. In the left column on
 * a wide screen, in row 2 under the header on the phone.
 */
export const CalendarKindChips = ({
	ownerId,
	now,
	entries,
	onlyFacets,
	onToggleFacet,
	onHighlightFacet,
	trailing,
	className
}: CalendarKindChipsProps) => {
	const { t } = useTranslation();
	const own = entries.filter((e) => e.ownerId === ownerId);
	const futureCount = (facet: CalendarEntryFacet) =>
		own.filter(
			(e) =>
				facetOf(e) === facet &&
				new Date(e.end).getTime() > now.getTime()
		).length;
	// Single choice through the parent's toggle: switch the others off
	// first, then this one (on, or off when it was the chosen one).
	const choose = (facet: CalendarEntryFacet) => {
		onlyFacets.filter((f) => f !== facet).forEach(onToggleFacet);
		onToggleFacet(facet);
	};

	return (
		<FilterChipRow
			label={t('calendar.filterLabel')}
			className={className}
			trailing={trailing}
		>
			{KIND_CHIPS.map((facet) => {
				const on = onlyFacets.includes(facet);
				const name =
					facet === 'blocker'
						? t('calendar.blocker.menuItem')
						: t(`calendar.kinds.${facet}`);
				return (
					<button
						key={facet}
						type="button"
						className={`calendarSide__kindChip calendarSide__chip--k-${facet}`}
						aria-pressed={on}
						title={name}
						onClick={() => choose(facet)}
						onMouseEnter={() => onHighlightFacet(facet)}
						onMouseLeave={() => onHighlightFacet(null)}
						onFocus={() => onHighlightFacet(facet)}
						onBlur={() => onHighlightFacet(null)}
						data-cy={`calendar-filter-${facet}`}
					>
						<FacetIcon facet={facet} />
						{/* Read out always, shown only on the chosen chip. */}
						<span className="calendarSide__kindChipLabel">
							{name}
						</span>
						{on && (
							<span className="calendarSide__kindChipCount">
								{futureCount(facet)}
							</span>
						)}
					</button>
				);
			})}
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
	/** Focus the line each time this counts up. */
	focusSignal?: number;
}

/** How many people quick entry offers when "with whom" is still open. */
const MAX_PEOPLE = 5;

/**
 * The line at 44 px, as Tag, Beginn and Dauer below it (prototype v17):
 * on top of the shared outlined field, with the darker line of the box.
 */
const QUICK_FIELD_SX = {
	'&': { marginTop: 0 },
	'& .MuiOutlinedInput-root': {
		'minHeight': '44px',
		'fontSize': '14px',
		'lineHeight': '20px',
		'letterSpacing': '0.25px',
		'& fieldset': { borderColor: 'var(--m3-outline, #747878)' },
		'&:hover fieldset': { borderColor: 'var(--m3-on-surface, #1a1c1e)' }
	},
	'& .MuiInputBase-input': {
		height: '20px',
		paddingTop: '12px',
		paddingBottom: '12px',
		paddingLeft: '12px',
		paddingRight: '12px'
	}
};

/**
 * "Do 14 Uhr Video ruhiges": day, time, kind and conversation from one line,
 * in its own white box under "Jetzt" (prototype v17). The kind chips, the
 * free-time pills and the people fill in what typing leaves out. Until it
 * is used, only the line, the fields, the kinds and the free times show.
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
	/** A choice by its name; a typed length as hours and minutes. */
	const durationLabel = (minutes: number) => {
		if ((QUICK_DURATIONS as readonly number[]).includes(minutes))
			return t(`calendar.quick.lengths.${minutes}`);
		const hours = Math.floor(minutes / 60);
		const rest = minutes % 60;
		if (!hours) return t('calendar.quick.lengthMinutes', { minutes });
		if (!rest) return t('calendar.quick.lengthHours', { hours });
		return t('calendar.quick.lengthBoth', { hours, minutes: rest });
	};
	/** "1 Std | 30 Min": how long the offered free time is. */
	const [slot, setSlot] = useState<30 | 60>(60);
	/** Focus is somewhere in the box: it shows its status and buttons. */
	const [focused, setFocused] = useState(false);
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

	// What it will be, in words (prototype v17): the range in bold, then
	// "Video-Termin mit …" and a note when it lies outside the working
	// hours; until then what is still open.
	let status: React.ReactNode;
	let ready = false;
	if (!touched) status = t('calendar.quick.hint');
	else if (gaps.length > 0)
		status = (
			<span>
				{t('calendar.quick.missing', {
					list: gaps
						.map((g) => t(`calendar.quick.gaps.${g}`))
						.join(', ')
				})}
				{range && (
					<>
						{' '}
						<strong>{format(range.start, range.end)}</strong>
					</>
				)}
			</span>
		);
	else {
		ready = true;
		const outside = !isWithinWorkingHours(
			entry.start!,
			entry.end!,
			workingHours
		);
		status = (
			<>
				<FacetIcon facet={effectiveKind!} />
				<span>
					<strong>{format(entry.start!, entry.end)}</strong>
					<br />
					{effectiveKind === 'blocker'
						? t('calendar.nouns.blocker')
						: t('calendar.quick.ready', {
								noun: t(`calendar.nouns.${effectiveKind}`),
								name: conversation?.username ?? ''
							})}
					{outside && (
						<span data-cy="calendar-quick-outside">
							{` · ${t('calendar.quick.outsideHours')}`}
						</span>
					)}
				</span>
			</>
		);
	}

	const suggestions =
		effectiveKind && effectiveKind !== 'blocker' && !entry.sessionId
			? conversations.slice(0, MAX_PEOPLE)
			: [];
	const idle = !focused && !touched;

	return (
		<section
			className={`calendarQuick${idle ? ' calendarQuick--idle' : ''}`}
			aria-label={t('calendar.quick.title')}
			data-cy="calendar-quick"
		>
			<form
				className="calendarQuick__form"
				onSubmit={(e) => {
					e.preventDefault();
					submit();
				}}
				onFocus={() => setFocused(true)}
				onBlur={(e) => {
					if (
						!e.currentTarget.contains(
							e.relatedTarget as Node | null
						)
					)
						setFocused(false);
				}}
			>
				{/* The kind first, all in one row (Frank *5.1). */}
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
				{/* The same outlined field as Tag, Beginn and Dauer below
				    (Frank, prototype v15), 44 px high (v17). */}
				<TextField
					inputRef={inputRef}
					className="calendarQuick__input"
					value={text}
					onChange={(e) => type(e.target.value)}
					placeholder={t('calendar.quick.placeholder')}
					fullWidth
					sx={[orisoTextFieldSx, QUICK_FIELD_SX]}
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
							options={durationChoices(fields.duration).map(
								(d) => ({
									value: String(d),
									label: durationLabel(d)
								})
							)}
							onChange={(event) =>
								setFields((f) => ({
									...f,
									duration: Number(event.target.value)
								}))
							}
						/>
					</div>
				</div>
				<div className="calendarQuick__free">
					<div className="calendarQuick__freeHead">
						<span className="calendarQuick__freeLabel">
							{t('calendar.quick.freeNext')}
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
									<ScheduleIcon aria-hidden />
									{shortTime(start, now)}
								</button>
							))}
						</div>
					)}
				</div>
				<p
					id="calendar-quick-status"
					className={`calendarQuick__status${ready ? ' calendarQuick__status--ready' : ''}`}
					aria-live="polite"
				>
					{status}
				</p>
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
								data-cy={`calendar-quick-person-${c.sessionId}`}
							>
								<span
									className={`calendarQuick__personAvatar ${avatarToneClass(c.username)}`}
									aria-hidden="true"
								>
									{initialsOf(c.username)}
								</span>
								<span>{c.username}</span>
							</button>
						))}
					</div>
				)}
				<div className="calendarQuick__actions">
					{onMoreDetails && (
						<button
							type="button"
							className="calendarQuick__more"
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
