/**
 * One planned appointment as a split button (ADR-021): modality icon + date,
 * the arrow opens the appointment menu. The same button sits on a list card
 * that has a next appointment and below the room header.
 */
import * as React from 'react';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import './appointmentSplitButton.styles.scss';
import { SplitButton } from '../../splitButton/SplitButton';
import { normalizeTimelineLocale } from '../futureTimelineTime';
import {
	ChatMenuDropdown,
	ChatMenuDropdownItem
} from '../../chatMenuDropdown/ChatMenuDropdown';
import { ReactComponent as EventBusyIcon } from '../../../resources/img/icons/timeline-event-busy.svg';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import EventRepeatOutlinedIcon from '@mui/icons-material/EventRepeatOutlined';
import NotificationsOutlinedIcon from '@mui/icons-material/NotificationsOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import { MODALITY_ICON } from './AppointmentKindGlyph';
import {
	entryMenu,
	formatEntrySlot,
	type FutureEntry,
	type TimelineRole
} from './timelineModel';

const MENU_ICON: Record<string, React.ElementType> = {
	edit: EditOutlinedIcon,
	reschedule: EventRepeatOutlinedIcon,
	cancel: EventBusyIcon,
	duplicate: ContentCopyOutlinedIcon,
	configure: SettingsOutlinedIcon,
	reminder: NotificationsOutlinedIcon
};

export type MenuAnchor = Pick<DOMRect, 'top' | 'bottom' | 'right'>;

export type AppointmentAction = (key: string, entry: FutureEntry) => void;

const MENU_WIDTH = 320;
const MENU_GAP = 8;
const VIEWPORT_INSET = 8;

/**
 * Where the menu sits: below the arrow, or above it when it would leave the
 * window below and fits above. When it fits neither way it stays whole and
 * covers the arrow; its own stylesheet caps it at the window's height and it
 * scrolls inside its frame.
 */
export const entryMenuPosition = (
	anchor: MenuAnchor,
	menuHeight: number,
	viewport: { width: number; height: number }
): { top: number; left: number } => {
	const below = anchor.bottom + MENU_GAP;
	const roomBelow = viewport.height - below - VIEWPORT_INSET;
	const roomAbove = anchor.top - MENU_GAP - VIEWPORT_INSET;
	const left = Math.max(
		VIEWPORT_INSET,
		Math.min(
			anchor.right - MENU_WIDTH,
			viewport.width - MENU_WIDTH - VIEWPORT_INSET
		)
	);
	if (menuHeight <= roomBelow) return { top: below, left };
	if (menuHeight <= roomAbove)
		return { top: anchor.top - MENU_GAP - menuHeight, left };
	return {
		top: Math.max(
			VIEWPORT_INSET,
			viewport.height - VIEWPORT_INSET - menuHeight
		),
		left
	};
};

export const EntryMenu = ({
	entry,
	role,
	anchor,
	opener,
	onClose,
	onAction
}: {
	entry: FutureEntry;
	role: TimelineRole;
	anchor: MenuAnchor;
	/** The control that toggles the menu: a press on it is not "outside". */
	opener?: React.RefObject<HTMLElement | null>;
	onClose: () => void;
	onAction?: AppointmentAction;
}) => {
	const items = entryMenu(entry, role);
	const ref = useRef<HTMLDivElement>(null);
	const [menuHeight, setMenuHeight] = useState(0);
	useLayoutEffect(() => {
		setMenuHeight(ref.current?.getBoundingClientRect().height ?? 0);
	}, [items.length]);
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
		const onDown = (e: MouseEvent) =>
			!ref.current?.contains(e.target as Node) &&
			!opener?.current?.contains(e.target as Node) &&
			onClose();
		// Capture: the card's appointment row stops keys from reaching the card.
		document.addEventListener('keydown', onKey, true);
		document.addEventListener('mousedown', onDown);
		return () => {
			document.removeEventListener('keydown', onKey, true);
			document.removeEventListener('mousedown', onDown);
		};
	}, [onClose, opener]);
	return createPortal(
		<div
			onClick={(e) => e.stopPropagation()}
			style={{
				position: 'fixed',
				zIndex: 1400,
				...entryMenuPosition(anchor, menuHeight, {
					width: window.innerWidth,
					height: window.innerHeight
				})
			}}
		>
			<ChatMenuDropdown
				ref={ref}
				role="menu"
				ariaLabel="Termin"
				data-cy="timeline-entry-menu"
				style={{ width: MENU_WIDTH }}
			>
				{items.map((item) => {
					const ItemIcon = MENU_ICON[item.key];
					return (
						<ChatMenuDropdownItem
							key={item.key}
							role="menuitem"
							icon={ItemIcon && <ItemIcon />}
							title={item.title}
							description={item.description}
							disabled={item.disabled}
							onClick={() => {
								onClose();
								onAction?.(item.key, entry);
							}}
						/>
					);
				})}
			</ChatMenuDropdown>
		</div>,
		document.body
	);
};

export interface AppointmentSplitButtonProps {
	entry: FutureEntry;
	role: TimelineRole;
	/** Primary (red) on the open card, tonal (grey) everywhere else. */
	active?: boolean;
	/** `xsmall` (32px) on a list card, `compact` (40px) below the room header. */
	size?: 'xsmall' | 'compact';
	/** Stretch across the card (the row below its text). */
	fullWidth?: boolean;
	/**
	 * The main part opens the appointment's room. Omitted inside that room
	 * (below its header): the main part opens the same menu as the arrow.
	 */
	onOpen?: () => void;
	/** A menu entry was chosen (cancel, duplicate, configure, ...). */
	onAction?: AppointmentAction;
}

export const AppointmentSplitButton = ({
	entry,
	role,
	active = false,
	size = 'xsmall',
	fullWidth = false,
	onOpen,
	onAction
}: AppointmentSplitButtonProps) => {
	const { i18n } = useTranslation();
	const locale = normalizeTimelineLocale(
		i18n.resolvedLanguage,
		i18n.language
	);
	const [menuAnchor, setMenuAnchor] = useState<MenuAnchor | null>(null);
	const toggleRef = useRef<HTMLButtonElement | null>(null);
	const menuId = useId();
	const Icon = MODALITY_ICON[entry.modality];
	const toggleMenu = () => {
		const arrow = toggleRef.current?.getBoundingClientRect();
		if (menuAnchor || !arrow) {
			setMenuAnchor(null);
			return;
		}
		// On a card the kind sits beside the button: the menu ends with the card's text.
		const row = toggleRef.current?.closest(
			'[data-cy="session-card-appointment"]'
		);
		setMenuAnchor({
			top: arrow.top,
			bottom: arrow.bottom,
			right: row ? row.getBoundingClientRect().right - 16 : arrow.right
		});
	};
	return (
		<>
			<SplitButton
				size={size}
				fullWidth={fullWidth}
				variant={active ? 'primary' : 'tonal'}
				label={formatEntrySlot(entry, locale)}
				icon={<Icon />}
				mainOpensMenu={!onOpen}
				onClick={onOpen ?? toggleMenu}
				onToggleMenu={toggleMenu}
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
					opener={toggleRef}
					onClose={() => setMenuAnchor(null)}
					onAction={onAction}
				/>
			)}
		</>
	);
};

/**
 * The room's next appointment, directly below the header divider (ADR-021),
 * on phone and desktop. Group rooms show it after `sessionInfo__headerWrapper`
 * in `GroupChatHeader` (`RoomNextAppointmentSlot`); 1:1 rooms get it after
 * `sessionInfo__metaInfo` once a booking carries its session id.
 */
export const RoomNextAppointment = ({
	entry,
	role,
	onAction
}: {
	entry?: FutureEntry;
	role: TimelineRole;
	onAction?: AppointmentAction;
}) =>
	entry ? (
		<div className="roomNextAppointment" data-cy="room-next-appointment">
			<AppointmentSplitButton
				entry={entry}
				role={role}
				size="compact"
				onAction={onAction}
			/>
		</div>
	) : null;
