import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box, Typography } from '@mui/material';
import { fn } from 'storybook/test';
import { AppointmentTimelineSystemMessage } from './AppointmentTimelineSystemMessage';
import { GroupChatCalendarMenu } from '../groupChat/GroupChatCalendarMenu';
import { desktop1440Globals, phone375Globals } from './messageStoryShell';
import './message.styles.scss';

const meta: Meta = {
	title: 'Chat/Scheduling system events',
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'Globale Terminereignisse in beiden Chatperspektiven. Der Name des Initiators steht allein oben; die vollständige Aktion steht darunter.'
			}
		}
	}
};

export default meta;
type Story = StoryObj;

const onAction = fn();
const start = new Date('2026-09-10T16:00:00.000Z');

const Frame = ({ children }: { children: React.ReactNode }) => (
	<Box sx={{ minHeight: '100vh', p: { xs: 2, sm: 3 } }}>
		<Box sx={{ maxWidth: 760, mx: 'auto' }}>{children}</Box>
	</Box>
);

const Example = ({
	label,
	children
}: {
	label: string;
	children: React.ReactNode;
}) => (
	<Box sx={{ mb: 4 }}>
		<Typography
			sx={{
				mb: 1,
				fontSize: 11,
				letterSpacing: '.08em',
				textTransform: 'uppercase',
				color: 'var(--m3-on-surface-variant, #444748)'
			}}
		>
			{label}
		</Typography>
		{children}
	</Box>
);

const AllExamples = () => (
	<Frame>
		<Example label="Jemand anderes · Terminanfrage">
			<AppointmentTimelineSystemMessage
				state="requested"
				initiatorName="Beraterin Lea"
				actionSummaryLabel="Videoanruf · Terminanfrage"
				description="Beraterin Lea schlägt Donnerstag, 10. September um 18:00 Uhr vor."
				scheduledForLabel="Do., 10. September · 18:00 Uhr"
				actionLabel="Anfrage beantworten"
				onAction={onAction}
			/>
		</Example>
		<Example label="Ich · Terminanfrage gesendet">
			<AppointmentTimelineSystemMessage
				state="requested"
				side="sent"
				initiatorName="Sanftes Alpaka Kim"
				actionSummaryLabel="Videoanruf · Terminanfrage gesendet"
				description="Die Anfrage wartet auf eine Antwort."
				scheduledForLabel="Do., 10. September · 18:00 Uhr"
				actionLabel="Anfrage ansehen"
				onAction={onAction}
			/>
		</Example>
		<Example label="Termin geplant · Kalender">
			<AppointmentTimelineSystemMessage
				state="scheduled"
				initiatorName="Beraterin Lea"
				actionSummaryLabel="Videoanruf · Termin geplant"
				description="Der Termin dauert 60 Minuten."
				scheduledForLabel="Do., 10. September · 18:00 Uhr"
				actionSlot={
					<GroupChatCalendarMenu
						start={start}
						durationMinutes={60}
						eventId="appointment-storybook"
					/>
				}
			/>
		</Example>
		<Example label="Termin bestätigt">
			<AppointmentTimelineSystemMessage
				state="accepted"
				side="sent"
				initiatorName="Sanftes Alpaka Kim"
				actionSummaryLabel="Videoanruf · Termin bestätigt"
				description="Der Termin wurde bestätigt."
				scheduledForLabel="Do., 10. September · 18:00 Uhr"
			/>
		</Example>
		<Example label="Termin abgelehnt">
			<AppointmentTimelineSystemMessage
				state="declined"
				initiatorName="Beraterin Lea"
				actionSummaryLabel="Videoanruf · Termin abgelehnt"
				description="Der vorgeschlagene Termin wurde abgelehnt."
			/>
		</Example>
	</Frame>
);

export const AllStatesBothDirections: Story = {
	name: 'Alle Zustände · Ich und andere',
	render: AllExamples,
	globals: desktop1440Globals
};

export const Mobile: Story = {
	name: 'Mobil · alle Zustände',
	render: AllExamples,
	globals: phone375Globals
};
