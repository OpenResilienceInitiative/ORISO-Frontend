import * as React from 'react';
import { Box, Button, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '../emptyState/EmptyState';

/** Where the counsellor's knock stands (#1499, item 14). */
export type JoinRequestViewState =
	| 'idle'
	| 'sending'
	| 'pending'
	| 'cancelling'
	| 'admitted'
	| 'declined'
	| 'error';

export interface GroupChatJoinRequestView {
	state: JoinRequestViewState;
	onRequest: () => void;
	onCancel: () => void;
	onOpenGroup: () => void;
}

interface GroupChatNotMemberProps {
	onBack: () => void;
	/**
	 * The knock. Omitted, the notice is what #1534 shipped: the statement and
	 * the way back.
	 */
	joinRequest?: GroupChatJoinRequestView;
}

const bodySx = {
	maxWidth: 400,
	mt: 2,
	color: 'var(--m3-on-surface-variant)'
} as const;

const textButtonSx = {
	textTransform: 'none',
	borderRadius: '20px',
	color: 'var(--m3-primary)'
} as const;

const headlineKey: Record<JoinRequestViewState | 'none', string> = {
	none: 'groupChat.notMember.headline',
	idle: 'groupChat.notMember.headline',
	sending: 'groupChat.notMember.headline',
	error: 'groupChat.notMember.headline',
	pending: 'groupChat.notMember.pendingHeadline',
	cancelling: 'groupChat.notMember.pendingHeadline',
	admitted: 'groupChat.notMember.admittedHeadline',
	declined: 'groupChat.notMember.declinedHeadline'
};

const bodyKey: Record<JoinRequestViewState | 'none', string> = {
	none: 'groupChat.notMember.body',
	idle: 'groupChat.notMember.knockBody',
	sending: 'groupChat.notMember.knockBody',
	error: 'groupChat.notMember.knockBody',
	pending: 'groupChat.notMember.pendingBody',
	cancelling: 'groupChat.notMember.pendingBody',
	admitted: 'groupChat.notMember.admittedBody',
	declined: 'groupChat.notMember.declinedBody'
};

/**
 * A counsellor opened a group she is not part of — usually through its
 * invite link (#1499). Says so plainly, offers the way back and, with
 * `joinRequest`, the knock: "Beitritt anfragen", then the state of that
 * request until the moderation lets her in or not. Nothing of the group
 * itself shows here — not its name, not its people (Frank, 23.09.2026).
 */
export const GroupChatNotMember = ({
	onBack,
	joinRequest
}: GroupChatNotMemberProps) => {
	const { t: translate } = useTranslation();
	const state = joinRequest?.state ?? 'none';
	const canRequest =
		state === 'idle' || state === 'sending' || state === 'error';
	const waiting = state === 'pending' || state === 'cancelling';

	const back = (
		<Button
			disableElevation
			onClick={onBack}
			variant={canRequest || state === 'admitted' ? 'text' : 'contained'}
			sx={canRequest || state === 'admitted' ? textButtonSx : undefined}
		>
			{translate('groupChat.notMember.back')}
		</Button>
	);

	return (
		<div className="session session--empty" data-cy="group-chat-not-member">
			<EmptyState
				className="session__emptyState"
				headline={translate(headlineKey[state])}
				variant="no-conversations"
			>
				<Typography sx={bodySx}>{translate(bodyKey[state])}</Typography>
				{state === 'error' && (
					<Typography
						role="alert"
						sx={{ ...bodySx, color: 'var(--m3-error)' }}
					>
						{translate('groupChat.notMember.requestFailed')}
					</Typography>
				)}
				<Box
					sx={{
						mt: 4,
						display: 'flex',
						flexWrap: 'wrap',
						justifyContent: 'center',
						gap: 1
					}}
				>
					{joinRequest && canRequest && (
						<Button
							disableElevation
							variant="contained"
							onClick={joinRequest.onRequest}
							disabled={state === 'sending'}
							data-cy="group-chat-join-request"
						>
							{translate('groupChat.notMember.request')}
						</Button>
					)}
					{joinRequest && waiting && (
						<Button
							onClick={joinRequest.onCancel}
							disabled={state === 'cancelling'}
							sx={textButtonSx}
							data-cy="group-chat-join-request-cancel"
						>
							{translate('groupChat.notMember.cancel')}
						</Button>
					)}
					{joinRequest && state === 'admitted' && (
						<Button
							disableElevation
							variant="contained"
							onClick={joinRequest.onOpenGroup}
							data-cy="group-chat-join-request-open"
						>
							{translate('groupChat.notMember.openGroup')}
						</Button>
					)}
					{back}
				</Box>
			</EmptyState>
		</div>
	);
};
