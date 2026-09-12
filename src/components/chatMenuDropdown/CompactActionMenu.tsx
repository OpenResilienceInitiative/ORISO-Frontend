import React, { useEffect, useId, useRef, useState } from 'react';
import { IconButton, Popover } from '@mui/material';
import { MenuVerticalIcon } from '../../resources/img/icons';
import { ChatMenuDropdown } from './ChatMenuDropdown';
import { MenuBackdrop } from './MenuBackdrop';
import { useChatMenuPosition } from './useChatMenuPosition';

/** Compact actions composed from the shared menu atoms, including modal focus management. */
export const CompactActionMenu = ({
	label,
	children
}: {
	label: string;
	children: (close: () => void) => React.ReactNode;
}) => {
	const id = useId();
	const [open, setOpen] = useState(false);
	const anchorRef = useRef<HTMLButtonElement>(null);
	const menuRef = useRef<HTMLDivElement>(null);
	const style = useChatMenuPosition({ open, anchorRef, menuRef, width: 240 });
	const close = () => setOpen(false);
	useEffect(() => {
		if (open && style.visibility === 'visible') {
			menuRef.current
				?.querySelector<HTMLElement>('button:not(:disabled), a[href]')
				?.focus();
		}
	}, [open, style.visibility]);
	return (
		<>
			<IconButton
				ref={anchorRef}
				aria-label={label}
				aria-haspopup="dialog"
				aria-expanded={open}
				aria-controls={open ? id : undefined}
				onClick={() => setOpen(true)}
				sx={{
					'width': 44,
					'height': 44,
					'& svg': { width: 20, height: 20 }
				}}
			>
				<MenuVerticalIcon />
			</IconButton>
			<MenuBackdrop open={open} onClose={close} />
			<Popover
				open={open}
				onClose={close}
				anchorReference="none"
				hideBackdrop
				transitionDuration={0}
				sx={{ zIndex: 99999 }}
				onClick={(event) => {
					if (event.target === event.currentTarget) close();
				}}
				PaperProps={{
					ref: menuRef,
					style,
					sx: { background: 'transparent', boxShadow: 'none' }
				}}
			>
				<ChatMenuDropdown
					id={id}
					density="compact"
					ariaLabel={label}
					style={{ width: '100%', maxHeight: 'none' }}
				>
					{children(close)}
				</ChatMenuDropdown>
			</Popover>
		</>
	);
};
