import * as React from 'react';
import { Typography } from '@mui/material';

/** Why "Beitreten" did not work, just above the waiting room's bar. */
export const JoinRefusalNotice = ({ message }: { message: string }) => (
	<Typography
		role="alert"
		data-cy="group-entry-join-refusal"
		sx={{
			position: 'fixed',
			left: 0,
			right: 0,
			bottom: 104,
			px: 2,
			textAlign: 'center',
			color: 'error.main',
			zIndex: 66
		}}
	>
		{message}
	</Typography>
);
