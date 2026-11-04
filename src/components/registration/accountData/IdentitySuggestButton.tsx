import * as React from 'react';
import { ReactNode } from 'react';
import { Box, Button } from '@mui/material';
import { registrationMd3 } from '../registrationDesign/registrationDesign';

const suggestButtonSx = (filled: boolean) =>
	({
		'px': 1,
		'py': 0.75,
		'fontSize': 13.5,
		'lineHeight': '20px',
		'minWidth': 0,
		'flex': '1 1 auto',
		'borderRadius': '8px',
		'textTransform': 'none',
		'color': filled ? registrationMd3.onPrimary : registrationMd3.onSurface,
		'borderColor': registrationMd3.outlineVariant,
		'backgroundColor': filled ? registrationMd3.primary : undefined,
		'& .MuiButton-startIcon': {
			mr: 0.625
		},
		'& .registration-suggest-icon': {
			filter: filled ? 'brightness(0) invert(1)' : 'none',
			transition: 'filter 140ms ease'
		},
		'&:hover': filled
			? {
					backgroundColor: registrationMd3.primaryDark
				}
			: {
					'color': registrationMd3.onSecondary,
					'borderColor': registrationMd3.secondary,
					'backgroundColor': registrationMd3.secondary,
					'& .registration-suggest-icon': {
						filter: 'brightness(0) invert(1)'
					}
				},
		'&&:active, &&:active:hover': {
			'color': registrationMd3.onPrimary,
			'WebkitTextFillColor': registrationMd3.onPrimary,
			'borderColor': registrationMd3.primary,
			'backgroundColor': registrationMd3.primary,
			'& .MuiButton-startIcon, & .MuiButton-endIcon': {
				color: registrationMd3.onPrimary
			},
			'& .registration-suggest-icon': {
				filter: 'brightness(0) invert(1)'
			}
		},
		'&:focus-visible': {
			outline: `2px solid ${registrationMd3.focus}`,
			outlineOffset: 2
		}
	}) as const;

export interface IdentitySuggestButtonProps {
	/** One of the `registration-md3/icons/gen-*.svg` icons. */
	icon: string;
	label: ReactNode;
	onClick: () => void;
	filled?: boolean;
}

/**
 * The small "suggest" button of the identity block (User-ID, password,
 * avatar, all three). Shared by the registration and the call entry, so the
 * person meets the same three buttons and icons wherever they choose who
 * they are (Frank, 2026-10-15).
 */
export const IdentitySuggestButton = ({
	icon,
	label,
	onClick,
	filled = false
}: IdentitySuggestButtonProps) => (
	<Button
		variant={filled ? 'contained' : 'outlined'}
		onClick={onClick}
		startIcon={
			<Box
				component="img"
				className="registration-suggest-icon"
				src={icon}
				alt=""
				sx={{ width: 17, height: 17, flexShrink: 0 }}
			/>
		}
		sx={suggestButtonSx(filled)}
	>
		<Box
			component="span"
			sx={{
				overflow: 'hidden',
				textOverflow: 'ellipsis',
				whiteSpace: 'nowrap'
			}}
		>
			{label}
		</Box>
	</Button>
);
