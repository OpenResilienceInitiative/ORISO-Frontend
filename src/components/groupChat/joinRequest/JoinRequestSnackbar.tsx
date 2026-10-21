import * as React from 'react';
import { useId } from 'react';
import { Box, Button, Typography } from '@mui/material';
import type { SxProps, Theme } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { UserAvatar } from '../../message/UserAvatar';
import {
	M3_SNACKBAR_ELEVATION,
	m3SnackbarColors
} from '../../m3Snackbar/M3Snackbar';
import { GroupChatJoinRequest, minutesSince } from './joinRequestModel';

export interface JoinRequestSnackbarProps {
	request: GroupChatJoinRequest;
	/** Injected so stories and tests are deterministic. Defaults to now. */
	now?: Date;
	/** A decision is on its way: both decisions grey out (never vanish). */
	busy?: boolean;
	/** Admit as participant — the popup offers the other role. */
	onAdmit: () => void;
	onDecline: () => void;
	onDetails: () => void;
}

const textAction: SxProps<Theme> = {
	'color': m3SnackbarColors.action,
	'textTransform': 'none',
	'fontSize': 14,
	'fontWeight': 500,
	'lineHeight': '20px',
	'letterSpacing': '0.1px',
	'minWidth': 0,
	'px': 1.5,
	'borderRadius': '20px',
	'whiteSpace': 'nowrap',
	'&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.08)' },
	'&:focus-visible': {
		outline: `2px solid ${m3SnackbarColors.action}`,
		outlineOffset: 2
	},
	'&.Mui-disabled': { color: m3SnackbarColors.onSurface, opacity: 0.38 }
};

/* The one filled action. Inverse-primary on the inverse surface is the pair
   the snackbar already uses for its action, turned around for emphasis. */
const filledAction: SxProps<Theme> = {
	...textAction,
	'backgroundColor': m3SnackbarColors.action,
	'color': m3SnackbarColors.surface,
	'px': 2,
	'&:hover': {
		backgroundColor: m3SnackbarColors.action,
		boxShadow: '0 1px 2px rgba(0, 0, 0, 0.3)'
	},
	'&:focus-visible': {
		outline: `2px solid ${m3SnackbarColors.onSurface}`,
		outlineOffset: 2
	},
	'&.Mui-disabled': {
		backgroundColor: m3SnackbarColors.onSurface,
		color: m3SnackbarColors.surface,
		opacity: 0.38
	}
};

const bodySmall = {
	color: 'inherit',
	fontSize: 12,
	lineHeight: '16px',
	letterSpacing: '0.4px'
} as const;

/**
 * The child variant of the stacked snackbar for "someone is knocking" (#1499).
 *
 * Same surface as `M3Snackbar` (the inverse roles and elevation 3), a richer
 * anatomy: who is asking (avatar and name), where she comes from (role,
 * Beratungsstelle, Träger), how she got here (the invite link) and when —
 * the "ein paar Infos" Frank asked for — and the decision right there.
 *
 * M3 gives a snackbar one action. This one carries three on purpose: the
 * moderator is mid-conversation and must be able to let somebody in without
 * leaving it. "Details" opens the popup (`JoinRequestDialog`) with the full
 * picture and the choice of role.
 */
export const JoinRequestSnackbar = ({
	request,
	now = new Date(),
	busy = false,
	onAdmit,
	onDecline,
	onDetails
}: JoinRequestSnackbarProps) => {
	const { t } = useTranslation();
	const nameId = useId();
	const { requester } = request;
	const minutes = minutesSince(request.requestedAt, now);
	const origin = [
		t('groupChat.joinRequest.role'),
		requester.agencyName,
		requester.tenantName
	]
		.filter(Boolean)
		.join(' · ');
	const when =
		minutes < 1
			? t('groupChat.joinRequest.justNow')
			: t('groupChat.joinRequest.minutesAgo', { count: minutes });

	return (
		<Box
			role="group"
			aria-labelledby={nameId}
			data-testid="join-request-snackbar"
			sx={{
				backgroundColor: m3SnackbarColors.surface,
				color: m3SnackbarColors.onSurface,
				borderRadius: '4px',
				boxShadow: M3_SNACKBAR_ELEVATION,
				pt: 1.5,
				pb: 1,
				px: 2
			}}
		>
			<Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
				<UserAvatar
					userId={requester.consultantId}
					username={requester.consultantId}
					displayName={requester.displayName}
					size="40px"
				/>
				<Box sx={{ minWidth: 0, flex: 1 }}>
					<Typography
						id={nameId}
						component="p"
						sx={{
							color: 'inherit',
							fontSize: 14,
							fontWeight: 500,
							lineHeight: '20px',
							letterSpacing: '0.1px',
							overflowWrap: 'anywhere'
						}}
					>
						{requester.displayName}
					</Typography>
					<Typography
						component="p"
						sx={{
							color: 'inherit',
							fontSize: 14,
							lineHeight: '20px',
							letterSpacing: '0.25px'
						}}
					>
						{t('groupChat.joinRequest.knocks', {
							group: request.groupTitle
						})}
					</Typography>
					<Typography
						component="p"
						sx={{ ...bodySmall, mt: 0.5, overflowWrap: 'anywhere' }}
					>
						{origin}
					</Typography>
					<Typography component="p" sx={bodySmall}>
						{t('groupChat.joinRequest.viaInviteLink')} ·{' '}
						<time dateTime={request.requestedAt}>{when}</time>
					</Typography>
				</Box>
			</Box>
			<Box
				sx={{
					display: 'flex',
					alignItems: 'center',
					gap: 0.5,
					mt: 1,
					mx: -1
				}}
			>
				<Button
					variant="text"
					onClick={onDetails}
					sx={textAction}
					data-testid="join-request-details"
				>
					{t('groupChat.joinRequest.details')}
				</Button>
				<Box sx={{ flex: 1 }} />
				<Button
					variant="text"
					onClick={onDecline}
					disabled={busy}
					sx={textAction}
					data-testid="join-request-decline"
				>
					{t('groupChat.joinRequest.decline')}
				</Button>
				<Button
					variant="text"
					onClick={onAdmit}
					disabled={busy}
					sx={filledAction}
					data-testid="join-request-admit"
				>
					{t('groupChat.joinRequest.admit')}
				</Button>
			</Box>
		</Box>
	);
};
