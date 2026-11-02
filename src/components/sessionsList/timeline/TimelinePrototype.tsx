/**
 * Chat-history timeline PROTOTYPE (ADR-021, PR 2) — Storybook only. The
 * toolbar, every card, the appointment row and the future zone are the real
 * components; the prototype only supplies the data and stands in for the route
 * (a second click deselects, which the real list leaves to the route).
 */
import * as React from 'react';
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { ListItemInterface } from '../../../globalState/interfaces';
import { SessionsListToolbar } from '../SessionsListToolbar';
import type { SessionToolbarChipFilter } from '../sessionToolbarFilters';
import { RuntimeSessionCard } from '../../sessionsListItem/__storybook__/runtimeSessionCard';
import { isRoomUnread } from '../../../utils/sessionUnread';
import { SessionListRailProvider } from '../SessionListRailContext';
import { AppointmentSplitButton } from './AppointmentSplitButton';
import {
	FutureZone,
	PULL_RELEASE_PX,
	type FutureZoneHandle
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
	role?: TimelineRole;
	scrollModel?: ScrollModel;
	/** Height of the list below the handle. */
	listHeight?: number;
	initialFilter?: TimelineFilter;
	/** Date on past cards (display setting): segment at the tag, own line, off, or dev's corner. */
	pastDate?: SessionCardDatePlacement;
	/** Height of the appointment row on a card: Figma XSmall (32) or Small (40). */
	rowButtonSize?: 'xsmall' | 'compact';
	/** Width of the list column; 80 is the ultra-thin rail. */
	width?: number;
	/** Pins the clock (stories with fixed dates); absent: the real one. */
	now?: Date;
}

const RAIL_WIDTH = 80;
const LIST_PATH = '/sessions/consultant/sessionView';

/**
 * Real cards in the list's grouping: flush, one hairline, corners at the
 * group ends; the open card leaves its group (same flags as `SessionsList`).
 */
const CardGroup = ({
	items,
	isOpenAt,
	onPick,
	datePlacement,
	upcomingOf,
	modalityOf,
	actionOf
}: {
	items: ListItemInterface[];
	/** Which rows leave the group; the route still marks every row of the open room. */
	isOpenAt: (index: number) => boolean;
	onPick: (index: number) => void;
	datePlacement: SessionCardDatePlacement;
	/** Label of the row's next appointment, if any. */
	upcomingOf?: (index: number) => string | undefined;
	modalityOf?: (index: number) => FutureEntry['modality'] | undefined;
	/** The row's next appointment as a split button, if any. */
	actionOf?: (
		index: number
	) => React.ComponentProps<typeof RuntimeSessionCard>['appointmentAction'];
}) => {
	const isActive = (index: number) =>
		index >= 0 && index < items.length && isOpenAt(index);
	return (
		<>
			{items.map((item, index) => (
				<div
					key={`${roomOf(item)}-${index}`}
					className="tlp__row"
					// Bubble: after the card's own click has opened the room.
					onClick={() => onPick(index)}
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
						upcomingAppointmentModality={modalityOf?.(index)}
						appointmentAction={actionOf?.(index)}
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
	role = 'counsellor',
	scrollModel = 'panes',
	listHeight = 520,
	initialFilter = 'all',
	pastDate = 'corner',
	rowButtonSize = 'xsmall',
	width = 440,
	now
}: TimelinePrototypeProps) => {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const rail = width <= RAIL_WIDTH;
	const initialChip =
		(Object.entries(FILTER_OF_CHIP).find(
			([, value]) => value === initialFilter
		)?.[0] as SessionToolbarChipFilter | undefined) ?? null;
	const [chip, setChip] = useState<SessionToolbarChipFilter | null>(
		initialChip
	);
	const filter: TimelineFilter = (chip && FILTER_OF_CHIP[chip]) || 'all';
	// Which room is open and, if it was opened from a pill, which appointment.
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
	const pastRef = useRef<HTMLDivElement>(null);
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

	// Measured on screen: "Jetzt" sits inside the positioned zone.
	const nowTop = () => {
		const el = scrollRef.current;
		const marker = nowRef.current;
		return el && marker
			? marker.getBoundingClientRect().top -
					el.getBoundingClientRect().top +
					el.scrollTop
			: 0;
	};

	const onSingleScroll = () => {
		const el = scrollRef.current;
		const marker = nowRef.current;
		if (!el || !marker) return;
		const markerTop = nowTop();
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
			el.scrollTo({ top: nowTop() - 8, behavior: 'smooth' });
	};

	// The route stands in for "which room is open": the card itself navigates.
	const closeRoom = () => {
		setSelection(null);
		navigate(LIST_PATH);
	};
	const openEntry = (entry: FutureEntry) => {
		if (selection?.entryKey === entry.key) {
			closeRoom();
			return;
		}
		const index = pastSessions.findIndex(
			(s) => s.sessionId === entry.sessionId
		);
		pastRef.current
			?.querySelectorAll<HTMLElement>(
				':scope > .tlp__row .sessionsListItem__content'
			)
			[index]?.click();
		setSelection({
			room: roomOf(items[entry.sessionId!]),
			entryKey: entry.key
		});
	};

	const zone = (
		<FutureZone
			ref={zoneRef}
			nowRef={nowRef}
			entries={visibleEntries}
			role={role}
			listHeight={listHeight}
			selectedKey={selection?.entryKey}
			onOpen={openEntry}
			unreadOf={(entry) => isRoomUnread(entry.matrixRoomId)}
			nowLabel={t('sessionList.timeline.now')}
			fixedNow={now}
		/>
	);

	const pastList = (
		<div
			ref={pastRef}
			className="tlp__past"
			role={rail ? 'tablist' : 'list'}
			aria-orientation={rail ? 'vertical' : undefined}
			aria-label="Gespräche"
			data-cy="timeline-past"
		>
			<CardGroup
				items={pastItems}
				isOpenAt={(index) =>
					roomOf(pastItems[index]) === selection?.room
				}
				onPick={(index) => {
					const room = roomOf(pastItems[index]);
					if (selection?.room === room && !selection.entryKey)
						closeRoom();
					else setSelection({ room });
				}}
				datePlacement={pastDate}
				modalityOf={(index) =>
					nextOfSession.get(pastSessions[index].sessionId)?.modality
				}
				upcomingOf={(index) => {
					const next = nextOfSession.get(
						pastSessions[index].sessionId
					);
					return next
						? `Nächster Termin: ${formatEntryDate(next.start)}`
						: undefined;
				}}
				actionOf={(index) => {
					const next = nextOfSession.get(
						pastSessions[index].sessionId
					);
					if (!next) return undefined;
					const RowAction = ({
						openRoom,
						active
					}: {
						openRoom: () => void;
						active: boolean;
					}) => (
						<AppointmentSplitButton
							entry={next}
							role={role}
							active={active}
							size={rowButtonSize}
							fullWidth
							onOpen={openRoom}
						/>
					);
					return RowAction;
				}}
			/>
		</div>
	);

	if (rail) {
		return (
			<SessionListRailProvider rail>
				<div
					className="tlp tlp--rail"
					style={{ width }}
					data-cy="timeline-prototype"
				>
					<div className="tlp__scroll" style={{ height: listHeight }}>
						{pastList}
					</div>
				</div>
			</SessionListRailProvider>
		);
	}

	return (
		<div
			className="tlp"
			style={{ width }}
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
