import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent } from 'storybook/test';
import {
	desktop1440Globals,
	phone390Globals
} from '../message/messageStoryShell';
import { GroupChatNotMember } from './GroupChatNotMember';

/**
 * #1499. A counsellor follows a group's invite link and now lands in her own
 * session view, not the client's entry room. When the group belongs to
 * another Beratungsstelle the server refuses it (`GET /users/chat/<id>`
 * → 403); this is what she sees instead of someone else's moderator room.
 *
 * Default pending Frank's confirmation: a colleague of the SAME
 * Beratungsstelle is still allowed the group by the server and keeps the
 * moderator room.
 */
const meta = {
	title: 'Group chat/Not a member',
	component: GroupChatNotMember,
	args: { onBack: fn() },
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'Beraterin öffnet den Einladungslink eines Gesprächskreises, zu dem sie nicht gehört: klare Aussage und der Weg zurück zu ihren Gesprächen (ORISO-Frontend#1499).'
			}
		}
	},
	decorators: [
		(Story) => (
			<div
				style={{
					height: '100vh',
					display: 'grid',
					background: 'var(--m3-surface-container-lowest, #fff)'
				}}
			>
				<Story />
			</div>
		)
	],
	play: async ({ args, canvas }) => {
		await expect(
			canvas.getByText('Sie sind nicht Teil dieses Gesprächskreises.')
		).toBeVisible();
		await userEvent.click(
			canvas.getByRole('button', { name: 'Zu meinen Gesprächen' })
		);
		await expect(args.onBack).toHaveBeenCalledTimes(1);
	}
} satisfies Meta<typeof GroupChatNotMember>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Desktop1440: Story = {
	name: 'Not a member · 1440',
	globals: desktop1440Globals
};

export const Phone390: Story = {
	name: 'Not a member · 390',
	globals: phone390Globals
};
