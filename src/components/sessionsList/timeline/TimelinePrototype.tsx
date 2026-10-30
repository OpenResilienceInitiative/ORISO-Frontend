/**
 * Chat-history timeline PROTOTYPE (ADR-021, PR 2) — Storybook only, nothing
 * here is wired into the real list. The toolbar and every card are the real
 * components (`SessionsListToolbar`, `SessionListItemComponent` with the
 * list's grouping flags); the prototype only adds the future zone, its
 * handle, the "Jetzt" marker and the split button on the twin cards.
 */
import * as React from 'react';
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ListItemInterface } from '../../../globalState/interfaces';
import { SessionsListToolbar } from '../SessionsListToolbar';
import type { SessionToolbarChipFilter } from '../sessionToolbarFilters';
import { RuntimeSessionCard } from '../../sessionsListItem/__storybook__/runtimeSessionCard';
import {
	FutureZone,
	NowMarker,
	PULL_RELEASE_PX,
	type FutureZoneHandle,
	type NowVariant
} from './FutureZone';
import type { SessionCardDatePlacement } from '../../sessionsListItem/SessionListItemComponent';
import {
	filterEntries,
	formatEntryDate,
	nextEntryBySession,
	type FutureEntry,
	type TimelineFilter,
	type TimelineRole,
	type TimelineSession
} from './timelineModel';
import '../sessionsList.styles.scss';
import './timelinePrototype.styles.scss';

export type ScrollModel = 'panes' | 'single';
export type { NowVariant } from './FutureZone';
export { ENTRY_HEIGHT, PULL_RELEASE_PX } from './FutureZone';

/** The real toolbar chips the prototype listens to; every other chip shows all. */
const FILTER_OF_CHIP: Partial<
	Record<SessionToolbarChipFilter, TimelineFilter>
> = { groups: 'group', nearby: 'one-to-one' };

const roomOf = (item: ListItemInterface) =>
	item.chat?.matrixRoomId ?? item.session?.matrixRoomId ?? '';

export interface TimelinePrototypeProps {
	entries: FutureEntry[];
	sessions: TimelineSession[];
	/** The real list row of every session (same ids). */
	items: Record<number, ListItemInterface>;
	/** Card used for an appointment whose room is not known yet. */
	unmappedItem: ListItemInterface;
	role?: TimelineRole;
	scrollModel?: ScrollModel;
	nowVariant?: NowVariant;
	/** Height of the list below the handle. */
	listHeight?: number;
	initialFilter?: TimelineFilter;
	/** Date on past cards (display setting): segment at the tag, own line, off, or dev's corner. */
	pastDate?: SessionCardDatePlacement;
}

/**
 * Real cards in the list's grouping: flush, one hairline, corners at the
 * group ends; the open card leaves its group (same flags as `SessionsList`).
 */
const CardGroup = ({
	items,
	isOpenAt,
	onPick,
	datePlacement,
	upcomingOf
}: {
	items: ListItemInterface[];
	/** Which rows leave the group; the route still marks every row of the open room. */
	isOpenAt: (index: number) => boolean;
	onPick: (index: number) => void;
	datePlacement: SessionCardDatePlacement;
	/** Label of the row's next appointment, if any (clock circle). */
	upcomingOf?: (index: number) => string | undefined;
}) => {
	const isActive = (index: number) =>
		index >= 0 && index < items.length && isOpenAt(index);
	return (
		<>
			{items.map((item, index) => (
				<div
					key={`${roomOf(item)}-${index}`}
					className="tlp__row"
					onClickCapture={() => onPick(index)}
				>
					<RuntimeSessionCard
						session={item}
						index={index}
						grouped
						isBeforeActive={isActive(index + 1)}
						isAfterActive={isActive(index - 1)}
						isGroupStart={index === 0 || isActive(index - 1)}
						isGroupEnd={
							index === items.length - 1 || isActive(index + 1)
						}
						datePlacement={datePlacement}
						upcomingAppointment={upcomingOf?.(index)}
					/>
				</div>
			))}
		</>
	);
};

export const TimelinePrototype = ({
	entries,
	sessions,
	items,
	unmappedItem,
	role = 'counsellor',
	scrollModel = 'panes',
	nowVariant = 'line',
	listHeight = 520,
	initialFilter = 'all',
	pastDate = 'tag'
}: TimelinePrototypeProps) => {
	const { t } = useTranslation();
	const initialChip =
		(Object.entries(FILTER_OF_CHIP).find(
			([, value]) => value === initialFilter
		)?.[0] as SessionToolbarChipFilter | undefined) ?? null;
	const [chip, setChip] = useState<SessionToolbarChipFilter | null>(
		initialChip
	);
	const filter: TimelineFilter = (chip && FILTER_OF_CHIP[chip]) || 'all';
	// The clicked card holds the focus (2px ring) and leaves its group. Its
	// room in the past is open too and shows the calm 1px outline; the other
	// dates of a series stay in their group (ADR-021 §2, §4).
	const [selection, setSelection] = useState<{
		room: string;
		entryKey?: string;
	} | null>(null);
	const [nowOffscreen, setNowOffscreen] = useState<'above' | 'below' | null>(
		null
	);
	const pullRef = useRef(0);
	const scrollRef = useRef<HTMLDivElement>(null);
	const nowRef = useRef<HTMLDivElement>(null);
	const zoneRef = useRef<FutureZoneHandle>(null);

	const visibleEntries = useMemo(
		() => filterEntries(entries, filter),
		[entries, filter]
	);
	const itemOf = (entry: FutureEntry) =>
		entry.sessionId !== undefined
			? (items[entry.sessionId] ?? unmappedItem)
			: unmappedItem;
	const pastSessions = useMemo(
		() =>
			sessions.filter(
				(s) =>
					(filter === 'all' || s.kind === filter) &&
					items[s.sessionId]
			),
		[sessions, items, filter]
	);
	const pastItems = pastSessions.map((s) => items[s.sessionId]);
	// Every planned date counts, whatever the filter shows above the handle.
	const nextOfSession = useMemo(() => nextEntryBySession(entries), [entries]);

	// Single timeline: a deliberate pull past the top releases the next stop.
	const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
		if (scrollModel !== 'single') return;
		const el = scrollRef.current;
		if (!el || el.scrollTop > 0 || e.deltaY >= 0) {
			pullRef.current = 0;
			return;
		}
		pullRef.current += -e.deltaY;
		if (pullRef.current >= PULL_RELEASE_PX) {
			pullRef.current = 0;
			zoneRef.current?.stepOpen();
		}
	};

	const onSingleScroll = () => {
		const el = scrollRef.current;
		const marker = nowRef.current;
		if (!el || !marker) return;
		const markerTop = marker.offsetTop;
		if (el.scrollTop > markerTop + marker.offsetHeight)
			setNowOffscreen('above');
		else if (el.scrollTop + el.clientHeight < markerTop)
			setNowOffscreen('below');
		else setNowOffscreen(null);
	};

	const jumpToNow = () => {
		const el = scrollRef.current;
		const marker = nowRef.current;
		if (el && marker)
			el.scrollTo({ top: marker.offsetTop - 8, behavior: 'smooth' });
	};

	const zone = (
		<FutureZone
			ref={zoneRef}
			entries={visibleEntries}
			role={role}
			listHeight={listHeight}
			selectedKey={selection?.entryKey}
			onSelect={(entry) =>
				setSelection({
					room: roomOf(itemOf(entry)),
					entryKey: entry.key
				})
			}
			renderCard={(entry, index, flags) => (
				<RuntimeSessionCard
					session={itemOf(entry)}
					index={index}
					grouped
					{...flags}
					// The twin's date is its split button.
					datePlacement="off"
				/>
			)}
		/>
	);

	const pastList = (
		<div
			className="tlp__past"
			role="list"
			aria-label="Gespräche"
			data-cy="timeline-past"
		>
			<CardGroup
				items={pastItems}
				isOpenAt={(index) =>
					roomOf(pastItems[index]) === selection?.room
				}
				onPick={(index) =>
					setSelection({ room: roomOf(pastItems[index]) })
				}
				datePlacement={pastDate}
				upcomingOf={(index) => {
					const next = nextOfSession.get(
						pastSessions[index].sessionId
					);
					return next
						? `Nächster Termin: ${formatEntryDate(next.start)}`
						: undefined;
				}}
			/>
		</div>
	);

	return (
		<div
			className="tlp"
			data-scroll-model={scrollModel}
			data-cy="timeline-prototype"
		>
			<SessionsListToolbar
				translate={t}
				searchValue=""
				onSearchChange={() => {}}
				activeChip={chip}
				onChipToggle={(next) =>
					setChip((current) => (current === next ? null : next))
				}
				showConsultantActions={role === 'counsellor'}
				showCreateGroupChatAction={false}
				showSupervisionChip={false}
				showGroupChip
				createGroupChatPath="/sessions/consultant/sessionView/createGroupChat"
				archiveTabPath="/sessions/consultant/sessionView?sessionListTab=archive"
				archiveTabActive={false}
				createGroupChatActive={false}
			/>

			{scrollModel === 'panes' ? (
				<>
					{zone}
					<NowMarker variant={nowVariant} />
					<div className="tlp__scroll" style={{ height: listHeight }}>
						{pastList}
					</div>
				</>
			) : (
				<div
					ref={scrollRef}
					className="tlp__scroll tlp__scroll--single"
					style={{ height: listHeight }}
					onWheel={onWheel}
					onScroll={onSingleScroll}
					data-cy="timeline-single"
				>
					{zone}
					<div ref={nowRef}>
						<NowMarker variant={nowVariant} />
					</div>
					{pastList}
				</div>
			)}

			{scrollModel === 'single' && nowOffscreen && (
				<button
					type="button"
					className={`tlp__pill tlp__pill--${nowOffscreen}`}
					onClick={jumpToNow}
					data-cy="timeline-now-pill"
				>
					{nowOffscreen === 'above' ? '↑ Jetzt' : '↓ Jetzt'}
				</button>
			)}
		</div>
	);
};
