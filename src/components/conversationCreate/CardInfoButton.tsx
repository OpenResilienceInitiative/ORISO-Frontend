import * as React from 'react';
import { useId, useState } from 'react';
import { Box, IconButton, Popover } from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { orisoInputColors } from '../form/orisoInputDesign';

/**
 * Round "i" in a format card's header (`FormatCard` `headerAction`). The card
 * shows one short line; the longer explanation opens on demand in a small
 * surface next to the button, so the card keeps its size (Frank, 2026-11-21).
 *
 * A click or Enter/Space opens it, Escape or a click outside closes it and
 * focus returns to the button (MUI `Popover`).
 */

export interface CardInfoButtonProps {
	/** Accessible name of the button, e.g. "Mehr zu „Interna besprechen“". */
	'label': string;
	/** The explanation; paragraphs are fine. */
	'children': React.ReactNode;
	'data-cy'?: string;
}

export const CardInfoButton = ({
	label,
	children,
	'data-cy': dataCy = 'card-info'
}: CardInfoButtonProps) => {
	const [anchor, setAnchor] = useState<HTMLElement | null>(null);
	const panelId = useId();
	const open = Boolean(anchor);

	return (
		<>
			<IconButton
				aria-label={label}
				aria-expanded={open}
				aria-controls={open ? panelId : undefined}
				aria-haspopup="dialog"
				data-cy={dataCy}
				onClick={(event) =>
					setAnchor(open ? null : event.currentTarget)
				}
				sx={{
					'width': 40,
					'height': 40,
					'color': orisoInputColors.onSurfaceVariant,
					'&:hover': { bgcolor: orisoInputColors.hoverLayer },
					'&.Mui-focusVisible': {
						outline: `2px solid ${orisoInputColors.focus}`,
						outlineOffset: 2
					}
				}}
			>
				<InfoOutlinedIcon fontSize="small" />
			</IconButton>
			<Popover
				id={panelId}
				open={open}
				anchorEl={anchor}
				onClose={() => setAnchor(null)}
				anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
				transformOrigin={{ vertical: 'top', horizontal: 'right' }}
				slotProps={{
					paper: {
						'role': 'dialog',
						'aria-label': label,
						'data-cy': `${dataCy}-panel`,
						'sx': {
							maxWidth: 320,
							mt: 0.5,
							p: 2,
							borderRadius: '16px',
							bgcolor: orisoInputColors.surfaceContainerHigh,
							color: orisoInputColors.onSurface,
							fontSize: 14,
							lineHeight: '20px',
							letterSpacing: '0.25px'
						}
					} as object
				}}
			>
				<Box
					sx={{
						'display': 'flex',
						'flexDirection': 'column',
						'gap': 1,
						'& p': { m: 0 }
					}}
				>
					{children}
				</Box>
			</Popover>
		</>
	);
};
