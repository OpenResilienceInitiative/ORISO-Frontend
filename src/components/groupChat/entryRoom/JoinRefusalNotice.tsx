import * as React from 'react';
import { Typography } from '@mui/material';

/** Why "Beitreten" did not work, as a row of the waiting room's bar. */
export const JoinRefusalNotice = ({ message }: { message: string }) => (
	<Typography
		role="alert"
		data-cy="group-entry-join-refusal"
		sx={{ width: '100%', textAlign: 'center', color: 'error.main' }}
	>
		{message}
	</Typography>
);
