import * as React from 'react';
import {
	useCallback,
	useEffect,
	useId,
	useLayoutEffect,
	useRef,
	useState
} from 'react';
import { useTranslation } from 'react-i18next';
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded';
import ExploreOutlinedIcon from '@mui/icons-material/ExploreOutlined';
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import RestartAltOutlinedIcon from '@mui/icons-material/RestartAltOutlined';
import { ReactComponent as CloseGlyph } from '../../../resources/img/icons/fab-menu-close.svg';
import {
	ChatMenuDropdown,
	ChatMenuDropdownDivider,
	ChatMenuDropdownHeader,
	ChatMenuDropdownItem,
	handleMenuKeyDown
} from '../../chatMenuDropdown/ChatMenuDropdown';
import type { ITutorialProgressItem } from '../../../api/apiTutorialProgress';
import { actionForStatus, type TourStartMode } from '../TourOverviewCarousel';
import { TourStatusLabel, tourStatusText } from '../TourStatusLabel';
import type { TourDefinition } from '../types';
import {
	clampTourLauncherPosition,
	moveTourLauncherPosition,
	positionFromBox,
	TOUR_LAUNCHER_DRAG_THRESHOLD,
	TOUR_LAUNCHER_EDGE_GAP,
	TOUR_LAUNCHER_KEYBOARD_STEP,
	type TourLauncherBox,
	type TourLauncherPosition
} from './tourLauncherPosition';
import './tourLauncher.styles.scss';

export type TourLauncherProgress = Pick<
	ITutorialProgressItem,
	'tourId' | 'tourVersion' | 'status' | 'completedAt'
>;

export interface TourLauncherMenuProps {
	/** Tours to offer, already filtered and ordered for this user and page. */
	tours: TourDefinition[];
	progress: TourLauncherProgress[];
	onStartTour: (tour: TourDefinition, mode: TourStartMode) => void;
	/** "Rundgänge verwalten": Help → Rundgänge, where the switch lives. */
	onManage: () => void;
	/** Called when the card opens, e.g. to refresh the progress. */
	onOpen?: () => void;
	/** Start with the card open (stories / comparisons). */
	defaultOpen?: boolean;
	/** Where the user moved the "?"; `null`/absent: the default corner. */
	position?: TourLauncherPosition | null;
	/** A drag or Alt+arrow move ends here; `null` resets the position. */
	onMove?: (position: TourLauncherPosition | null) => void;
	/** "Hilfe-Button ausblenden", after the confirm step. */
	onHide?: () => void;
}

/** Without a layout (jsdom, first paint) the FAB is 56 px square. */
const FAB_FALLBACK_SIZE = 56;
const MENU_GAP = 4;
const MENU_MAX_HEIGHT = 520;

const ARROW_STEPS: Record<string, [number, number]> = {
	ArrowLeft: [-TOUR_LAUNCHER_KEYBOARD_STEP, 0],
	ArrowRight: [TOUR_LAUNCHER_KEYBOARD_STEP, 0],
	ArrowUp: [0, -TOUR_LAUNCHER_KEYBOARD_STEP],
	ArrowDown: [0, TOUR_LAUNCHER_KEYBOARD_STEP]
};

const progressOf = (tour: TourDefinition, progress: TourLauncherProgress[]) =>
	progress.find(
		(item) => item.tourId === tour.id && item.tourVersion === tour.version
	);

const viewportBox = (): TourLauncherBox => ({
	width: window.innerWidth,
	height: window.innerHeight
});

const sizeOf = (element: HTMLElement | null): TourLauncherBox => {
	const rect = element?.getBoundingClientRect();
	return {
		width: rect?.width || FAB_FALLBACK_SIZE,
		height: rect?.height || FAB_FALLBACK_SIZE
	};
};

/** Inline placement for a moved "?"; the default corner stays in CSS. */
const placementStyle = (
	position: TourLauncherPosition,
	viewport: TourLauncherBox,
	size: TourLauncherBox
): React.CSSProperties => {
	// Room for the card on the side it opens to (away from the edge).
	const menuSpace = Math.max(
		0,
		viewport.height -
			position.y -
			size.height -
			MENU_GAP -
			TOUR_LAUNCHER_EDGE_GAP
	);
	return {
		[position.h]: `${position.x}px`,
		[position.h === 'left' ? 'right' : 'left']: 'auto',
		[position.v]: `${position.y}px`,
		[position.v === 'top' ? 'bottom' : 'top']: 'auto',
		['--tourLauncher-menu-space' as string]: `${Math.min(
			MENU_MAX_HEIGHT,
			menuSpace
		)}px`
	};
};

interface DragState {
	pointerId: number;
	startX: number;
	startY: number;
	left: number;
	top: number;
	size: TourLauncherBox;
	dragging: boolean;
}

/**
 * The "?" tour launcher: the design system's FAB (Figma "FAB menu"
 * 9748:60084) opening the chat menu organism with one row per tour
 * (title + status). Picking a row starts, continues or restarts that tour.
 * The FAB is its own drag handle (FE#2545): a press that moves less than
 * 6 px is still a click; Alt+arrow keys move it in 16 px steps.
 */
export const TourLauncherMenu = ({
	tours,
	progress,
	onStartTour,
	onManage,
	onOpen,
	defaultOpen = false,
	position = null,
	onMove,
	onHide
}: TourLauncherMenuProps) => {
	const { t: translate } = useTranslation();
	const [open, setOpen] = useState(defaultOpen);
	const [confirmHide, setConfirmHide] = useState(false);
	const [draft, setDraft] = useState<TourLauncherPosition | null>(null);
	const [viewport, setViewport] = useState<TourLauncherBox>(viewportBox);
	const rootRef = useRef<HTMLDivElement | null>(null);
	const fabRef = useRef<HTMLButtonElement | null>(null);
	const menuRef = useRef<HTMLDivElement | null>(null);
	const listRef = useRef<HTMLUListElement | null>(null);
	const dragRef = useRef<DragState | null>(null);
	const suppressClickRef = useRef(false);
	const menuId = useId();
	const moveHintId = useId();
	const movable = !!onMove;

	const close = useCallback(() => {
		setOpen(false);
		setConfirmHide(false);
	}, []);
	const closeAndRefocus = useCallback(() => {
		close();
		fabRef.current?.focus();
	}, [close]);

	// Clamp to the viewport on resize: the button is never off-screen.
	useEffect(() => {
		if (!movable) return undefined;
		const onResize = () => setViewport(viewportBox());
		window.addEventListener('resize', onResize);
		return () => window.removeEventListener('resize', onResize);
	}, [movable]);

	useEffect(() => {
		if (!open) return undefined;
		// Keyboard users land on the first tour.
		listRef.current
			?.querySelector<HTMLElement>('[role="menuitem"]')
			?.focus();
		const onPointerDown = (event: PointerEvent) => {
			if (!rootRef.current?.contains(event.target as Node)) close();
		};
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') closeAndRefocus();
		};
		document.addEventListener('pointerdown', onPointerDown);
		document.addEventListener('keydown', onKeyDown);
		return () => {
			document.removeEventListener('pointerdown', onPointerDown);
			document.removeEventListener('keydown', onKeyDown);
		};
	}, [open, close, closeAndRefocus]);

	const shown = draft ?? position;
	const size = sizeOf(fabRef.current);
	const placed = shown
		? clampTourLauncherPosition(shown, viewport, size)
		: null;

	// The card opens toward the free side; a narrow screen shifts it back in.
	useLayoutEffect(() => {
		const menu = menuRef.current;
		if (!open || !menu) return;
		menu.style.translate = '';
		const rect = menu.getBoundingClientRect();
		if (!rect.width) return;
		const overflowLeft = TOUR_LAUNCHER_EDGE_GAP - rect.left;
		const overflowRight =
			rect.right - (window.innerWidth - TOUR_LAUNCHER_EDGE_GAP);
		const shift =
			overflowLeft > 0
				? overflowLeft
				: overflowRight > 0
					? -overflowRight
					: 0;
		if (shift) menu.style.translate = `${shift}px 0`;
	}, [open, placed?.h, placed?.x, placed?.v, placed?.y, viewport]);

	const toggle = () => {
		if (suppressClickRef.current) {
			// The press was a drag: it moved the button, it does not open it.
			suppressClickRef.current = false;
			return;
		}
		if (!open) onOpen?.();
		setOpen((value) => !value);
		setConfirmHide(false);
	};

	const onPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
		if (!movable || (event.pointerType === 'mouse' && event.button !== 0))
			return;
		const rect = event.currentTarget.getBoundingClientRect();
		dragRef.current = {
			pointerId: event.pointerId,
			startX: event.clientX,
			startY: event.clientY,
			left: rect.left,
			top: rect.top,
			size: sizeOf(event.currentTarget),
			dragging: false
		};
		suppressClickRef.current = false;
	};

	const onPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
		const drag = dragRef.current;
		if (!drag || drag.pointerId !== event.pointerId) return;
		const dx = event.clientX - drag.startX;
		const dy = event.clientY - drag.startY;
		if (!drag.dragging && Math.hypot(dx, dy) < TOUR_LAUNCHER_DRAG_THRESHOLD)
			return;
		if (!drag.dragging) {
			drag.dragging = true;
			try {
				// Keeps the moves coming when the pointer outruns the FAB.
				event.currentTarget.setPointerCapture?.(event.pointerId);
			} catch {
				// A pointer the browser no longer tracks: drag without it.
			}
			close();
		}
		setDraft(
			positionFromBox(
				drag.left + dx,
				drag.top + dy,
				viewportBox(),
				drag.size
			)
		);
	};

	const endDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
		const drag = dragRef.current;
		if (!drag || drag.pointerId !== event.pointerId) return;
		dragRef.current = null;
		if (!drag.dragging) return;
		suppressClickRef.current = event.type === 'pointerup';
		const dx = event.clientX - drag.startX;
		const dy = event.clientY - drag.startY;
		const next = positionFromBox(
			drag.left + dx,
			drag.top + dy,
			viewportBox(),
			drag.size
		);
		setDraft(null);
		onMove?.(next);
	};

	const onFabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
		const step = ARROW_STEPS[event.key];
		if (!movable || !event.altKey || !step) return;
		event.preventDefault();
		const rect = event.currentTarget.getBoundingClientRect();
		onMove?.(
			moveTourLauncherPosition(
				rect,
				step[0],
				step[1],
				viewportBox(),
				sizeOf(event.currentTarget)
			)
		);
	};

	const title = translate('tour.launcher.title');
	const fabLabel = translate(
		open ? 'tour.launcher.close' : 'tour.launcher.open'
	);
	const hideTitle = translate(
		confirmHide ? 'tour.launcher.hideConfirm' : 'tour.launcher.hide'
	);
	const hideWhere = translate('tour.launcher.hideWhere');

	const className = [
		'tourLauncher',
		open && 'tourLauncher--open',
		placed && 'tourLauncher--moved',
		placed?.h === 'left' && 'tourLauncher--left',
		placed?.v === 'top' && 'tourLauncher--top',
		draft && 'tourLauncher--dragging'
	]
		.filter(Boolean)
		.join(' ');

	return (
		<div
			ref={rootRef}
			className={className}
			style={placed ? placementStyle(placed, viewport, size) : undefined}
			data-cy="tour-launcher"
			data-position={placed ? `${placed.v}-${placed.h}` : 'default'}
		>
			{open && (
				<div ref={menuRef} className="tourLauncher__menu">
					<ChatMenuDropdown
						className="tourLauncher__card"
						role="presentation"
						data-cy="tour-launcher-menu"
					>
						<ChatMenuDropdownHeader
							subtitle={translate('tour.launcher.eyebrow')}
							title={title}
						/>
						<ChatMenuDropdownDivider />
						<ul
							ref={listRef}
							id={menuId}
							role="menu"
							aria-label={title}
							className="chatMenuDropdown__section tourLauncher__list"
							onKeyDown={handleMenuKeyDown}
						>
							{tours.map((tour) => {
								const item = progressOf(tour, progress);
								const status = item?.status ?? 'not_started';
								const mode = actionForStatus(status);
								const tourTitle = translate(tour.titleKey);
								const statusLabel = tourStatusText(
									translate,
									status,
									item?.completedAt
								);
								return (
									<li key={tour.id} role="none">
										<ChatMenuDropdownItem
											role="menuitem"
											className="tourLauncher__item"
											data-cy={`tour-launcher-item-${tour.id}`}
											data-status={status}
											aria-label={`${translate(
												`walkthrough.overview.action.${mode}`
											)}: ${tourTitle} – ${statusLabel}`}
											icon={
												<ExploreOutlinedIcon aria-hidden="true" />
											}
											title={tourTitle}
											description={
												<TourStatusLabel
													status={status}
													completedAt={
														item?.completedAt
													}
												/>
											}
											onClick={() => {
												close();
												onStartTour(tour, mode);
											}}
										/>
									</li>
								);
							})}
							<ChatMenuDropdownDivider as="li" role="separator" />
							<li role="none">
								<ChatMenuDropdownItem
									role="menuitem"
									data-cy="tour-launcher-manage"
									icon={
										<TuneOutlinedIcon aria-hidden="true" />
									}
									title={translate('tour.launcher.manage')}
									onClick={() => {
										close();
										onManage();
									}}
								/>
							</li>
							{onHide && (
								<li role="none">
									{/* Two steps, inside the same row: the
									    first press names the consequence and
									    where to undo it, the second hides. */}
									<ChatMenuDropdownItem
										role="menuitem"
										data-cy="tour-launcher-hide"
										data-confirm={confirmHide || undefined}
										aria-label={
											confirmHide
												? `${hideTitle} ${hideWhere}`
												: hideTitle
										}
										icon={
											<VisibilityOffOutlinedIcon aria-hidden="true" />
										}
										title={hideTitle}
										description={
											confirmHide ? hideWhere : undefined
										}
										onClick={() => {
											if (!confirmHide) {
												setConfirmHide(true);
												return;
											}
											close();
											onHide();
										}}
									/>
								</li>
							)}
							{movable && position && (
								<li role="none">
									<ChatMenuDropdownItem
										role="menuitem"
										data-cy="tour-launcher-reset-position"
										icon={
											<RestartAltOutlinedIcon aria-hidden="true" />
										}
										title={translate(
											'tour.launcher.resetPosition'
										)}
										onClick={() => {
											closeAndRefocus();
											onMove?.(null);
										}}
									/>
								</li>
							)}
						</ul>
					</ChatMenuDropdown>
				</div>
			)}
			<button
				ref={fabRef}
				type="button"
				className="tourLauncher__fab"
				data-cy="tour-launcher-fab"
				aria-label={fabLabel}
				title={fabLabel}
				aria-haspopup="menu"
				aria-expanded={open}
				aria-controls={open ? menuId : undefined}
				aria-describedby={movable ? moveHintId : undefined}
				aria-keyshortcuts={
					movable
						? 'Alt+ArrowUp Alt+ArrowDown Alt+ArrowLeft Alt+ArrowRight'
						: undefined
				}
				onClick={toggle}
				onKeyDown={onFabKeyDown}
				onPointerDown={onPointerDown}
				onPointerMove={onPointerMove}
				onPointerUp={endDrag}
				onPointerCancel={endDrag}
			>
				{movable && (
					<span
						className="tourLauncher__grip"
						data-cy="tour-launcher-grip"
						title={translate('tour.launcher.dragHint')}
						aria-hidden="true"
					/>
				)}
				{open ? (
					<CloseGlyph
						className="tourLauncher__fabIcon"
						aria-hidden="true"
					/>
				) : (
					<HelpOutlineRoundedIcon
						className="tourLauncher__fabIcon"
						aria-hidden="true"
					/>
				)}
			</button>
			{movable && (
				<span id={moveHintId} className="sr-only">
					{translate('tour.launcher.moveHint')}
				</span>
			)}
		</div>
	);
};
