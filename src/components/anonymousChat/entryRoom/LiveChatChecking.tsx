import * as React from 'react';
import { Box, Typography } from '@mui/material';
import { OrbitalTrails } from '../../orbitalTrails/OrbitalTrails';
import { registrationMd3 } from '../../registration/registrationDesign/registrationDesign';

export interface LiveChatCheckingProps {
	/** What the room is doing right now (already translated). */
	text: string;
}

/**
 * The room while it finds out who is live — before a name is offered, and
 * again after "Ich warte" on the closed view. Centred in the white column,
 * the orbital loader above one sentence. The loader carries the live region;
 * the visible sentence is the same words, so a screen reader hears them once.
 */
export const LiveChatChecking = ({ text }: LiveChatCheckingProps) => (
	<Box
		data-cy="live-chat-checking"
		sx={{
			flex: 1,
			display: 'flex',
			flexDirection: 'column',
			alignItems: 'center',
			justifyContent: 'center',
			gap: 3,
			textAlign: 'center',
			px: 2
		}}
	>
		<Box sx={{ width: { xs: 160, lg: 200 } }}>
			<OrbitalTrails label={text} palette="brand" warmupFrames={40} />
		</Box>
		<Typography
			aria-hidden="true"
			sx={{
				fontSize: 16,
				fontWeight: 500,
				color: registrationMd3.onSurfaceVariant,
				maxWidth: 360
			}}
		>
			{text}
		</Typography>
	</Box>
);
