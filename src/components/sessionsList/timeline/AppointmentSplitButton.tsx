/**
 * One planned appointment as a split button (ADR-021): modality icon + date,
 * the arrow opens the appointment menu. The same button sits on the twin card
 * in the future part of the list and below the room header.
 */
import * as React from 'react';
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './appointmentSplitButton.styles.scss';
import { SplitButton } from '../../splitButton/SplitButton';
import {
	ChatMenuDropdown,
	ChatMenuDropdownItem
} from '../../chatMenuDropdown/ChatMenuDropdown';
import { ReactComponent as ChatIcon } from '../../../resources/img/icons/modality-chat.svg';
import { ReactComponent as AudioIcon } from '../../../resources/img/icons/modality-audio.svg';
import { ReactComponent as VideoIcon } from '../../../resources/img/icons/modality-video.svg';
import { ReactComponent as LocationIcon } from '../../../resources/img/icons/location.svg';
import {
	entryMenu,
	formatEntryDate,
	type EntryModality,
	type FutureEntry,
	type TimelineRole
} from './timelineModel';

const MODALITY_ICON: Record<
	EntryModality,
	React.FC<React.SVGProps<SVGSVGElement>>
> = {
	chat: ChatIcon,
	audio: AudioIcon,
	video: VideoIcon,
	location: LocationIcon
};

export type AppointmentAction = (key: string, entry: FutureEntry) => void;

const EntryMenu = ({
	entry,
	role,
	anchor,
	onClose,
	onAction
}: {
	entry: FutureEntry;
	role: TimelineRole;
	anchor: DOMRect;
	onClose: () => void;
	onAction?: AppointmentAction;
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
						onClick={() => {
							onClose();
							onAction?.(item.key, entry);
						}}
					/>
				))}
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
	/** `small` on the twin card, `compact` (40px) below the room header. */
	size?: 'small' | 'compact';
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
	size = 'small',
	onOpen,
	onAction
}: AppointmentSplitButtonProps) => {
	const [menuAnchor, setMenuAnchor] = useState<DOMRect | null>(null);
	const toggleRef = useRef<HTMLButtonElement | null>(null);
	const menuId = useId();
	const Icon = MODALITY_ICON[entry.modality];
	const toggleMenu = () =>
		setMenuAnchor(
			menuAnchor
				? null
				: (toggleRef.current?.getBoundingClientRect() ?? null)
		);
	return (
		<>
			<SplitButton
				size={size}
				variant={active ? 'primary' : 'tonal'}
				label={formatEntryDate(entry.start)}
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
