import * as React from 'react';
import { useId } from 'react';
import { Box, Button, Typography } from '@mui/material';
import { registrationMd3 } from './registrationDesign/registrationDesign';

/**
 * The second way on for a link entry: join without a password, or go back to
 * creating a full account. It is a toggle, not a submit — it never leaves the
 * screen, it only changes what the screen is asking for.
 *
 * Painted by the theme's `outlined` MuiButton and nothing else, so it reads as
 * the quieter sibling of the primary without a second colour system beside it.
 */
export const TemporaryJoinToggle = ({
	label,
	onClick,
	disabled,
	hint,
	fullWidth = false
}: {
	label: string;
	onClick: () => void;
	disabled?: boolean;
	/** Why the toggle is unavailable, shown right under it. */
	hint?: string;
	fullWidth?: boolean;
}) => {
	const hintId = useId();
	const button = (
		<Button
			data-cy="button-temporary-join"
			type="button"
			variant="outlined"
			disabled={disabled}
			onClick={onClick}
			fullWidth={fullWidth}
			aria-describedby={hint ? hintId : undefined}
			sx={{
				borderRadius: '999px',
				px: { xs: 2.5, sm: 3 },
				py: 1.35,
				fontSize: 16,
				fontWeight: 600,
				whiteSpace: 'nowrap',
				overflow: 'hidden',
				textOverflow: 'ellipsis'
			}}
		>
			{label}
		</Button>
	);
	if (!hint) return button;
	return (
		<Box sx={{ minWidth: 0, width: fullWidth ? '100%' : undefined }}>
			{button}
			<Typography
				id={hintId}
				data-cy="temporary-join-hint"
				variant="body2"
				sx={{
					mt: 0.75,
					px: 1,
					color: registrationMd3.onSurfaceVariant
				}}
			>
				{hint}
			</Typography>
		</Box>
	);
};
