/**
 * Chat-history timeline PROTOTYPE (ADR-021, PR 2) — Storybook only, nothing
 * here is wired into the real list. The toolbar and every card are the real
 * components (`SessionsListToolbar`, `SessionListItemComponent` with the
 * list's grouping flags); the prototype only adds the future zone, its
 * handle, the "Jetzt" marker and the split button on the twin cards.
 */
import * as React from 'react';
import {
	useCallback,
	useEffect,
	useId,
	useLayoutEffect,
	useMemo,
	useRef,
	useState
} from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import type { ListItemInterface } from '../../../globalState/interfaces';
import { SessionsListToolbar } from '../SessionsListToolbar';
import type { SessionToolbarChipFilter } from '../sessionToolbarFilters';
import { RuntimeSessionCard } from '../../sessionsListItem/__storybook__/runtimeSessionCard';
import { ResizableHandle } from '../ResizableHandle';
import { SplitButton } from '../../splitButton/SplitButton';
import {
	ChatMenuDropdown,
	ChatMenuDropdownItem
} from '../../chatMenuDropdown/ChatMenuDropdown';
import { ReactComponent as ChatIcon } from '../../../resources/img/icons/modality-chat.svg';
import { ReactComponent as AudioIcon } from '../../../resources/img/icons/modality-audio.svg';
import { ReactComponent as VideoIcon } from '../../../resources/img/icons/modality-video.svg';
import { ReactComponent as LocationIcon } from '../../../resources/img/icons/location.svg';
import { revealSnapPoints, stepSnap, clampReveal } from '../verticalHandleMath';
import {
	entryMenu,
	filterEntries,
	formatEntryDate,
	type EntryModality,
	type FutureEntry,
	type TimelineFilter,
	type TimelineRole,
	type TimelineSession
} from './timelineModel';
import '../sessionsList.styles.scss';
import './timelinePrototype.styles.scss';

export type ScrollModel = 'panes' | 'single';
export type NowVariant = 'line' | 'handle' | 'band';

/** Fallback card height until the real cards are measured. */
export const ENTRY_HEIGHT = 160;
/** Pull this far past the top of the single timeline to release the next stop. */
export const PULL_RELEASE_PX = 60;

const MODALITY_ICON: Record<
	EntryModality,
	React.FC<React.SVGProps<SVGSVGElement>>
> = {
	chat: ChatIcon,
	audio: AudioIcon,
	video: VideoIcon,
	location: LocationIcon
};

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
}

const EntryMenu = ({
	entry,
	role,
	anchor,
	onClose
}: {
	entry: FutureEntry;
	role: TimelineRole;
	anchor: DOMRect;
	onClose: () => void;
}) => {
	const items = entryMenu(entry, role);
	const ref = useRef<HTMLDivElement>(null);
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
		const onDown = (e: MouseEvent) =>
			!ref.current?.contains(e.target as Node) && onClose();
		document.addEventListener('keydown', onKey);
		document.addEventListener('mousedown', onDown);
		return () => {
			document.removeEventListener('keydown', onKey);
			document.removeEventListener('mousedown', onDown);
		};
	}, [onClose]);
	return createPortal(
		<div
			onClick={(e) => e.stopPropagation()}
			style={{
				position: 'fixed',
				zIndex: 1400,
				top: anchor.bottom + 8,
				left: Math.max(
					8,
					Math.min(anchor.right - 320, window.innerWidth - 328)
				)
			}}
		>
			<ChatMenuDropdown
				ref={ref}
				role="menu"
				ariaLabel="Termin"
				data-cy="timeline-entry-menu"
				style={{ width: 320 }}
			>
				{items.map((item) => (
					<ChatMenuDropdownItem
						key={item.key}
						role="menuitem"
						title={item.title}
						description={item.description}
						disabled={item.disabled}
						onClick={onClose}
					/>
				))}
			</ChatMenuDropdown>
		</div>,
		document.body
	);
};

const NowArrow = ({ direction }: { direction: 'up' | 'down' }) => (
	<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
		<path
			d={direction === 'up' ? 'M6 2 L11 8 H1 Z' : 'M6 10 L1 4 H11 Z'}
			fill="currentColor"
		/>
	</svg>
);

const NowMarker = ({ variant }: { variant: NowVariant }) => (
	<div
		className={`tlp__now tlp__now--${variant}`}
		data-cy="timeline-now"
		role="separator"
		aria-label="Jetzt"
	>
		{variant === 'band' && <NowArrow direction="up" />}
		<span className="tlp__nowLabel">Jetzt</span>
		{variant === 'band' && <NowArrow direction="down" />}
	</div>
);

/**
 * Real cards in the list's grouping: flush, one hairline, corners at the
 * group ends; the open card leaves its group (same flags as `SessionsList`).
 */
const CardGroup = ({
	items,
	isOpenAt,
	onPick,
	decorate
}: {
	items: ListItemInterface[];
	/** Which rows leave the group; the route still marks every row of the open room. */
	isOpenAt: (index: number) => boolean;
	onPick: (index: number) => void;
	decorate?: (item: ListItemInterface, index: number) => React.ReactNode;
}) => {
	const isActive = (index: number) =>
		index >= 0 && index < items.length && isOpenAt(index);
	return (
		<>
			{items.map((item, index) => (
				<div
					key={`${roomOf(item)}-${index}`}
					className="tlp__row"
					onClickCapture={(event) => {
						// The split button's menu toggle does not open the room.
						if (
							(event.target as Element).closest(
								'.tlp__twinAction'
							)
						)
							return;
						onPick(index);
					}}
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
					/>
					{decorate?.(item, index)}
				</div>
			))}
		</>
	);
};

/**
 * The split button sits where the twin card would show its last message.
 * Its main part opens the room exactly like a click on the card does.
 */
const TwinAction = ({
	entry,
	role,
	active
}: {
	entry: FutureEntry;
	role: TimelineRole;
	active: boolean;
}) => {
	const [menuAnchor, setMenuAnchor] = useState<DOMRect | null>(null);
	const [place, setPlace] = useState<React.CSSProperties>({});
	const hostRef = useRef<HTMLDivElement>(null);
	const toggleRef = useRef<HTMLButtonElement | null>(null);
	const menuId = useId();
	const Icon = MODALITY_ICON[entry.modality];
	const card = () =>
		hostRef.current
			?.closest('.tlp__row')
			?.querySelector<HTMLElement>('.sessionsListItem__content');

	// The card fills in after mount (Matrix preview, avatars): measure again
	// whenever the row changes size or content.
	useLayoutEffect(() => {
		const row = hostRef.current?.closest<HTMLElement>('.tlp__row');
		if (!row) return;
		const measure = () => {
			const preview = row.querySelector<HTMLElement>(
				'.sessionsListItem__subject'
			);
			if (!preview) return;
			const r = row.getBoundingClientRect();
			// The preview box spans the card; its text starts after the avatar.
			const text = document.createRange();
			text.selectNodeContents(preview);
			const p = text.getBoundingClientRect();
			// Top-aligned: the 32px button grows into the gap below the preview.
			setPlace({
				left: Math.round(p.left - r.left),
				top: Math.round(p.top - r.top - 2)
			});
		};
		measure();
		const observer =
			typeof ResizeObserver !== 'undefined'
				? new ResizeObserver(measure)
				: null;
		observer?.observe(row);
		const mutations = new MutationObserver(measure);
		mutations.observe(row, { childList: true, subtree: true });
		return () => {
			observer?.disconnect();
			mutations.disconnect();
		};
	}, []);

	return (
		<div
			ref={hostRef}
			className="tlp__twinAction"
			style={place}
			data-cy="timeline-entry-action"
		>
			<SplitButton
				size="small"
				variant={active ? 'primary' : 'tonal'}
				label={formatEntryDate(entry.start)}
				icon={<Icon />}
				mainOpensMenu={false}
				onClick={() => {
					card()?.click();
					card()?.focus();
				}}
				onToggleMenu={() =>
					setMenuAnchor(
						menuAnchor
							? null
							: (toggleRef.current?.getBoundingClientRect() ??
									null)
					)
				}
				open={Boolean(menuAnchor)}
				menuLabel="Terminmenü"
				menuPopup="menu"
				menuId={menuId}
				trailingRef={toggleRef}
			/>
			{menuAnchor && (
				<EntryMenu
					entry={entry}
					role={role}
					anchor={menuAnchor}
					onClose={() => setMenuAnchor(null)}
				/>
			)}
		</div>
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
	initialFilter = 'all'
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
	const [reveal, setReveal] = useState(0);
	const [dragging, setDragging] = useState(false);
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
	const [measured, setMeasured] = useState({
		item: ENTRY_HEIGHT,
		content: 0
	});
	const pullRef = useRef(0);
	const scrollRef = useRef<HTMLDivElement>(null);
	const nowRef = useRef<HTMLDivElement>(null);
	const futureRef = useRef<HTMLDivElement>(null);

	const visibleEntries = useMemo(
		() => filterEntries(entries, filter),
		[entries, filter]
	);
	// Furthest appointment first: the next one sits right above "Jetzt".
	const futureItems = useMemo(
		() =>
			[...visibleEntries]
				.reverse()
				.map((entry) =>
					entry.sessionId !== undefined
						? (items[entry.sessionId] ?? unmappedItem)
						: unmappedItem
				),
		[visibleEntries, items, unmappedItem]
	);
	const futureEntries = useMemo(
		() => [...visibleEntries].reverse(),
		[visibleEntries]
	);
	const pastItems = useMemo(
		() =>
			sessions
				.filter((s) => filter === 'all' || s.kind === filter)
				.map((s) => items[s.sessionId])
				.filter(Boolean),
		[sessions, items, filter]
	);

	// Snap stops come from the real cards' height, not from a constant.
	useEffect(() => {
		const inner = futureRef.current;
		if (!inner) return;
		const measure = () => {
			const rows = inner.querySelectorAll<HTMLElement>('.tlp__row');
			const last = rows[rows.length - 1];
			setMeasured({
				// From the next appointment's top edge to the handle.
				item: last
					? Math.round(inner.offsetHeight - last.offsetTop)
					: ENTRY_HEIGHT,
				content: Math.round(inner.scrollHeight)
			});
		};
		measure();
		const observer =
			typeof ResizeObserver !== 'undefined'
				? new ResizeObserver(measure)
				: null;
		observer?.observe(inner);
		return () => observer?.disconnect();
	}, [futureItems.length, selection]);

	const contentHeight = futureItems.length ? measured.content : 0;
	const snapPoints = useMemo(
		() =>
			revealSnapPoints({
				itemHeight: measured.item,
				listHeight,
				contentHeight
			}),
		[measured.item, listHeight, contentHeight]
	);
	// A filter with fewer appointments closes what no longer exists.
	// While dragging the stretch past the last item is shown; at rest it is cut off.
	const shown = dragging ? reveal : clampReveal(reveal, contentHeight);

	const onResize = useCallback((height: number, meta: { final: boolean }) => {
		setDragging(!meta.final);
		setReveal(height);
	}, []);

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
			setReveal(stepSnap(shown, snapPoints, 1));
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

	const futurePane = (
		<div
			className="tlp__future"
			data-dragging={dragging ? 'true' : 'false'}
			style={{ height: shown }}
			data-cy="timeline-future"
		>
			<div
				ref={futureRef}
				className="tlp__futureInner"
				role={futureItems.length ? 'tablist' : 'group'}
				aria-label="Anstehende Termine"
			>
				{futureItems.length === 0 ? (
					<p className="tlp__empty">Keine geplanten Termine</p>
				) : (
					<CardGroup
						items={futureItems}
						isOpenAt={(index) =>
							futureEntries[index].key === selection?.entryKey
						}
						onPick={(index) =>
							setSelection({
								room: roomOf(futureItems[index]),
								entryKey: futureEntries[index].key
							})
						}
						decorate={(item, index) => (
							<TwinAction
								entry={futureEntries[index]}
								role={role}
								active={
									futureEntries[index].key ===
									selection?.entryKey
								}
							/>
						)}
					/>
				)}
			</div>
		</div>
	);

	const handle = (
		<div className="tlp__handleHost">
			<ResizableHandle
				orientation="vertical"
				height={shown}
				maxHeight={contentHeight}
				snapPoints={snapPoints}
				onResize={onResize}
			/>
		</div>
	);

	const pastList = (
		<div
			className="tlp__past"
			role="tablist"
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
					<div className="tlp__boundary">
						{futurePane}
						{handle}
					</div>
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
					<div className="tlp__boundary">
						{futurePane}
						{handle}
					</div>
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
