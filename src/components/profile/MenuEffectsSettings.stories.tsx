import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Stack, Typography } from '@mui/material';
import { MenuEffectsSettings } from '../../features/menu-effects/MenuEffectsSettings';
import { GroupChatCalendarMenu } from '../groupChat/GroupChatCalendarMenu';

const meta = {
	title: 'Profile/Menu appearance',
	component: MenuEffectsSettings,
	parameters: { layout: 'fullscreen' },
	render: () => (
		<Stack spacing={4} sx={{ p: 4, maxWidth: 720 }}>
			<MenuEffectsSettings />
			<Typography variant="h5">
				Gesprächskreis: Gemeinsam den Alltag meistern
			</Typography>
			<Typography>
				Öffnen Sie das Kalendermenü, um die gewählte Darstellung
				auszuprobieren.
			</Typography>
			<div>
				<GroupChatCalendarMenu
					start={new Date('2026-09-09T14:00:00Z')}
					durationMinutes={60}
					eventId={42}
				/>
			</div>
		</Stack>
	)
} satisfies Meta<typeof MenuEffectsSettings>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Preview: Story = {};
