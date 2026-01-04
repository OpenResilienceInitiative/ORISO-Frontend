import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { UserAvatar } from './UserAvatar';

const meta: Meta<typeof UserAvatar> = {
	title: 'Components/Chat/UserAvatar',
	component: UserAvatar,
	tags: ['autodocs'],
	argTypes: {
		username: {
			control: 'text',
			description: 'Username to display in avatar'
		},
		displayName: {
			control: 'text',
			description: 'Display name (optional, falls back to username)'
		},
		userId: {
			control: 'text',
			description: 'Unique user ID for avatar generation'
		},
		size: {
			control: 'select',
			options: ['24px', '32px', '40px', '48px', '64px'],
			description: 'Avatar size'
		}
	}
};

export default meta;
type Story = StoryObj<typeof UserAvatar>;

/**
 * Default avatar size (32px) - used in chat messages
 */
export const Default: Story = {
	args: {
		username: 'orisouser',
		displayName: 'Oriso User',
		userId: 'orisouser',
		size: '32px'
	}
};

/**
 * Small avatar (24px) - for compact views
 */
export const Small: Story = {
	args: {
		username: 'consultant',
		displayName: 'Consultant',
		userId: 'consultant',
		size: '24px'
	}
};

/**
 * Large avatar (40px) - used in session headers
 */
export const Large: Story = {
	args: {
		username: 'orisouser',
		displayName: 'Oriso User',
		userId: 'orisouser',
		size: '40px'
	}
};

/**
 * Extra large avatar (64px) - for profile views
 */
export const ExtraLarge: Story = {
	args: {
		username: 'admin',
		displayName: 'Admin User',
		userId: 'admin',
		size: '64px'
	}
};

/**
 * Avatar without display name (uses username only)
 */
export const UsernameOnly: Story = {
	args: {
		username: 'testuser',
		userId: 'testuser',
		size: '32px'
	}
};

/**
 * Multiple avatars in a row - typical chat view
 */
export const MultipleAvatars: Story = {
	render: () => (
		<div style={{ display: 'flex', gap: '16px', padding: '20px' }}>
			<UserAvatar
				username="alice"
				userId="alice"
				size="32px"
			/>
			<UserAvatar
				username="bob"
				userId="bob"
				size="32px"
			/>
			<UserAvatar
				username="consultant"
				userId="consultant"
				size="32px"
			/>
			<UserAvatar
				username="orisouser"
				userId="orisouser"
				size="32px"
			/>
		</div>
	)
};

