import * as React from 'react';
import { Button, Stack, Typography } from '@mui/material';
import { ChatSystemMessageCard } from './ChatSystemMessageCard';
import { ReactComponent as SchedulingRequestIcon } from '../../resources/img/icons/event_scheduling_request_filled_24px.svg';
import { ReactComponent as ScheduledMeetingIcon } from '../../resources/img/icons/scheduled_meeting_filled_24px.svg';
import { ReactComponent as EventAcceptedIcon } from '../../resources/img/icons/event_accepted_filled_24px.svg';
import { ReactComponent as EventCanceledIcon } from '../../resources/img/icons/event_canceled_filled_24px.svg';

export type AppointmentTimelineState =
	| 'requested'
	| 'scheduled'
	| 'accepted'
	| 'declined';

export interface AppointmentTimelineSystemMessageProps {
	state: AppointmentTimelineState;
	side?: 'received' | 'sent';
	initiatorName: string;
	actionSummaryLabel: string;
	description: string;
	scheduledForLabel?: string;
	actionLabel?: string;
	onAction?: () => void;
	actionSlot?: React.ReactNode;
}

const iconByState = {
	requested: SchedulingRequestIcon,
	scheduled: ScheduledMeetingIcon,
	accepted: EventAcceptedIcon,
	declined: EventCanceledIcon
} as const;

/**
 * Global scheduling event using the same sender geometry as ordinary chat.
 * The initiator is the title; the second line names the complete action.
 */
export const AppointmentTimelineSystemMessage = ({
	state,
	side = 'received',
	initiatorName,
	actionSummaryLabel,
	description,
	scheduledForLabel,
	actionLabel,
	onAction,
	actionSlot
}: AppointmentTimelineSystemMessageProps) => {
	const EventIcon = iconByState[state];
	const actionAlignment = side === 'sent' ? 'flex-start' : 'flex-end';

	return (
		<ChatSystemMessageCard
			title={initiatorName}
			subtitle={actionSummaryLabel}
			side={side}
			avatarIcon={<EventIcon data-testid={`appointment-${state}-icon`} />}
			dataCy={`appointment-timeline-${state}`}
		>
			<Stack
				component="section"
				role="group"
				aria-label={actionSummaryLabel}
				spacing={1.5}
				sx={{ minWidth: 0 }}
			>
				{scheduledForLabel && (
					<Typography
						variant="body1"
						sx={{ fontWeight: 600, lineHeight: '24px' }}
					>
						{scheduledForLabel}
					</Typography>
				)}
				<Typography
					variant="body2"
					sx={{
						fontSize: 14,
						lineHeight: '20px',
						color: 'var(--m3-on-surface-variant, #444748)'
					}}
				>
					{description}
				</Typography>
				{actionSlot && (
					<Stack alignItems={actionAlignment}>{actionSlot}</Stack>
				)}
				{!actionSlot && actionLabel && onAction && (
					<Button
						variant="contained"
						startIcon={<EventIcon aria-hidden="true" />}
						onClick={onAction}
						disableElevation
						sx={{
							'alignSelf': actionAlignment,
							'minHeight': 40,
							'borderRadius': 999,
							'px': 3,
							'textTransform': 'none',
							'fontWeight': 600,
							'backgroundColor': 'var(--m3-primary, #a5000a)',
							'color': 'var(--m3-on-secondary, #ffffff)',
							'&:hover': {
								backgroundColor: 'var(--m3-primary, #a5000a)'
							},
							'& .MuiButton-startIcon svg': {
								width: 20,
								height: 20,
								color: 'inherit'
							},
							'& .MuiButton-startIcon svg path': {
								fill: 'currentColor'
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

export default AppointmentTimelineSystemMessage;
