import * as React from 'react';
import { Box } from '@mui/material';
import { Loading } from '../../app/Loading';

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
		<Loading label={text} delayMs={0} />
	</Box>
);
