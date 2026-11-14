/**
 * Every menu of the calendar opens through this host: at the pointer
 * (after dragging over free time, a click on an entry or a month day) or
 * at its trigger (settings, view, jump to a day, the people picker). The
 * card itself is the shared `ChatMenuDropdown`, so a change to the product
 * menu changes the calendar's menus too (Frank, 2026-11-14).
 *
 * Arrow keys move through the items, Escape closes and focus goes back to
 * where it came from.
 */
import * as React from 'react';
import { useEffect, useRef } from 'react';
import { Popover } from '@mui/material';
import {
	ChatMenuDropdown,
	handleMenuKeyDown
} from '../chatMenuDropdown/ChatMenuDropdown';
import '../chatMenuDropdown/chatMenuDropdown.styles.scss';

export type CalendarMenuAnchor = { x: number; y: number } | HTMLElement;

export interface CalendarMenuProps {
	'open': boolean;
	'anchor': CalendarMenuAnchor | null;
	/** Accessible name of the card, already translated. */
	'label': string;
	/** `menu` for item lists, `dialog` when the card holds a form. */
	'role'?: 'menu' | 'dialog';
	'width'?: number;
	/** Element anchors: which edge of the trigger the card lines up with. */
	'align'?: 'start' | 'end';
	'onClose': () => void;
	/** Changes when the card swaps its content (e.g. to the move form). */
	'focusKey'?: string;
	'children': React.ReactNode;
	'data-cy'?: string;
}

const isPoint = (
	anchor: CalendarMenuAnchor
): anchor is { x: number; y: number } => !(anchor instanceof HTMLElement);

const FOCUSABLE =
	'[role^="menuitem"]:not(:disabled), input:not(:disabled), button:not(:disabled)';

export const CalendarMenu = ({
	open,
	anchor,
	label,
	role = 'menu',
	width = 280,
	align = 'start',
	onClose,
	focusKey,
	children,
	'data-cy': dataCy
}: CalendarMenuProps) => {
	const cardRef = useRef<HTMLDivElement>(null);
	const visible = open && !!anchor;

	useEffect(() => {
		if (!visible) return undefined;
		const frame = requestAnimationFrame(() =>
			cardRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus()
		);
		return () => cancelAnimationFrame(frame);
	}, [visible, focusKey]);

	if (!anchor) return null;
	const horizontal: 'left' | 'right' = align === 'end' ? 'right' : 'left';
	const placement = isPoint(anchor)
		? {
				anchorReference: 'anchorPosition' as const,
				anchorPosition: { top: anchor.y, left: anchor.x }
			}
		: {
				anchorEl: anchor,
				anchorOrigin: { vertical: 'bottom' as const, horizontal },
				transformOrigin: { vertical: 'top' as const, horizontal }
			};

	return (
		<Popover
			open={visible}
			onClose={onClose}
			{...placement}
			marginThreshold={12}
			transitionDuration={0}
			slotProps={{
				paper: {
					sx: {
						background: 'transparent',
						boxShadow: 'none',
						overflow: 'visible',
						mt: isPoint(anchor) ? 0 : '6px'
					}
				}
			}}
		>
			<ChatMenuDropdown
				ref={cardRef}
				density="compact"
				role={role}
				ariaLabel={label}
				onKeyDown={role === 'menu' ? handleMenuKeyDown : undefined}
				style={{ width }}
				data-cy={dataCy}
			>
				{children}
			</ChatMenuDropdown>
		</Popover>
	);
};
