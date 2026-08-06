import * as React from 'react';
import { ReactElement } from 'react';
import { Box, Chip, Typography } from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { registrationMd3 } from '../registrationDesign/registrationDesign';

export interface RegistrationSelectionChip {
	key: string;
	label: string;
	/** Topic artwork; rendered as a filled round avatar. */
	icon?: string;
	/** Icon component for chips without artwork (the postcode pin). */
	iconNode?: ReactElement;
	/** Fixed-width chips never give up space — the postcode is always 5 digits. */
	fixed?: boolean;
	onDelete: () => void;
	deleteAriaLabel: string;
}

export interface RegistrationSelectionChipsProps {
	chips: RegistrationSelectionChip[];
	/** "Ausgewählt" — shown in the footer placement only. */
	selectedPrefix: string;
	/** Shown in the footer placement when nothing is picked yet. */
	emptyLabel: string;
	/**
	 * `header` is the compact mobile row that sits under the progress row:
	 * 30 pt chips, left aligned, no prefix, no empty state (an empty row would
	 * just cost 38 pt of the 784 pt screen).
	 * `footer` is the existing desktop bar under the form.
	 */
	placement: 'header' | 'footer';
}

/**
 * The user's picks so far, as removable chips. Extracted from `Registration.tsx`
 * so the mobile header and the desktop footer render the same chips instead of
 * two hand-maintained copies.
 */
export const RegistrationSelectionChips = ({
	chips,
	selectedPrefix,
	emptyLabel,
	placement
}: RegistrationSelectionChipsProps) => {
	const header = placement === 'header';

	if (chips.length === 0) {
		if (header) {
			return null;
		}

		return (
			<Typography
				data-cy="registration-footer-empty-selection"
				sx={{
					fontSize: 13,
					color: registrationMd3.outline,
					textAlign: 'center',
					lineHeight: 1.4
				}}
			>
				{emptyLabel}
			</Typography>
		);
	}

	const renderChip = (chip: RegistrationSelectionChip) => (
		<Chip
			key={chip.key}
			avatar={
				chip.icon ? (
					<Box
						component="span"
						sx={{
							position: 'relative',
							overflow: 'hidden',
							borderRadius: '50%',
							bgcolor: registrationMd3.surfaceContainer
						}}
					>
						<Box
							component="img"
							src={chip.icon}
							alt=""
							loading="lazy"
							decoding="async"
							sx={{
								width: '100%',
								height: '100%',
								objectFit: 'contain'
							}}
						/>
					</Box>
				) : undefined
			}
			icon={chip.iconNode}
			label={chip.label}
			onDelete={chip.onDelete}
			deleteIcon={<CloseRoundedIcon aria-label={chip.deleteAriaLabel} />}
			variant="outlined"
			data-cy={`registration-chip-${chip.key}`}
			sx={{
				'maxWidth': '100%',
				'minWidth': chip.fixed ? 0 : header ? 0 : 96,
				'flexShrink': chip.fixed ? 0 : 1,
				'height': header ? '30px' : '38px',
				'borderRadius': '999px',
				'bgcolor': '#fff',
				'fontWeight': header ? 400 : 600,
				'fontSize': header ? 13 : 14,
				'borderColor': registrationMd3.outlineVariant,
				'& .MuiChip-label': {
					overflow: 'hidden',
					textOverflow: 'ellipsis',
					whiteSpace: 'nowrap',
					// The postcode is always 5 digits: fixed-width figures stop
					// the chip resizing as the user types.
					fontVariantNumeric: chip.fixed ? 'tabular-nums' : 'normal',
					px: header ? 0.75 : 1.5
				},
				'& .MuiChip-avatar': {
					width: header ? 24 : 26,
					height: header ? 24 : 26,
					ml: header ? '3px' : undefined
				},
				'& .MuiChip-icon': {
					color: registrationMd3.onSurfaceVariant,
					ml: header ? 0.75 : 1,
					fontSize: header ? 16 : 20
				},
				'& .MuiChip-deleteIcon': {
					color: registrationMd3.onSurfaceVariant,
					fontSize: header ? 16 : 20,
					mr: header ? 0.75 : undefined
				}
			}}
		/>
	);

	if (header) {
		return (
			<Box
				data-cy="registration-header-chips"
				sx={{
					height: 38,
					display: 'flex',
					alignItems: 'center',
					gap: 0.75,
					minWidth: 0,
					overflow: 'hidden'
				}}
			>
				{chips.map(renderChip)}
			</Box>
		);
	}

	return (
		<Box
			sx={{
				minWidth: 0,
				overflow: 'hidden',
				display: 'flex',
				justifyContent: 'center',
				alignItems: 'center',
				gap: 1,
				containerType: 'inline-size'
			}}
		>
			<Typography
				sx={{
					'fontSize': 13,
					'color': registrationMd3.onSurfaceVariant,
					'flexShrink': 0,
					'whiteSpace': 'nowrap',
					'@container (max-width: 360px)': { display: 'none' }
				}}
			>
				{selectedPrefix}:
			</Typography>
			<Box
				sx={{
					minWidth: 0,
					maxWidth: '100%',
					display: 'flex',
					flexWrap: 'nowrap',
					gap: 1,
					justifyContent: 'center'
				}}
			>
				{chips.map(renderChip)}
			</Box>
		</Box>
	);
};
