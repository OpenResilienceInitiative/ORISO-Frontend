import * as React from 'react';
import PhoneDisabledRoundedIcon from '@mui/icons-material/PhoneDisabledRounded';
import VideocamOffRoundedIcon from '@mui/icons-material/VideocamOffRounded';
import { Box, Button, Stack, Typography } from '@mui/material';
import { ReactComponent as AudioCallIcon } from '../../resources/img/icons/audio_call_filled_24px.svg';
import { ReactComponent as VideoCallIcon } from '../../resources/img/icons/video_call_filled_24px.svg';
import { ReactComponent as ScheduledMeetingIcon } from '../../resources/img/icons/scheduled_meeting_filled_24px.svg';
import { ChatSystemMessageCard } from './ChatSystemMessageCard';
import { UserAvatar } from './UserAvatar';

export type CallTimelineState = 'scheduled' | 'running' | 'ended' | 'missed';
export type CallTimelineType = 'audio' | 'video';

export interface CallTimelineParticipant {
	userId: string;
	username: string;
	displayName: string;
}

export interface CallTimelineSystemMessageProps {
	/** Determines the icon and whether an action can be rendered. */
	state: CallTimelineState;
	callType: CallTimelineType;
	/** Already translated accessible name, for example "Videoanruf". */
	callLabel: string;
	/** Already translated. The system-message shell never invents person names. */
	headline: string;
	/** Ordinary chat orientation derived from whether the current user sent it. */
	side?: 'received' | 'sent';
	/** Already translated short state, for example "Läuft" or "Beendet". */
	statusLabel: string;
	/** Full action summary shown under the initiator, e.g. "Videoanruf Termin eintragen". */
	actionSummaryLabel?: string;
	/** Already translated supporting sentence. */
	description: string;
	/** Already translated duration, only useful for an ended call. */
	durationLabel?: string;
	/** Already translated start date and time for a scheduled call. */
	scheduledForLabel?: string;
	/** Current members for a running call, final attendance for an ended call. */
	participants?: readonly CallTimelineParticipant[];
	/** Total count when the backend cannot expose individual identities. */
	participantCount?: number;
	/** Already translated label, for example "Im Anruf" or "Teilgenommen". */
	participantsLabel?: string;
	/** Already translated action label. Required together with `onAction`. */
	actionLabel?: string;
	onAction?: () => void;
	/** Reuses an existing complex action, such as the calendar menu. */
	actionSlot?: React.ReactNode;
}

const systemMessageColors = {
	primary: 'var(--m3-primary, #ba1a1a)',
	onPrimary: 'var(--m3-on-primary, #ffffff)',
	primaryContainer: 'var(--m3-primary-container, #ffdad6)',
	onPrimaryContainer: 'var(--m3-on-primary-container, #410002)',
	surfaceContainer: 'var(--m3-surface-container, #f0edee)',
	onSurface: 'var(--m3-on-surface, #1a1c1e)',
	onSurfaceVariant: 'var(--m3-on-surface-variant, #444748)'
} as const;

/**
 * A call lifecycle entry rendered inside ORISO's canonical Carimat system
 * message. The shell, avatar and bubble geometry are shared with the existing
 * handover notices; only the call-specific content is MUI.
 */
export const CallTimelineSystemMessage = ({
	state,
	callType,
	callLabel,
	headline,
	side = 'received',
	statusLabel,
	actionSummaryLabel,
	description,
	durationLabel,
	scheduledForLabel,
	participants = [],
	participantCount,
	participantsLabel,
	actionLabel,
	onAction,
	actionSlot
}: CallTimelineSystemMessageProps) => {
	const running = state === 'running';
	const scheduled = state === 'scheduled';
	const EventIcon = scheduled
		? ScheduledMeetingIcon
		: callType === 'audio'
			? running
				? AudioCallIcon
				: PhoneDisabledRoundedIcon
			: running
				? VideoCallIcon
				: VideocamOffRoundedIcon;
	const ActionIcon = callType === 'audio' ? AudioCallIcon : VideoCallIcon;
	const primaryLabel = scheduled
		? scheduledForLabel || statusLabel
		: running
			? statusLabel
			: durationLabel || statusLabel;

	return (
		<ChatSystemMessageCard
			title={headline}
			subtitle={
				actionSummaryLabel || `${callLabel} ${statusLabel}`
			}
			side={side}
			avatarIcon={<EventIcon data-testid="CallTimelineEventIcon" />}
		>
			<Stack
				component="section"
				role="status"
				aria-label={`${callLabel}: ${statusLabel}`}
				spacing={1.5}
				sx={{ minWidth: 0 }}
			>
				<Stack direction="row" spacing={1.5} alignItems="center">
					<Typography
						variant="body1"
						sx={{
							fontSize: 16,
							fontWeight: 600,
							lineHeight: '24px',
							letterSpacing: '0.15px',
							color: systemMessageColors.onSurface
						}}
					>
						{primaryLabel}
					</Typography>
				</Stack>

				<Typography
					variant="body2"
					sx={{
						fontSize: 14,
						lineHeight: '20px',
						letterSpacing: '0.25px',
						color: systemMessageColors.onSurfaceVariant
					}}
				>
					{description}
				</Typography>

				{(participantCount || participants.length) > 0 &&
					participantsLabel && (
						<Stack
							direction="row"
							alignItems="center"
							justifyContent="space-between"
							spacing={2}
							role="group"
							aria-label={participantsLabel}
						>
							<Typography
								variant="caption"
								sx={{
									fontSize: 12,
									lineHeight: '16px',
									fontWeight: 500,
									letterSpacing: '0.5px',
									color: systemMessageColors.onSurfaceVariant
								}}
							>
								{participantsLabel} ·{' '}
								{participantCount || participants.length}
							</Typography>
							{participants.length > 0 && (
								<Box
									sx={{
										display: 'flex',
										alignItems: 'center',
										pl: 1
									}}
								>
									{participants.map((participant, index) => (
										<Box
											key={participant.userId}
											sx={{
												ml: index === 0 ? 0 : '-8px',
												zIndex: 20 - index
											}}
										>
											<UserAvatar
												userId={participant.userId}
												username={participant.username}
												displayName={
													participant.displayName
												}
												size="32px"
											/>
										</Box>
									))}
								</Box>
							)}
						</Stack>
					)}

				{actionSlot && (
					<Box
						sx={{
						alignSelf: side === 'sent' ? 'flex-start' : 'flex-end',
						maxWidth: '100%'
					}}
					>
						{actionSlot}
					</Box>
				)}

				{!actionSlot && running && actionLabel && onAction && (
					<Button
						variant="contained"
						onClick={onAction}
						startIcon={<ActionIcon aria-hidden="true" />}
						disableElevation
						sx={{
							'alignSelf':
								side === 'sent' ? 'flex-start' : 'flex-end',
							'minHeight': 40,
							'borderRadius': 999,
							'px': 3,
							'textTransform': 'none',
							'fontSize': 14,
							'fontWeight': 600,
							'letterSpacing': '0.1px',
							'backgroundColor': systemMessageColors.primary,
							'color': systemMessageColors.onPrimary,
							'&:hover': {
								backgroundColor: systemMessageColors.primary
							},
							'&:focus-visible': {
								outline: `3px solid ${systemMessageColors.primaryContainer}`,
								outlineOffset: 2
							},
							'& .MuiButton-startIcon svg': {
								width: 20,
								height: 20
							}
						}}
					>
						{actionLabel}
					</Button>
				)}
			</Stack>
		</ChatSystemMessageCard>
	);
};

export default CallTimelineSystemMessage;
