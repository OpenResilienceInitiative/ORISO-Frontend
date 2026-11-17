/**
 * The 1:1 header "+" as a small menu (Frank, 17.11.2026): next to
 * "Supervisor verwalten" it offers "Beratung übergeben", the same handover
 * the ⋮ menu and the profile button open (FE#2250). Each entry says in one
 * line what happens to the case, because the two are easy to mix up: a
 * supervisor only watches along, a handover moves the case away.
 */
import * as React from 'react';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import SupervisorAccountOutlinedIcon from '@mui/icons-material/SupervisorAccountOutlined';
import {
	ChatMenuDropdown,
	ChatMenuDropdownItem,
	handleMenuKeyDown
} from '../chatMenuDropdown/ChatMenuDropdown';
import { ReactComponent as HandoverIcon } from '../../resources/img/icons/case_handover_200_24px.svg';

const MENU_WIDTH = 320;
const GAP = 8;
const INSET = 8;

export type PlusMenuAnchor = Pick<DOMRect, 'left' | 'bottom'>;

/** Below the "+", left-aligned with it, never outside the window. */
export const plusMenuPosition = (
	anchor: PlusMenuAnchor,
	viewportWidth: number
) => ({
	top: anchor.bottom + GAP,
	left: Math.max(
		INSET,
		Math.min(anchor.left, viewportWidth - MENU_WIDTH - INSET)
	)
});

export interface HeaderPlusMenuProps {
	anchor: PlusMenuAnchor;
	/** The "+" itself: pressing it again is not an outside press. */
	opener?: React.RefObject<HTMLElement | null>;
	/** Supervision can be managed here (`getSupervisorAddState` interactive). */
	supervisionAvailable: boolean;
	/** Why supervision cannot be managed here, shown on the disabled entry. */
	supervisionUnavailableLabel?: string;
	onSupervision: () => void;
	onHandover: () => void;
	onClose: () => void;
}

export const HeaderPlusMenu = ({
	anchor,
	opener,
	supervisionAvailable,
	supervisionUnavailableLabel,
	onSupervision,
	onHandover,
	onClose
}: HeaderPlusMenuProps) => {
	const { t: translate } = useTranslation();
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		ref.current
			?.querySelector<HTMLElement>(
				'[role="menuitem"]:not([aria-disabled="true"]):not(:disabled)'
			)
			?.focus();
	}, []);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key !== 'Escape') return;
			onClose();
			opener?.current?.focus();
		};
		const onDown = (e: MouseEvent) =>
			!ref.current?.contains(e.target as Node) &&
			!opener?.current?.contains(e.target as Node) &&
			onClose();
		// Focus landing anywhere but the menu or the "+" closes it, also when
		// it got there through the "+" (menu → "+" → next control).
		const onFocus = (e: FocusEvent) =>
			!ref.current?.contains(e.target as Node) &&
			!opener?.current?.contains(e.target as Node) &&
			onClose();
		document.addEventListener('keydown', onKey, true);
		document.addEventListener('mousedown', onDown);
		document.addEventListener('focusin', onFocus);
		return () => {
			document.removeEventListener('keydown', onKey, true);
			document.removeEventListener('mousedown', onDown);
			document.removeEventListener('focusin', onFocus);
		};
	}, [onClose, opener]);

	return createPortal(
		<div
			style={{
				position: 'fixed',
				zIndex: 1400,
				...plusMenuPosition(anchor, window.innerWidth)
			}}
		>
			<ChatMenuDropdown
				ref={ref}
				role="menu"
				ariaLabel={translate(
					'sessionHeader.supervisor.plusMenu.menuLabel'
				)}
				data-cy="session-header-plus-menu"
				style={{ width: MENU_WIDTH }}
				onKeyDown={handleMenuKeyDown}
				onBlur={(e) => {
					// Tab out of the menu closes it; moving between its items,
					// back to the "+" or out of the window does not.
					const next = e.relatedTarget as Node | null;
					if (
						next &&
						!ref.current?.contains(next) &&
						!opener?.current?.contains(next)
					)
						onClose();
				}}
			>
				<ChatMenuDropdownItem
					role="menuitem"
					data-cy="session-header-plus-supervision"
					icon={<SupervisorAccountOutlinedIcon />}
					title={translate('sessionHeader.supervisor.modal.title')}
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
						onClose();
						onHandover();
					}}
				/>
			</ChatMenuDropdown>
		</div>,
		document.body
	);
};
