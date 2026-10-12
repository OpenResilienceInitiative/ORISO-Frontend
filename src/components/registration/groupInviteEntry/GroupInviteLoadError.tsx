import * as React from 'react';
import { ReactElement } from 'react';
import { Box, Button, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { StageLayout } from '../../stageLayout/StageLayout';
import { Loading } from '../../app/Loading';
import { INVITE_LOGIN_STATE } from './groupInviteEntryState';
import './groupInviteLoading.styles.scss';

interface InviteStageProps {
	stage: ReactElement;
	gcid: string;
	aid: string;
}

/* Same frame as the entry, so loading and error keep the invite's login link. */
const InviteStage = ({
	stage,
	gcid,
	aid,
	children,
	isLoading = false
}: InviteStageProps & { children: ReactElement; isLoading?: boolean }) => (
	<StageLayout
		className={`stageLayout--registration${isLoading ? ' stageLayout--inviteLoading' : ''}`}
		showLegalLinks={true}
		showLoginLink={true}
		showRegistrationLink={false}
		loginParams={new URLSearchParams({ gcid, aid }).toString()}
		loginState={INVITE_LOGIN_STATE}
		stage={stage}
		mobileHero="bar"
	>
		{children}
	</StageLayout>
);

/** The invite entry is still loading the group's topic or consulting type. */
export const GroupInviteLoading = (props: InviteStageProps) => {
	const { t } = useTranslation();

	return (
		<InviteStage {...props} isLoading>
			<Box
				aria-busy="true"
				data-cy="group-invite-loading"
				sx={{ display: 'flex', flex: 1, width: '100%', minHeight: 0 }}
			>
				<Loading
					layout="section"
					delayMs={0}
					label={t('registration.groupInvite.loading')}
				/>
			</Box>
		</InviteStage>
	);
};

/**
 * The invite entry could not load the group's topic or consulting type
 * (#1499). Falling back to the four steps would lose the group, so the page
 * offers a retry instead of staying blank.
 */
export const GroupInviteLoadError = ({
	onRetry,
	...props
}: InviteStageProps & { onRetry: () => void }) => {
	const { t } = useTranslation();

	return (
		<InviteStage {...props}>
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
		</InviteStage>
	);
};
