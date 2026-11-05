import * as React from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';

/** No fresh sign-in exists for a guest whose session has already expired. */
export const LiveChatConversionExpired = () => {
	const { t } = useTranslation();
	return (
		<Box component="main" sx={{ maxWidth: 560, mx: 'auto', p: 3 }}>
			<Stack spacing={2}>
				<Typography component="h1" variant="h4">
					{t(
						'liveChatConversion.expiredTitle',
						'This Live Chat session has expired'
					)}
				</Typography>
				<Typography>
					{t(
						'liveChatConversion.expiredHelp',
						'This conversation can no longer be converted in this browser. A new registration starts a separate conversation.'
					)}
				</Typography>
				<Button href="/registration" variant="contained">
					{t(
						'liveChatConversion.newRegistration',
						'Start a new registration'
					)}
				</Button>
			</Stack>
		</Box>
	);
};
