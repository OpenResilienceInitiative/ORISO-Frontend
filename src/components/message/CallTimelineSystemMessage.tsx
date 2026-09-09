import * as React from 'react';
import VideocamRoundedIcon from '@mui/icons-material/VideocamRounded';
import VideocamOffRoundedIcon from '@mui/icons-material/VideocamOffRounded';
import { Box, Button, Stack, Typography } from '@mui/material';
import { ChatSystemMessageCard } from './ChatSystemMessageCard';

export type CallTimelineState = 'running' | 'ended';

export interface CallTimelineSystemMessageProps {
	/** Determines the icon and whether an action can be rendered. */
	state: CallTimelineState;
	/** Already translated. The system-message shell never invents person names. */
	headline: string;
	/** Already translated short state, for example "Läuft" or "Beendet". */
	statusLabel: string;
	/** Already translated supporting sentence. */
	description: string;
	/** Already translated duration, only useful for an ended call. */
	durationLabel?: string;
	/** Already translated action label. Required together with `onAction`. */
	actionLabel?: string;
	onAction?: () => void;
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
	headline,
	statusLabel,
	description,
	durationLabel,
	actionLabel,
	onAction
}: CallTimelineSystemMessageProps) => {
	const running = state === 'running';
	const CallIcon = running ? VideocamRoundedIcon : VideocamOffRoundedIcon;

	return (
		<ChatSystemMessageCard title={headline} subtitle={statusLabel}>
			<Stack
				component="section"
				role="status"
				aria-label={`Videoanruf: ${statusLabel}`}
				spacing={1.5}
				sx={{ minWidth: 0 }}
			>
				<Stack direction="row" spacing={1.5} alignItems="center">
					<Box
						sx={{
							width: 40,
							height: 40,
							borderRadius: '50%',
							display: 'grid',
							placeItems: 'center',
							flex: '0 0 auto',
							backgroundColor: running
								? systemMessageColors.primaryContainer
								: systemMessageColors.surfaceContainer,
							color: running
								? systemMessageColors.onPrimaryContainer
								: systemMessageColors.onSurfaceVariant
						}}
					>
						<CallIcon fontSize="small" aria-hidden="true" />
					</Box>
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
						{running ? statusLabel : durationLabel || statusLabel}
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

				{running && actionLabel && onAction && (
					<Button
						variant="contained"
						onClick={onAction}
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
							'backgroundColor': systemMessageColors.primary,
							'color': systemMessageColors.onPrimary,
							'&:hover': {
								backgroundColor: systemMessageColors.primary
							},
							'&:focus-visible': {
								outline: `3px solid ${systemMessageColors.primaryContainer}`,
								outlineOffset: 2
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
