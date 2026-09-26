import * as React from 'react';
import { Button, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '../emptyState/EmptyState';

interface GroupChatNotMemberProps {
	onBack: () => void;
}

/**
 * A counsellor opened a group she is not part of — usually through its
 * invite link (#1499). Says so plainly and offers the way back, instead of
 * the moderator room of someone else's group.
 */
export const GroupChatNotMember = ({ onBack }: GroupChatNotMemberProps) => {
	const { t: translate } = useTranslation();

	return (
		<div className="session session--empty" data-cy="group-chat-not-member">
			<EmptyState
				className="session__emptyState"
				headline={translate('groupChat.notMember.headline')}
				variant="no-conversations"
			>
				<Typography
					sx={{
						maxWidth: 400,
						mt: 2,
						color: 'var(--m3-on-surface-variant, #444748)'
					}}
				>
					{translate('groupChat.notMember.body')}
				</Typography>
				<Button
					disableElevation
					onClick={onBack}
					sx={{ mt: 4 }}
					variant="contained"
				>
					{translate('groupChat.notMember.back')}
				</Button>
			</EmptyState>
		</div>
	);
};
