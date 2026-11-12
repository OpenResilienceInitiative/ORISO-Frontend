import * as React from 'react';
import PhoneDisabledRoundedIcon from '@mui/icons-material/PhoneDisabledRounded';
import { Box, Button, Stack, Tooltip, Typography } from '@mui/material';
import { ChatSystemMessageCard } from './ChatSystemMessageCard';
import { UserAvatar } from './UserAvatar';
import { formatMessagePersonName } from './messageNameUtils';
import type { AvatarChoice } from '../../utils/avatarChoice';
import { ReactComponent as CallOnIcon } from '../../resources/img/icons/call-on.svg';
import { ReactComponent as CameraOnIcon } from '../../resources/img/icons/camera-on.svg';
import { ReactComponent as CameraOffIcon } from '../../resources/img/icons/camera-off.svg';

export type CallTimelineState = 'running' | 'ended' | 'missed';
export type CallTimelineType = 'audio' | 'video';

export interface CallTimelineParticipant {
	userId: string;
	username: string;
	displayName: string;
	avatarDisplayName?: string;
	choice?: AvatarChoice | null;
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

/** Participant faces on the call card (#2237): large enough to recognise. */
export const PARTICIPANT_AVATAR_SIZE = 40;

const colors = {
	primary: 'var(--m3-primary, #ba1a1a)',
	onPrimary: 'var(--m3-on-primary, #ffffff)',
	primaryContainer: 'var(--m3-primary-container, #ffdad6)',
	onPrimaryContainer: 'var(--m3-on-primary-container, #410002)',
	surfaceContainer: 'var(--m3-surface-container, #f0edee)',
	onSurface: 'var(--m3-on-surface, #1a1c1e)',
	onSurfaceVariant: 'var(--m3-on-surface-variant, #444748)'
} as const;

/** Same dark tooltip as the room header's participant row. */
const participantTooltipSx = {
	'backgroundColor': 'var(--m3-inverse-surface, #313030)',
	'color': 'var(--m3-inverse-on-surface, #f4f0ef)',
	'borderRadius': '4px',
	'padding': '4px 8px',
	'fontSize': 12,
	'fontWeight': 500,
	'lineHeight': '16px',
	'letterSpacing': '0.5px',
	// 6px above the face, as in the header row (MUI default is 14px).
	'.MuiTooltip-popper[data-popper-placement*="top"] &': {
		marginBottom: '6px'
	}
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
						{/*
						 * The call's length, not its state again (#2237): the
						 * state already sits under the title. While the call
						 * runs the caller ticks this every second, so it is a
						 * `timer` — implicitly not live, or the surrounding
						 * status region would read it out once a second.
						 */}
						<Box
							component="span"
							role={
								running && durationLabel ? 'timer' : undefined
							}
							data-cy="call-timeline-duration"
						>
							{durationLabel || statusLabel}
						</Box>
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
						{/*
						 * Readable at a glance (#2237, checkpoint 4): 40px faces
						 * side by side. The white ring and grey outline the
						 * shared avatar adds by default shrank the face to 24px
						 * inside a 32px footprint and drew a heavy circle round
						 * it, so both are off here; without a ring the faces
						 * must not overlap, hence the gap instead of -8px.
						 */}
						<Box
							sx={{
								display: 'flex',
								alignItems: 'center',
								flexWrap: 'wrap',
								justifyContent: 'flex-end',
								gap: 0.5,
								pl: 1
							}}
						>
							{participants.map((participant) => {
								const face = (
									<UserAvatar
										{...participant}
										size={PARTICIPANT_AVATAR_SIZE}
										ring={false}
										outline={false}
									/>
								);
								/*
								 * The person's name on hover and keyboard focus,
								 * in the dark tooltip the room header's avatar row
								 * uses (#2237). Only a real name: an id-only
								 * participant gets no tooltip, as on the card.
								 */
								const name = formatMessagePersonName(
									participant.avatarDisplayName ??
										participant.displayName,
									participant.username
								);
								if (!name)
									return (
										<React.Fragment
											key={participant.userId}
										>
											{face}
										</React.Fragment>
									);
								return (
									<Tooltip
										key={participant.userId}
										title={name}
										placement="top"
										describeChild
										slotProps={{
											tooltip: {
												'sx': participantTooltipSx,
												// @ts-expect-error data-* attributes pass through
												'data-cy':
													'call-participant-tooltip'
											}
										}}
									>
										<Box
											component="span"
											tabIndex={0}
											data-cy="call-participant"
											sx={{
												'display': 'inline-flex',
												'borderRadius': '50%',
												'&:focus-visible': {
													outline: `2px solid ${colors.primary}`,
													outlineOffset: 2
												}
											}}
										>
											{face}
										</Box>
									</Tooltip>
								);
							})}
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
