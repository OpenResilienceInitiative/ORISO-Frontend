import * as React from 'react';
import { ReactElement } from 'react';
import { Box, Button, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { StageLayout } from '../../stageLayout/StageLayout';
import { INVITE_LOGIN_STATE } from './groupInviteEntryState';

/**
 * The invite entry could not load the group's topic or consulting type
 * (#1499). Falling back to the four steps would lose the group, so the page
 * offers a retry instead of staying blank.
 */
export const GroupInviteLoadError = ({
	stage,
	gcid,
	aid,
	onRetry
}: {
	stage: ReactElement;
	gcid: string;
	aid: string;
	onRetry: () => void;
}) => {
	const { t } = useTranslation();

	return (
		<StageLayout
			className="stageLayout--registration"
			showLegalLinks={true}
			showLoginLink={true}
			showRegistrationLink={false}
			loginParams={new URLSearchParams({ gcid, aid }).toString()}
			loginState={INVITE_LOGIN_STATE}
			stage={stage}
			mobileHero="bar"
		>
			<Box
				role="alert"
				data-cy="group-invite-load-error"
				sx={{
					display: 'flex',
					flexDirection: 'column',
					alignItems: 'flex-start',
					gap: 2,
					px: { xs: 2.5, sm: 5 },
					pt: { xs: 3, sm: 4 }
				}}
			>
				<Typography variant="h5" component="h1">
					{t('registration.groupInvite.loadError.headline')}
				</Typography>
				<Typography variant="body1">
					{t('registration.groupInvite.loadError.body')}
				</Typography>
				<Button variant="contained" onClick={onRetry}>
					{t('groupChat.loadError.retry')}
				</Button>
			</Box>
		</StageLayout>
	);
};
