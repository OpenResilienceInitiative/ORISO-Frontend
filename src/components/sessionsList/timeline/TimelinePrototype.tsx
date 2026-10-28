/**
 * Chat-history timeline PROTOTYPE (ADR-021, PR 2) — Storybook only, nothing
 * here is wired into the real list. It answers three questions by hand:
 * how the future handle feels, which scroll model and which "Jetzt" marker
 * work, and what the twin entries and their menu look like.
 */
import * as React from 'react';
import {
	useCallback,
	useEffect,
	useId,
	useMemo,
	useRef,
	useState
} from 'react';
import { createPortal } from 'react-dom';
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
import './timelinePrototype.styles.scss';

export type ScrollModel = 'panes' | 'single';
export type NowVariant = 'line' | 'handle' | 'band';

export const ENTRY_HEIGHT = 124;
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

const FILTERS: [TimelineFilter, string][] = [
	['all', 'Alle'],
	['group', 'Gruppen'],
	['one-to-one', '1:1']
];

type Selection =
	| { via: 'session'; sessionId: number }
	| { via: 'entry'; key: string; sessionId?: number }
	| null;

export interface TimelinePrototypeProps {
	entries: FutureEntry[];
	sessions: TimelineSession[];
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

const EntryCard = ({
	entry,
	role,
	state,
	onSelect
}: {
	entry: FutureEntry;
	role: TimelineRole;
	state: 'full' | 'calm' | 'none';
	onSelect: () => void;
}) => {
	const [menuAnchor, setMenuAnchor] = useState<DOMRect | null>(null);
	const toggleRef = useRef<HTMLButtonElement | null>(null);
	const menuId = useId();
	const Icon = MODALITY_ICON[entry.modality];
	return (
		<div
			className={`tlp__entry tlp__entry--${state}`}
			role="group"
			aria-label={`${entry.title}, ${formatEntryDate(entry.start)}`}
			data-cy="timeline-entry"
			data-entry-key={entry.key}
			data-selected={state === 'full' ? 'true' : 'false'}
			onClick={onSelect}
		>
			<button
				type="button"
				className="tlp__entryHead"
				aria-current={state === 'full' ? 'true' : undefined}
				onClick={onSelect}
			>
				{entry.topic && <span className="tlp__tag">{entry.topic}</span>}
				<span className="tlp__entryTitle">{entry.title}</span>
			</button>
			<div
				className="tlp__entryAction"
				onClick={(e) => e.stopPropagation()}
			>
				<SplitButton
					size="compact"
					variant={state === 'full' ? 'primary' : 'tonal'}
					label={formatEntryDate(entry.start)}
					icon={<Icon />}
					mainOpensMenu={false}
					onClick={onSelect}
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
			</div>
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

export const TimelinePrototype = ({
	entries,
	sessions,
	role = 'counsellor',
	scrollModel = 'panes',
	nowVariant = 'line',
	listHeight = 520,
	initialFilter = 'all'
}: TimelinePrototypeProps) => {
	const [filter, setFilter] = useState<TimelineFilter>(initialFilter);
	const [reveal, setReveal] = useState(0);
	const [dragging, setDragging] = useState(false);
	const [selection, setSelection] = useState<Selection>(null);
	const [nowOffscreen, setNowOffscreen] = useState<'above' | 'below' | null>(
		null
	);
	const pullRef = useRef(0);
	const scrollRef = useRef<HTMLDivElement>(null);
	const nowRef = useRef<HTMLDivElement>(null);

	const visibleEntries = useMemo(
		() => filterEntries(entries, filter),
		[entries, filter]
	);
	const visibleSessions = useMemo(
		() =>
			sessions.filter((s) => {
				if (filter === 'all') return true;
				return s.kind === filter;
			}),
		[sessions, filter]
	);
	const contentHeight = visibleEntries.length * ENTRY_HEIGHT;
	const snapPoints = useMemo(
		() =>
			revealSnapPoints({
				itemHeight: ENTRY_HEIGHT,
				listHeight,
				contentHeight
			}),
		[listHeight, contentHeight]
	);
	// A filter that has fewer appointments closes what no longer exists.
	// While dragging the stretch past the last item is shown; at rest it is cut off.
	const shown = dragging ? reveal : clampReveal(reveal, contentHeight);

	const onResize = useCallback((height: number, meta: { final: boolean }) => {
		setDragging(!meta.final);
		setReveal(height);
	}, []);

	const stateOfEntry = (entry: FutureEntry): 'full' | 'calm' | 'none' => {
		if (!selection) return 'none';
		if (selection.via === 'entry' && selection.key === entry.key)
			return 'full';
		return selection.sessionId !== undefined &&
			selection.sessionId === entry.sessionId
			? 'calm'
			: 'none';
	};
	const stateOfSession = (
		session: TimelineSession
	): 'full' | 'calm' | 'none' => {
		if (!selection || selection.sessionId !== session.sessionId)
			return 'none';
		return selection.via === 'session' ? 'full' : 'calm';
	};

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
				className="tlp__futureInner"
				role="group"
				tabIndex={0}
				aria-label="Anstehende Termine"
			>
				{visibleEntries.map((entry) => (
					<EntryCard
						key={entry.key}
						entry={entry}
						role={role}
						state={stateOfEntry(entry)}
						onSelect={() =>
							setSelection({
								via: 'entry',
								key: entry.key,
								sessionId: entry.sessionId
							})
						}
					/>
				))}
				{visibleEntries.length === 0 && (
					<p className="tlp__empty">Keine geplanten Termine</p>
				)}
			</div>
		</div>
	);

	const pastList = (
		<div
			className="tlp__past"
			role="tablist"
			aria-label="Gespräche"
			data-cy="timeline-past"
		>
			{visibleSessions.map((session, index) => {
				const state = stateOfSession(session);
				return (
					<div
						key={session.sessionId}
						className={`tlp__card tlp__card--${state}${
							index === 0 ? ' tlp__card--first' : ''
						}${index === visibleSessions.length - 1 ? ' tlp__card--last' : ''}`}
						role="tab"
						tabIndex={0}
						aria-selected={state === 'full'}
						onClick={() =>
							setSelection({
								via: 'session',
								sessionId: session.sessionId
							})
						}
						onKeyDown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								setSelection({
									via: 'session',
									sessionId: session.sessionId
								});
							}
						}}
						data-cy="timeline-card"
					>
						<span className="tlp__tag">{session.topic}</span>
						<span className="tlp__cardTitle">{session.title}</span>
						<span className="tlp__cardPreview">
							{session.lastMessage}
						</span>
					</div>
				);
			})}
		</div>
	);

	return (
		<div
			className="tlp"
			data-scroll-model={scrollModel}
			data-cy="timeline-prototype"
		>
			<div className="tlp__chips" role="group" aria-label="Filter">
				{FILTERS.map(([key, label]) => (
					<button
						key={key}
						type="button"
						className={`tlp__chip${filter === key ? ' tlp__chip--on' : ''}`}
						aria-pressed={filter === key}
						onClick={() => setFilter(key)}
					>
						{label}
					</button>
				))}
			</div>

			{scrollModel === 'panes' ? (
				<>
					<div className="tlp__boundary">
						{futurePane}
						<div className="tlp__handleHost">
							<ResizableHandle
								orientation="vertical"
								height={shown}
								maxHeight={contentHeight}
								snapPoints={snapPoints}
								onResize={onResize}
							/>
						</div>
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
						<div className="tlp__handleHost">
							<ResizableHandle
								orientation="vertical"
								height={shown}
								maxHeight={contentHeight}
								snapPoints={snapPoints}
								onResize={onResize}
							/>
						</div>
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
