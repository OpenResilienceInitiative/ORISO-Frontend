import * as React from 'react';
import { useEffect, useId, useState } from 'react';
import {
	Box,
	FormControlLabel,
	Radio,
	RadioGroup,
	Typography
} from '@mui/material';
import DoorFrontOutlinedIcon from '@mui/icons-material/DoorFrontOutlined';
import { useTranslation } from 'react-i18next';
import { M3Dialog } from '../../m3Dialog/M3Dialog';
import { UserAvatar } from '../../message/UserAvatar';
import {
	coModerationBlockedReason,
	GroupChatJoinAdmitRole,
	GroupChatJoinRequest,
	minutesSince
} from './joinRequestModel';

export interface JoinRequestDialogProps {
	open: boolean;
	/** Carries the moderator's own role — only an owner grants co-moderation. */
	request: GroupChatJoinRequest;
	now?: Date;
	busy?: boolean;
	onAdmit: (role: GroupChatJoinAdmitRole) => void;
	onDecline: () => void;
	/** ✕, Escape and the backdrop: closes without deciding anything. */
	onClose: () => void;
}

const labelSx = {
	fontSize: 12,
	lineHeight: '16px',
	letterSpacing: '0.4px',
	color: 'var(--m3-on-surface-variant)'
} as const;

const valueSx = {
	fontSize: 14,
	lineHeight: '20px',
	letterSpacing: '0.25px',
	color: 'var(--m3-on-surface)',
	overflowWrap: 'anywhere'
} as const;

const chipSx = {
	display: 'inline-block',
	ml: 1,
	px: 1,
	borderRadius: '8px',
	fontSize: 12,
	lineHeight: '20px',
	fontWeight: 500,
	backgroundColor: 'var(--m3-secondary-container)',
	color: 'var(--m3-on-secondary-container)'
} as const;

/**
 * The popup behind "Details" on a join request (#1499): everything the
 * snackbar only hints at, and the decision — with the role to admit as.
 *
 * Co-moderation is always shown, never hidden (disable, don't hide): greyed
 * out with the reason when the viewer is not the owner, or when the person
 * asking belongs to another Träger.
 */
export const JoinRequestDialog = ({
	open,
	request,
	now = new Date(),
	busy = false,
	onAdmit,
	onDecline,
	onClose
}: JoinRequestDialogProps) => {
	const { t, i18n } = useTranslation();
	const roleLabelId = useId();
	const [role, setRole] = useState<GroupChatJoinAdmitRole>('PARTICIPANT');
	useEffect(() => {
		if (open) setRole('PARTICIPANT');
	}, [open, request.id]);

	const { requester } = request;
	const blocked = coModerationBlockedReason(request);
	const minutes = minutesSince(request.requestedAt, now);
	const time = new Date(request.requestedAt).toLocaleTimeString(
		i18n?.language || 'de',
		{ hour: '2-digit', minute: '2-digit' }
	);

	const rows: Array<{ label: string; value: React.ReactNode }> = [
		{
			label: t('groupChat.joinRequest.dialog.roleLabel'),
			value: t('groupChat.joinRequest.role')
		},
		{
			label: t('groupChat.joinRequest.dialog.agencyLabel'),
			value: (
				<>
					{requester.agencyName ?? t('groupChat.joinRequest.unknown')}
					{!requester.sameAgency && (
						<Box component="span" sx={chipSx}>
							{t('groupChat.joinRequest.otherAgency')}
						</Box>
					)}
				</>
			)
		},
		{
			label: t('groupChat.joinRequest.dialog.tenantLabel'),
			value: (
				<>
					{requester.tenantName ?? t('groupChat.joinRequest.unknown')}
					{!requester.sameTenant && (
						<Box component="span" sx={chipSx}>
							{t('groupChat.joinRequest.otherTenant')}
						</Box>
					)}
				</>
			)
		},
		{
			label: t('groupChat.joinRequest.dialog.wayLabel'),
			value: t('groupChat.joinRequest.viaInviteLink')
		},
		{
			label: t('groupChat.joinRequest.dialog.timeLabel'),
			value: (
				<time dateTime={request.requestedAt}>
					{t('groupChat.joinRequest.dialog.timeValue', { time })}
					{' · '}
					{minutes < 1
						? t('groupChat.joinRequest.justNow')
						: t('groupChat.joinRequest.minutesAgo', {
								count: minutes
							})}
				</time>
			)
		}
	];

	return (
		<M3Dialog
			open={open}
			onClose={onClose}
			closeLabel={t('app.close')}
			icon={<DoorFrontOutlinedIcon />}
			title={t('groupChat.joinRequest.dialog.title', {
				name: requester.displayName
			})}
			description={t('groupChat.joinRequest.dialog.description', {
				name: requester.displayName,
				group: request.groupTitle
			})}
			data-testid="join-request-dialog"
			actions={[
				{
					label: t('groupChat.joinRequest.decline'),
					onClick: onDecline,
					disabled: busy,
					testId: 'join-request-dialog-decline'
				},
				{
					label: t('groupChat.joinRequest.admit'),
					onClick: () => onAdmit(role),
					primary: true,
					disabled: busy,
					testId: 'join-request-dialog-admit'
				}
			]}
		>
			<Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2 }}>
				<UserAvatar
					userId={requester.consultantId}
					username={requester.consultantId}
					displayName={requester.displayName}
					size="48px"
				/>
				<Typography
					component="p"
					sx={{
						fontSize: 16,
						fontWeight: 500,
						lineHeight: '24px',
						color: 'var(--m3-on-surface)'
					}}
				>
					{requester.displayName}
				</Typography>
			</Box>
			<Box
				component="dl"
				sx={{
					display: 'grid',
					gridTemplateColumns: 'max-content 1fr',
					columnGap: 2,
					rowGap: 1,
					m: 0
				}}
			>
				{rows.map((row) => (
					<React.Fragment key={row.label}>
						<Typography
							component="dt"
							sx={{ ...labelSx, pt: '2px' }}
						>
							{row.label}
						</Typography>
						<Typography component="dd" sx={{ ...valueSx, m: 0 }}>
							{row.value}
						</Typography>
					</React.Fragment>
				))}
			</Box>
			<Typography
				id={roleLabelId}
				component="p"
				sx={{ ...labelSx, mt: 3, mb: 0.5 }}
			>
				{t('groupChat.joinRequest.dialog.admitAs')}
			</Typography>
			<RadioGroup
				aria-labelledby={roleLabelId}
				value={role}
				onChange={(event) =>
					setRole(event.target.value as GroupChatJoinAdmitRole)
				}
			>
				<FormControlLabel
					value="PARTICIPANT"
					control={<Radio />}
					label={t('groupChat.joinRequest.dialog.asParticipant')}
					sx={{ '.MuiFormControlLabel-label': valueSx }}
				/>
				<FormControlLabel
					value="CO_MODERATOR"
					disabled={blocked !== null}
					control={<Radio />}
					label={t('groupChat.joinRequest.dialog.asCoModerator')}
					sx={{ '.MuiFormControlLabel-label': valueSx }}
				/>
			</RadioGroup>
			{blocked && (
				<Typography component="p" sx={{ ...labelSx, ml: 4 }}>
					{blocked === 'notOwner'
						? t('groupChat.joinRequest.dialog.coModeratorOwnerOnly')
						: t(
								'groupChat.joinRequest.dialog.coModeratorSameTenant'
							)}
				</Typography>
			)}
			<Typography component="p" sx={{ ...labelSx, mt: 2 }}>
				{t('groupChat.joinRequest.dialog.privacy', {
					name: requester.displayName
				})}
			</Typography>
		</M3Dialog>
	);
};
