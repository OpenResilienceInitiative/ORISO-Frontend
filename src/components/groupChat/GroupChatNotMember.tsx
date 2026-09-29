import * as React from 'react';
import { Button, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '../emptyState/EmptyState';

interface GroupChatNotMemberProps {
	onBack: () => void;
	/** Set when the check itself failed: she may be a member, so offer a retry. */
	onRetry?: () => void;
}

/**
 * A counsellor opened a group she is not part of — usually through its
 * invite link (#1499). Says so plainly and offers the way back, instead of
 * the moderator room of someone else's group. With `onRetry` the server gave
 * no usable answer, and the same screen offers to ask again.
 */
export const GroupChatNotMember = ({
	onBack,
	onRetry
}: GroupChatNotMemberProps) => {
	const { t: translate } = useTranslation();

	return (
		<div
			className="session session--empty"
			data-cy={
				onRetry ? 'group-chat-unavailable' : 'group-chat-not-member'
			}
		>
			<EmptyState
				className="session__emptyState"
				headline={
					onRetry
						? translate('groupChat.accessUnavailable.headline')
						: translate('groupChat.notMember.headline')
				}
				variant="no-conversations"
			>
				<Typography
					sx={{
						maxWidth: 400,
						mt: 2,
						color: 'var(--m3-on-surface-variant, #444748)'
					}}
				>
					{onRetry
						? translate('groupChat.accessUnavailable.body')
						: translate('groupChat.notMember.body')}
				</Typography>
				{onRetry && (
					<Button
						disableElevation
						onClick={onRetry}
						sx={{ mt: 4 }}
						variant="contained"
					>
						{translate('groupChat.loadError.retry')}
					</Button>
				)}
				<Button
					disableElevation
					onClick={onBack}
					sx={{ mt: onRetry ? 1 : 4 }}
					variant={onRetry ? 'text' : 'contained'}
				>
					{translate('groupChat.notMember.back')}
				</Button>
			</EmptyState>
		</div>
	);
};
