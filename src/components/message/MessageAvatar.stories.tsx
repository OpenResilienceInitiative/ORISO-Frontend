import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, waitFor } from 'storybook/test';
import { MessageAvatar } from './MessageAvatar';
import './message.styles.scss';

const meta: Meta<typeof MessageAvatar> = {
	title: 'Components/Chat/MessageAvatar',
	component: MessageAvatar,
	tags: ['autodocs'],
	parameters: {
		layout: 'centered'
	},
	argTypes: {
		isGroup: {
			control: 'boolean',
			description: 'Whether the active session is a group chat'
		},
		isUserMessage: {
			control: 'boolean',
			description: 'Whether the message is from the client/asker'
		},
		isSystemNotification: {
			control: 'boolean',
			description: 'System notifications render no avatar here'
		},
		size: {
			control: { type: 'number', min: 24, max: 64, step: 4 },
			description: 'Avatar size in pixels'
		}
	}
};

export default meta;
type Story = StoryObj<typeof MessageAvatar>;

const baseIdentity = {
	userId: 'client-asker-1',
	username: 'sanftes.alpaka.kala@oriso.invalid',
	displayName: 'Sanftes Alpaka Kala',
	firstName: 'Sanftes',
	lastName: 'Alpaka Kala',
	size: 32,
	isSystemNotification: false
};

/**
 * Client in a 1-on-1 chat — shows the generated animal pseudonym avatar.
 * At 32px the animal SVG inner area is 20px (visible after AnimalAvatar padding fix).
 */
export const ClientIn1on1Chat: Story = {
	args: {
		...baseIdentity,
		isGroup: false,
		isUserMessage: true
	},
	play: async ({ canvasElement }) => {
		await waitFor(() => {
			const svg = canvasElement.querySelector('.messageItem__avatar svg');
			expect(svg).toBeTruthy();
			const innerHost = svg?.parentElement;
			expect(innerHost).toBeTruthy();
			expect(innerHost?.clientWidth).toBeGreaterThan(0);
			expect(innerHost?.clientHeight).toBeGreaterThan(0);
		});
	}
};

/**
 * Incoming message in a 1-on-1 chat (consultant view) — animal avatar;
 * all incoming 1-on-1 messages use the animal pseudonym regardless of role.
 */
export const ConsultantIn1on1Chat: Story = {
	args: {
		...baseIdentity,
		userId: 'consultant-1',
		username: 'dr.mueller',
		displayName: 'Dr. Müller',
		firstName: 'Anna',
		lastName: 'Müller',
		isGroup: false,
		isUserMessage: false
	},
	play: async ({ canvasElement }) => {
		await waitFor(() => {
			const svg = canvasElement.querySelector('.messageItem__avatar svg');
			expect(svg).toBeTruthy();
		});
	}
};

/**
 * Consultant or moderator in an internal group chat — initials avatar.
 */
export const InternalGroupChat: Story = {
	args: {
		...baseIdentity,
		userId: 'consultant-2',
		username: 'team.lead',
		displayName: 'Team Lead',
		firstName: 'Team',
		lastName: 'Lead',
		isGroup: true,
		isUserMessage: false
	}
};

/**
 * Client in a group chat — group context overrides animal; shows initials.
 */
export const ClientInGroupChat: Story = {
	args: {
		...baseIdentity,
		isGroup: true,
		isUserMessage: true
	}
};

/**
 * All chat avatar variants side by side for quick comparison.
 */
export const AllVariants: Story = {
	decorators: [],
	render: () => {
		const variants = [
			{
				label: 'Client 1-on-1',
				props: {
					isGroup: false,
					isUserMessage: true,
					isSystemNotification: false,
					userId: 'user-1',
					username: 'sanftes.alpaka',
					displayName: 'Sanftes Alpaka',
					size: 32
				}
			},
			{
				label: 'Consultant 1-on-1 (animal)',
				props: {
					isGroup: false,
					isUserMessage: false,
					isSystemNotification: false,
					userId: 'consultant-1',
					username: 'karina.p',
					displayName: 'Karina P',
					firstName: 'Karina',
					lastName: 'P',
					size: 32
				}
			},
			{
				label: 'Internal Group',
				props: {
					isGroup: true,
					isUserMessage: false,
					isSystemNotification: false,
					userId: 'consultant-2',
					username: 'angela.k',
					displayName: 'Angela K',
					firstName: 'Angela',
					lastName: 'K',
					size: 32
				}
			},
			{
				label: 'Client in Group',
				props: {
					isGroup: true,
					isUserMessage: true,
					isSystemNotification: false,
					userId: 'user-2',
					username: 'freundliche.katze',
					displayName: 'Freundliche Katze',
					size: 32
				}
			}
		];

		return (
			<div
				style={{
					display: 'flex',
					gap: '32px',
					alignItems: 'flex-start',
					padding: '24px'
				}}
			>
				{variants.map((variant) => (
					<div
						key={variant.label}
						style={{
							display: 'flex',
							flexDirection: 'column',
							alignItems: 'center',
							gap: '8px'
						}}
					>
						<div
							style={{
								width: '48px',
								height: '48px',
								border: '10px solid #fff',
								borderRadius: '999px',
								background: '#ffd9d9',
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								boxSizing: 'border-box'
							}}
						>
							<MessageAvatar {...variant.props} />
						</div>
						<small style={{ fontSize: '11px', color: '#666' }}>
							{variant.label}
						</small>
					</div>
				))}
			</div>
		);
	}
};
