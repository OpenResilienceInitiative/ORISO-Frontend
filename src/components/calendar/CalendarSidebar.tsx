/**
 * The left column of "Meine Termine", built like the one of "Gespräche"
 * (Frank's prototype, 2026-11-14): search on top, the kind chips with the
 * filter button, open requests, "Als Nächstes", quick entry and the
 * calendars shown next to one's own.
 */
import * as React from 'react';
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Popper } from '@mui/material';
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
	parseQuickEntry,
	quickEntryGaps,
	type QuickKind
} from './calendarQuickEntry';
import { useShortTime } from './calendarShortTime';
import type { WorkingHours } from './calendarWorkingHours';
import { CalendarEntryPeek } from './CalendarEntryPeek';
import { useEntryLabel, useRangeFormat } from './useEntryLabel';
import { useWeekdayNames } from './WorkingHoursDialog';

const QUICK_KINDS: QuickKind[] = [
	'video',
	'phone',
	'onsite',
	'chat',
	'blocker'
];
const MAX_UPCOMING = 5;
const MAX_SEARCH_RESULTS = 8;

export interface CalendarSidebarProps {
	ownerId: string;
	consultant: boolean;
	now: Date;
	/** Every loaded entry (own and colleagues'). */
	entries: CalendarEntry[];
	colleagues: Colleague[];
	conversations: CalendarConversation[];
	workingHours: WorkingHours;
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
	/** Colleagues shown, and the last ones that were (pills). */
	shownColleagues: string[];
	recentColleagues: string[];
	onToggleColleague: (id: string) => void;
	onOpenPeople: (anchor: HTMLElement) => void;
	onCreate?: (drafts: AppointmentDraft[]) => void;
	/** "Mehr Angaben …": the full dialog with what the line already says. */
	onMoreDetails?: (draft: {
		kind?: QuickKind;
		start?: Date;
		end?: Date;
		sessionId?: number;
	}) => void;
	onWorkingHours?: () => void;
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
	recentColleagues,
	onToggleColleague,
	onOpenPeople,
	onCreate,
	onMoreDetails,
	onWorkingHours
}: CalendarSidebarProps) => {
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

	// --- Kind chips ---
	const own = entries.filter((e) => e.ownerId === ownerId);
	const presentFacets = CALENDAR_FACETS.filter((facet) =>
		own.some((e) => facetOf(e) === facet)
	);
	const futureCount = (facet: CalendarEntryFacet) =>
		own.filter(
			(e) =>
				facetOf(e) === facet &&
				new Date(e.end).getTime() > now.getTime()
		).length;

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
			className="calendarSide"
			aria-label={t('calendar.side.label')}
			data-cy="calendar-side"
		>
			<ListSearchField
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

			<FilterChipRow
				label={t('calendar.filterLabel')}
				className="calendarSide__chips"
				trailing={
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
							data-cy="calendar-kinds-button"
						/>
					</span>
				}
			>
				{presentFacets
					.filter((facet) => !hiddenFacets.includes(facet))
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

			{consultant && onCreate && (
				<QuickEntry
					ownerId={ownerId}
					now={now}
					entries={entries}
					conversations={conversations}
					workingHours={workingHours}
					onCreate={onCreate}
					onMoreDetails={onMoreDetails}
				/>
			)}

			{consultant && (
				<section className="calendarSide__section">
					<h2 className="calendarSide__title">
						{t('calendar.people.besides')}
					</h2>
					<div
						className="calendarSide__pills"
						role="group"
						aria-label={t('calendar.people.besides')}
					>
						<button
							type="button"
							className="calendarSide__pill calendarSide__pill--me"
							aria-pressed="true"
							disabled
						>
							{t('calendar.people.me')}
						</button>
						{recentColleagues
							.map((id) => colleagueById[id])
							.filter(Boolean)
							.map((c) => (
								<button
									key={c.id}
									type="button"
									className="calendarSide__pill"
									aria-pressed={shownColleagues.includes(
										c.id
									)}
									title={c.agencyName}
									onClick={() => onToggleColleague(c.id)}
									data-cy={`calendar-pill-${c.id}`}
								>
									{c.displayName}
								</button>
							))}
						{colleagues.length > 0 && (
							<button
								type="button"
								className="calendarSide__pill calendarSide__pill--more"
								aria-haspopup="menu"
								onClick={(e) => onOpenPeople(e.currentTarget)}
								data-cy="calendar-pill-more"
							>
								{t('calendar.people.more')}
							</button>
						)}
					</div>
					{colleagues.length === 0 && (
						<p className="calendarSide__muted">
							{t('calendar.colleaguesEmpty')}
						</p>
					)}
				</section>
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

interface QuickEntryProps {
	ownerId: string;
	now: Date;
	entries: CalendarEntry[];
	conversations: CalendarConversation[];
	workingHours: WorkingHours;
	onCreate: (drafts: AppointmentDraft[]) => void;
	onMoreDetails?: CalendarSidebarProps['onMoreDetails'];
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * "Do 14 Uhr Video ruhiges": day, time, kind and conversation from one line.
 * The kind chips and the free-hour pills fill in what typing leaves out.
 */
const QuickEntry = ({
	ownerId,
	now,
	entries,
	conversations,
	workingHours,
	onCreate,
	onMoreDetails
}: QuickEntryProps) => {
	const { t } = useTranslation();
	const format = useRangeFormat();
	const shortTime = useShortTime();
	const weekday = useWeekdayNames('short');
	const inputRef = useRef<HTMLInputElement>(null);
	const [text, setText] = useState('');
	const [kind, setKind] = useState<QuickKind | undefined>();
	const [sessionId, setSessionId] = useState<number | undefined>();
	const parsed = parseQuickEntry(text, { now, conversations, kind });
	const entry = {
		...parsed,
		sessionId: sessionId ?? parsed.sessionId
	};
	const gaps = text.trim() || kind ? quickEntryGaps(entry) : [];
	const free = useMemo(
		() => nextFreeHours({ entries, ownerId, hours: workingHours, now }),
		[entries, ownerId, workingHours, now]
	);
	const effectiveKind = entry.kind;
	const conversation = conversations.find(
		(c) => c.sessionId === entry.sessionId
	);

	const reset = () => {
		setText('');
		setKind(undefined);
		setSessionId(undefined);
	};

	const submit = () => {
		if (gaps.length > 0 || !entry.start || !entry.end || !effectiveKind)
			return;
		onCreate([
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
		reset();
	};

	let status: string;
	if (!text.trim() && !kind) status = t('calendar.quick.hint');
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
			<h2 className="calendarSide__title">{t('calendar.quick.title')}</h2>
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
					onChange={(e) => setText(e.target.value)}
					placeholder={t('calendar.quick.placeholder')}
					aria-label={t('calendar.quick.title')}
					aria-describedby="calendar-quick-status"
					data-cy="calendar-quick-input"
				/>
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
				{free.length > 0 && (
					<div className="calendarQuick__free">
						<span className="calendarQuick__freeLabel">
							{t('calendar.quick.freeHours')}
						</span>
						<div className="calendarQuick__freeRow">
							{free.map((start) => (
								<button
									key={start.getTime()}
									type="button"
									className="calendarQuick__freePill"
									onClick={() => {
										setText(
											`${weekday(start.getDay())} ${start.getDate()}.${start.getMonth() + 1}. ${pad(start.getHours())}:${pad(start.getMinutes())}`
										);
										inputRef.current?.focus();
									}}
									data-cy="calendar-quick-free"
								>
									{shortTime(start, now)}
								</button>
							))}
						</div>
					</div>
				)}
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
						disabled={gaps.length > 0 || (!text.trim() && !kind)}
						data-cy="calendar-quick-save"
					>
						{t('calendar.quick.save')}
					</button>
				</div>
			</form>
		</section>
	);
};
