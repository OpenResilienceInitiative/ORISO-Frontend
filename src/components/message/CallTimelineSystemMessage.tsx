import * as React from 'react';
import PhoneDisabledRoundedIcon from '@mui/icons-material/PhoneDisabledRounded';
import { Box, Button, Stack, Typography } from '@mui/material';
import { ChatSystemMessageCard } from './ChatSystemMessageCard';
import { UserAvatar } from './UserAvatar';
import { ReactComponent as CallOnIcon } from '../../resources/img/icons/call-on.svg';
import { ReactComponent as CameraOnIcon } from '../../resources/img/icons/camera-on.svg';
import { ReactComponent as CameraOffIcon } from '../../resources/img/icons/camera-off.svg';

export type CallTimelineState = 'running' | 'ended' | 'missed';
export type CallTimelineType = 'audio' | 'video';

export interface CallTimelineParticipant {
	userId: string;
	username: string;
	displayName: string;
}

export interface CallTimelineSystemMessageProps {
	state: CallTimelineState;
	callType: CallTimelineType;
	callLabel: string;
	headline: string;
	statusLabel: string;
	description: string;
	durationLabel?: string;
	participants?: readonly CallTimelineParticipant[];
	participantsLabel?: string;
	actionLabel?: string;
	actionDisabled?: boolean;
	actionStatusLabel?: string;
	onAction?: () => void;
}

const colors = {
	primary: 'var(--m3-primary, #ba1a1a)',
	onPrimary: 'var(--m3-on-primary, #ffffff)',
	primaryContainer: 'var(--m3-primary-container, #ffdad6)',
	onPrimaryContainer: 'var(--m3-on-primary-container, #410002)',
	surfaceContainer: 'var(--m3-surface-container, #f0edee)',
	onSurface: 'var(--m3-on-surface, #1a1c1e)',
	onSurfaceVariant: 'var(--m3-on-surface-variant, #444748)'
} as const;

/** Call-specific content inside the existing Carimat system-message card. */
export const CallTimelineSystemMessage = ({
	state,
	callType,
	callLabel,
	headline,
	statusLabel,
	description,
	durationLabel,
	participants = [],
	participantsLabel,
	actionLabel,
	actionDisabled = false,
	actionStatusLabel,
	onAction
}: CallTimelineSystemMessageProps) => {
	const running = state === 'running';
	// Library glyphs sized to the old 20px MUI glyph boxes. No library icon
	// for "phone disabled" yet, so that one stays MUI (#1822).
	const callIcon =
		callType === 'audio' ? (
			running ? (
				<CallOnIcon
					width={15}
					height={15}
					aria-hidden
					data-testid="callTimelineIcon-audio"
				/>
			) : (
				<PhoneDisabledRoundedIcon fontSize="small" aria-hidden />
			)
		) : running ? (
			<CameraOnIcon
				width={15}
				height={10}
				aria-hidden
				data-testid="callTimelineIcon-video"
			/>
		) : (
			<CameraOffIcon
				width={16}
				height={13}
				aria-hidden
				data-testid="callTimelineIcon-videoOff"
			/>
		);

	return (
		<ChatSystemMessageCard title={headline} subtitle={statusLabel}>
			<Stack
				component="section"
				role="status"
				aria-label={`${callLabel}: ${statusLabel}`}
				spacing={1.5}
				sx={{ minWidth: 0 }}
			>
				<Stack direction="row" spacing={1.5} alignItems="center">
					<Box
						sx={{
							'width': 40,
							'height': 40,
							'borderRadius': '50%',
							'display': 'grid',
							'placeItems': 'center',
							'flex': '0 0 auto',
							'backgroundColor': running
								? colors.primaryContainer
								: colors.surfaceContainer,
							'color': running
								? colors.onPrimaryContainer
								: colors.onSurfaceVariant,
							// Library SVGs ship white fills; the theme decides.
							'& svg path': { fill: 'currentColor' }
						}}
					>
						{callIcon}
					</Box>
					<Typography
						variant="body1"
						sx={{
							fontSize: 16,
							fontWeight: 600,
							lineHeight: '24px',
							letterSpacing: '0.15px',
							color: colors.onSurface
						}}
					>
						{running ? statusLabel : durationLabel || statusLabel}
					</Typography>
				</Stack>

				<Typography
					variant="body2"
					sx={{
						fontSize: 14,
						lineHeight: '20px',
						letterSpacing: '0.25px',
						color: colors.onSurfaceVariant
					}}
				>
					{description}
				</Typography>

				{participants.length > 0 && participantsLabel && (
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
								color: colors.onSurfaceVariant
							}}
						>
							{participantsLabel} · {participants.length}
						</Typography>
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
									<UserAvatar {...participant} size="32px" />
								</Box>
							))}
						</Box>
					</Stack>
				)}

				{running && actionLabel && onAction && (
					<Button
						variant="contained"
						onClick={onAction}
						disabled={actionDisabled}
						disableElevation
						sx={{
							'alignSelf': 'flex-start',
							'minHeight': 40,
							'borderRadius': 999,
							'px': 3,
							'textTransform': 'none',
							'fontSize': 14,
							'fontWeight': 600,
							'letterSpacing': '0.1px',
							'backgroundColor': colors.primary,
							'color': colors.onPrimary,
							'&:hover': { backgroundColor: colors.primary },
							'&:focus-visible': {
								outline: `3px solid ${colors.primaryContainer}`,
								outlineOffset: 2
							}
						}}
					>
						{actionLabel}
					</Button>
				)}
				{actionStatusLabel && (
					<Typography
						variant="body2"
						role="status"
						aria-live="polite"
					>
						{actionStatusLabel}
					</Typography>
				)}
			</Stack>
		</ChatSystemMessageCard>
	);
};

export default CallTimelineSystemMessage;
