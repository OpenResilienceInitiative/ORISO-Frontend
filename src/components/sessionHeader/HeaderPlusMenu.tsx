/**
 * The 1:1 header "+" as a small menu (Frank, 17.11.2026): next to
 * "Supervisor verwalten" it offers "Beratung übergeben", the same handover
 * the ⋮ menu and the profile button open (FE#2250). Each entry says in one
 * line what happens to the case, because the two are easy to mix up: a
 * supervisor only watches along, a handover moves the case away.
 *
 * CompactActionMenu owns its own trigger, so it cannot replace the header "+"
 * (pending state, avatar overlay, practice tour). This menu uses the same
 * shared atoms: useChatMenuPosition, MenuBackdrop, and Popover.
 */
import * as React from 'react';
import { useEffect, useRef } from 'react';
import { Popover } from '@mui/material';
import { useTranslation } from 'react-i18next';
import SupervisorAccountOutlinedIcon from '@mui/icons-material/SupervisorAccountOutlined';
import {
	ChatMenuDropdown,
	ChatMenuDropdownItem,
	handleMenuKeyDown
} from '../chatMenuDropdown/ChatMenuDropdown';
import { MenuBackdrop } from '../chatMenuDropdown/MenuBackdrop';
import { useChatMenuPosition } from '../chatMenuDropdown/useChatMenuPosition';
import { ReactComponent as HandoverIcon } from '../../resources/img/icons/case_handover_200_24px.svg';

const MENU_WIDTH = 320;

export interface HeaderPlusMenuProps {
	/** The "+" itself: the menu anchors to it, and pressing it again is not an outside press. */
	opener: React.RefObject<HTMLElement | null>;
	/** Supervision can be managed here (`getSupervisorAddState` interactive). */
	supervisionAvailable: boolean;
	/** Why supervision cannot be managed here, shown on the disabled entry. */
	supervisionUnavailableLabel?: string;
	onSupervision: () => void;
	onHandover: () => void;
	onClose: () => void;
}

export const HeaderPlusMenu = ({
	opener,
	supervisionAvailable,
	supervisionUnavailableLabel,
	onSupervision,
	onHandover,
	onClose
}: HeaderPlusMenuProps) => {
	const { t: translate } = useTranslation();
	const menuRef = useRef<HTMLDivElement>(null);
	const style = useChatMenuPosition({
		open: true,
		anchorRef: opener,
		menuRef,
		width: MENU_WIDTH
	});

	useEffect(() => {
		if (style.visibility !== 'visible') return;
		menuRef.current
			?.querySelector<HTMLElement>(
				'[role="menuitem"]:not([aria-disabled="true"]):not(:disabled)'
			)
			?.focus();
	}, [style.visibility]);

	useEffect(() => {
		// Focus landing anywhere but the menu or the "+" closes it, also when
		// it got there through the "+" (menu → "+" → next control).
		const onFocus = (e: FocusEvent) =>
			!menuRef.current?.contains(e.target as Node) &&
			!opener.current?.contains(e.target as Node) &&
			onClose();
		// A press outside the menu and the "+" closes it, also with menu
		// effects off, when there is no backdrop to take that press.
		const onPress = (e: MouseEvent) =>
			!menuRef.current?.contains(e.target as Node) &&
			!opener.current?.contains(e.target as Node) &&
			onClose();
		document.addEventListener('focusin', onFocus);
		document.addEventListener('mousedown', onPress);
		return () => {
			document.removeEventListener('focusin', onFocus);
			document.removeEventListener('mousedown', onPress);
		};
	}, [onClose, opener]);

	return (
		<>
			<MenuBackdrop
				open
				onClose={onClose}
				spotlightRef={opener}
				zIndex={1399}
			/>
			<Popover
				open
				anchorReference="none"
				hideBackdrop
				disableAutoFocus
				disableEnforceFocus
				disableRestoreFocus
				transitionDuration={0}
				// The popover root covers the window above the backdrop. It lets
				// presses through, so a press beside the menu reaches the
				// backdrop and a second press on "+" reaches the "+" (which
				// takes focus and closes the menu); only the menu takes presses.
				sx={{ zIndex: 1400, pointerEvents: 'none' }}
				onClose={(_, reason) => {
					onClose();
					if (reason === 'escapeKeyDown') opener.current?.focus();
				}}
				PaperProps={{
					ref: menuRef,
					style,
					sx: {
						pointerEvents: 'auto',
						background: 'transparent',
						boxShadow: 'none',
						overflow: 'visible'
					}
				}}
			>
				<ChatMenuDropdown
					role="menu"
					ariaLabel={translate(
						'sessionHeader.supervisor.plusMenu.menuLabel'
					)}
					data-cy="session-header-plus-menu"
					style={{ width: '100%' }}
					onKeyDown={handleMenuKeyDown}
					onBlur={(e) => {
						// Tab out of the menu closes it; moving between its items,
						// back to the "+" or out of the window does not.
						const next = e.relatedTarget as Node | null;
						if (
							next &&
							!menuRef.current?.contains(next) &&
							!opener.current?.contains(next)
						)
							onClose();
					}}
				>
					<ChatMenuDropdownItem
						role="menuitem"
						data-cy="session-header-plus-supervision"
						icon={<SupervisorAccountOutlinedIcon />}
						title={translate(
							'sessionHeader.supervisor.modal.title'
						)}
						description={
							supervisionAvailable
								? translate(
										'sessionHeader.supervisor.plusMenu.supervisionHint'
									)
								: supervisionUnavailableLabel
						}
						disabled={!supervisionAvailable}
						onClick={() => {
							if (!supervisionAvailable) return;
							// The dialog returns focus to whatever had it when it
							// opened: that must be the "+", not this item.
							opener.current?.focus();
							onClose();
							onSupervision();
						}}
					/>
					<ChatMenuDropdownItem
						role="menuitem"
						data-cy="session-header-plus-handover"
						icon={<HandoverIcon aria-hidden="true" />}
						title={translate('caseHandover.offer.open')}
						description={translate(
							'sessionHeader.supervisor.plusMenu.handoverHint'
						)}
						onClick={() => {
							opener.current?.focus();
							onClose();
							onHandover();
						}}
					/>
				</ChatMenuDropdown>
			</Popover>
		</>
	);
};
