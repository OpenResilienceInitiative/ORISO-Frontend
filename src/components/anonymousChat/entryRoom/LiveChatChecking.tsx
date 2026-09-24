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
 * the orbital loader above one sentence. The sentence is what changes ("wir
 * schauen" → "wir warten"), so it is the live region; the animation says
 * nothing and is hidden from assistive technology.
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
		{/* One orbit, about a third larger than the grid of four used to be
		    (Frank, 2026-09-21: 160/200 → 208/260). */}
		<Box aria-hidden="true" sx={{ width: { xs: 208, lg: 260 } }}>
			<OrbitalTrails
				label={text}
				palette="brand"
				variant="single"
				warmupFrames={40}
			/>
		</Box>
		<Typography
			role="status"
			aria-live="polite"
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
