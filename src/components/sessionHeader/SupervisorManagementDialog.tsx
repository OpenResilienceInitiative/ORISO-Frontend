import * as React from 'react';
import { useState } from 'react';
import { Box } from '@mui/material';
import FocusTrap from 'focus-trap-react';

export const SUPERVISOR_DIALOG_ID = 'supervisor-management-dialog';
export const SUPERVISOR_DIALOG_TITLE_ID = `${SUPERVISOR_DIALOG_ID}-title`;

/** The picker and permanent practice controls share one keyboard boundary. */
export const SupervisorManagementDialog = ({
	onClose,
	children
}: {
	onClose: () => void;
	children: React.ReactNode;
}) => {
	const [dialog, setDialog] = useState<HTMLElement | null>(null);
	const practiceControls = document.querySelector<HTMLElement>(
		'[data-practice-controls]'
	);
	const containers = [dialog, practiceControls].filter(
		(element): element is HTMLElement => element !== null
	);

	return (
		<FocusTrap
			containerElements={containers}
			focusTrapOptions={{
				allowOutsideClick: true,
				escapeDeactivates: false,
				fallbackFocus: `#${SUPERVISOR_DIALOG_ID}`
			}}
		>
			<Box
				sx={{
					position: 'fixed',
					inset: 0,
					backgroundColor: 'rgba(0, 0, 0, 0.5)',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					zIndex: (theme) => theme.zIndex.modal
				}}
				onClick={(event) => {
					if (event.target === event.currentTarget) onClose();
				}}
				onKeyDown={(event) => {
					if (event.key === 'Escape') {
						event.stopPropagation();
						onClose();
					}
				}}
			>
				<Box
					ref={setDialog}
					id={SUPERVISOR_DIALOG_ID}
					role="dialog"
					aria-modal={!practiceControls}
					aria-labelledby={SUPERVISOR_DIALOG_TITLE_ID}
					tabIndex={-1}
					sx={{
						backgroundColor: 'var(--m3-surface-container, white)',
						color: 'var(--m3-on-surface)',
						borderRadius: 2,
						p: 3,
						maxWidth: 500,
						width: '90%',
						maxHeight: '80vh',
						overflowY: 'auto',
						position: 'relative',
						boxShadow: 6
					}}
				>
					{children}
				</Box>
			</Box>
		</FocusTrap>
	);
};
