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
import { Popper } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { ListSearchField } from '../listSearchField/ListSearchField';
import { FilterChipRow } from '../displayFilter/FilterChipRow';
import { FilterChip } from '../displayFilter/FilterChip';
import { DisplayFilterButton } from '../displayFilter/DisplayFilterButton';
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
	type QuickFields,
	type QuickKind
} from './calendarQuickEntry';
import { useShortTime } from './calendarShortTime';
import type { WorkingHours, WorkingPlan } from './calendarWorkingHours';
import { CalendarEntryPeek } from './CalendarEntryPeek';
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
	/** Colleagues shown: search finds their entries too. */
	shownColleagues: string[];
	/**
	 * `false`, or a promise that rejects or resolves to `false`, means it
	 * was not created: the quick entry keeps its draft.
	 */
	onCreate?: (drafts: AppointmentDraft[]) => QuickCreateResult;
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
	shownColleagues,
	onCreate,
	onMoreDetails,
	onWorkingHours,
	variant = 'column',
	quickOpen = false,
	onQuickToggle
}: CalendarSidebarProps) => {
	const sheet = variant === 'sheet';
	const { t } = useTranslation();
	const label = useEntryLabel();
	const format = useRangeFormat();
	const shortTime = useShortTime();
	const [query, setQuery] = useState('');
	const kindsAnchor = useRef<HTMLSpanElement>(null);
	const colleagueById = useMemo(
		() => Object.fromEntries(colleagues.map((c) => [c.id, c])),
		[colleagues]
	);

	// --- Search ---
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

	return (
		<aside
			className={`calendarSide${sheet ? ' calendarSide--sheet' : ''}`}
			aria-label={sheet ? undefined : t('calendar.side.label')}
			data-cy="calendar-side"
		>
			{/* As in "Gespräche": the display filter sits at the left of the
			    search field (Frank, 2026-11-14). */}
			<ListSearchField
				leading={
					<span
						ref={kindsAnchor}
						className="calendarSide__kindsAnchor"
					>
						<DisplayFilterButton
							label={t('calendar.kindsMenu.label')}
							customised={hiddenFacets.length > 0}
							customisedLabel={t('calendar.kindsMenu.customised')}
							open={kindsMenuOpen}
							onClick={() =>
								kindsAnchor.current &&
								onOpenKinds(kindsAnchor.current)
							}
							compact
							data-cy="calendar-kinds-button"
						/>
					</span>
				}
				value={query}
				onChange={setQuery}
				placeholder={t('calendar.search.placeholder')}
				clearLabel={t('calendar.search.clear')}
				className="calendarSide__search"
			/>
			{query.trim() && (
				<section
					className="calendarSide__section"
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

			{!sheet && (
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
									onClick={(e) =>
										onOpenProposal?.(
											proposal,
											entry,
											e.currentTarget
										)
									}
								>
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
								{onWithdrawProposal && (
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
							<li key={entry.id}>
								<button
									type="button"
									className={`calendarSide__row calendarSide__row--k-${facetOf(entry)}`}
									aria-describedby={
										peek?.entry.id === entry.id
											? 'calendar-upcoming-peek'
											: undefined
									}
									onMouseEnter={(e) =>
										setPeek({ el: e.currentTarget, entry })
									}
									onMouseLeave={() => setPeek(null)}
									onFocus={(e) =>
										setPeek({ el: e.currentTarget, entry })
									}
									onBlur={() => setPeek(null)}
									onClick={(e) => {
										setPeek(null);
										onOpenEntry(entry, e.currentTarget);
									}}
									data-cy={`calendar-upcoming-${entry.id}`}
								>
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
					{peek && <CalendarEntryPeek entry={peek.entry} clickHint />}
				</Popper>
			</section>

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
			{/* Folded on the phone it stays mounted, so the draft survives. */}
			{consultant && onCreate && (
				<div
					id="calendar-quick-panel"
					className="calendarSide__quick"
					hidden={sheet && !quickOpen}
				>
					<QuickEntry
						ownerId={ownerId}
						now={now}
						entries={entries}
						conversations={conversations}
						workingHours={workingHours}
						onCreate={onCreate}
						onMoreDetails={onMoreDetails}
						autoFocus={sheet && quickOpen}
						hideTitle={sheet}
					/>
				</div>
			)}

			{consultant && onWorkingHours && (
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
						!hiddenFacets.includes(facet) || onlyFacets.includes(facet)
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
	onMoreDetails?: CalendarSidebarProps['onMoreDetails'];
	/** Focus the line when shown (the phone folds it open on demand). */
	autoFocus?: boolean;
	/** The folding row above already names it (phone sheet). */
	hideTitle?: boolean;
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
	onMoreDetails,
	autoFocus = false,
	hideTitle = false
}: QuickEntryProps) => {
	const { t } = useTranslation();
	const format = useRangeFormat();
	const shortTime = useShortTime();
	const inputRef = useRef<HTMLInputElement>(null);
	useEffect(() => {
		if (autoFocus) inputRef.current?.focus();
	}, [autoFocus]);
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
		// that names none keeps it.
		if (typed.sessionId !== undefined) setSessionId(typed.sessionId);
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

	const submit = () => {
		if (gaps.length > 0 || !entry.start || !entry.end || !effectiveKind)
			return;
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
				if (created !== false) reset();
			},
			() => undefined
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
				<input
					ref={inputRef}
					className="calendarQuick__input"
					value={text}
					onChange={(e) => type(e.target.value)}
					placeholder={t('calendar.quick.placeholder')}
					aria-label={t('calendar.quick.title')}
					aria-describedby="calendar-quick-status"
					data-cy="calendar-quick-input"
				/>
				<div className="calendarQuick__fields">
					<label className="calendarQuick__field">
						<span>{t('calendar.quick.date')}</span>
						<input
							type="date"
							value={fields.date ?? ''}
							onChange={(e) =>
								setFields((f) => ({
									...f,
									date: e.target.value
								}))
							}
							data-cy="calendar-quick-date"
						/>
					</label>
					<label className="calendarQuick__field">
						<span>{t('calendar.quick.time')}</span>
						<input
							type="time"
							step={900}
							value={fields.time ?? ''}
							onChange={(e) =>
								setFields((f) => ({
									...f,
									time: e.target.value
								}))
							}
							data-cy="calendar-quick-time"
						/>
					</label>
				</div>
				<div
					className="calendarQuick__durations"
					role="group"
					aria-label={t('calendar.quick.duration')}
				>
					{QUICK_DURATIONS.map((d) => (
						<button
							key={d}
							type="button"
							className="calendarQuick__duration"
							aria-pressed={fields.duration === d}
							onClick={() =>
								setFields((f) => ({ ...f, duration: d }))
							}
							data-cy={`calendar-quick-duration-${d}`}
						>
							{t('calendar.quick.minutes', { count: d })}
						</button>
					))}
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
					{free.length > 0 && (
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
						disabled={gaps.length > 0 || !touched}
						data-cy="calendar-quick-save"
					>
						{t('calendar.quick.save')}
					</button>
				</div>
			</form>
		</section>
	);
};
