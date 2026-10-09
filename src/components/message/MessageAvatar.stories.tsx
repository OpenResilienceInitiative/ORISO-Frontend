import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, waitFor } from 'storybook/test';
import { AVATAR_SIZES, AVATAR_SIZE_OPTIONS } from '../pseudonym/avatarSizes';
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
		isSystemNotification: {
			control: 'boolean',
			description: 'System notifications render no avatar here'
		},
		size: {
			control: 'select',
			options: AVATAR_SIZE_OPTIONS,
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
	size: AVATAR_SIZES.message,
	isSystemNotification: false
};

/**
 * Client in a 1-on-1 chat — shows the generated animal pseudonym avatar.
 * Uses the same48px shared message size as the real timeline.
 */
export const ClientIn1on1Chat: Story = {
	args: {
		...baseIdentity,
		isGroup: false
	},
	play: async ({ canvasElement }) => {
		await waitFor(() => {
			// `.messageItem__avatar` is the wrapper MessageItemComponent puts
			// around this component — it does not exist when the avatar is
			// rendered on its own, which is what this story does.
			const svg = canvasElement.querySelector('svg');
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
		isGroup: false
	},
	play: async ({ canvasElement }) => {
		await waitFor(() => {
			// See ClientIn1on1Chat: this component renders the avatar directly,
			// without MessageItemComponent's `.messageItem__avatar` wrapper.
			expect(canvasElement.querySelector('svg')).toBeTruthy();
		});
	}
};

/**
 * Consultant or moderator in an internal group chat — animal avatar.
 */
export const InternalGroupChat: Story = {
	args: {
		...baseIdentity,
		userId: 'consultant-2',
		username: 'team.lead',
		displayName: 'Team Lead',
		firstName: 'Team',
		lastName: 'Lead',
		isGroup: true
	}
};

/**
 * Client in a group chat — uses the same animal identity in the group.
 */
export const ClientInGroupChat: Story = {
	args: {
		...baseIdentity,
		isGroup: true
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
					isSystemNotification: false,
					userId: 'user-1',
					username: 'sanftes.alpaka',
					displayName: 'Sanftes Alpaka',
					size: AVATAR_SIZES.message
				}
			},
			{
				label: 'Consultant 1-on-1 (animal)',
				props: {
					isGroup: false,
					isSystemNotification: false,
					userId: 'consultant-1',
					username: 'karina.p',
					displayName: 'Karina P',
					firstName: 'Karina',
					lastName: 'P',
					size: AVATAR_SIZES.message
				}
			},
			{
				label: 'Internal Group (animal)',
				props: {
					isGroup: true,
					isSystemNotification: false,
					userId: 'consultant-2',
					username: 'angela.k',
					displayName: 'Angela K',
					firstName: 'Angela',
					lastName: 'K',
					size: AVATAR_SIZES.message
				}
			},
			{
				label: 'Client in Group',
				props: {
					isGroup: true,
					isSystemNotification: false,
					userId: 'user-2',
					username: 'freundliche.katze',
					displayName: 'Freundliche Katze',
					size: AVATAR_SIZES.message
				}
			}
		];

		return (
			<div
				style={{
					display: 'flex',
					gap: '32px',
					flexWrap: 'wrap',
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
						<MessageAvatar {...variant.props} />
						<small style={{ fontSize: '11px', color: '#666' }}>
							{variant.label}
						</small>
					</div>
				))}
			</div>
		);
	}
};

/**
 * The 60px message frame draws the white ring (Figma 7539-29194, 6px) on BOTH
 * sides; the animal circle inside it stays 48px and carries no grey outline.
 */
export const WhiteRingOnBothSides: Story = {
	args: { ...baseIdentity, isGroup: false, size: undefined },
	render: (args) => (
		<div style={{ display: 'flex', gap: 48, padding: 24 }}>
			{(['left', 'right'] as const).map((side) => (
				<div key={side} className={`messageItem messageItem--${side}`}>
					<div
						className="messageItem__avatar"
						data-testid={`message-avatar-frame-${side}`}
					>
						<MessageAvatar {...args} />
					</div>
				</div>
			))}
		</div>
	),
	play: async ({ canvasElement }) => {
		for (const side of ['left', 'right']) {
			const frame = canvasElement.querySelector(
				`[data-testid="message-avatar-frame-${side}"]`
			) as HTMLElement;
			const frameStyle = getComputedStyle(frame);
			expect(parseFloat(frameStyle.borderTopWidth)).toBe(6);
			expect(frameStyle.borderTopColor).toBe('rgb(255, 255, 255)');
			expect(frameStyle.backgroundColor).toBe('rgb(255, 255, 255)');
			expect(frame.getBoundingClientRect().width).toBe(60);
			const person = frame.querySelector(
				'[data-testid="user-avatar"]'
			) as HTMLElement;
			const circle = person.firstElementChild as HTMLElement;
			expect(parseFloat(getComputedStyle(circle).borderTopWidth)).toBe(0);
			expect(getComputedStyle(circle).boxShadow).toBe('none');
			expect(person.getBoundingClientRect().width).toBe(48);
			expect(circle.getBoundingClientRect().width).toBe(48);
			await waitFor(() =>
				expect(circle.querySelector('svg')).toBeTruthy()
			);
		}
	}
};

/** Same person at every maintained footprint; the animal circle itself has no grey outline. */
export const SupportedSizes: Story = {
	render: () => (
		<div
			style={{
				display: 'flex',
				flexWrap: 'wrap',
				gap: 24,
				width: 320,
				maxWidth: '100%'
			}}
		>
			{AVATAR_SIZE_OPTIONS.map((size) => (
				<figure key={size} style={{ margin: 0, textAlign: 'center' }}>
					<MessageAvatar
						{...baseIdentity}
						isGroup={false}
						size={size}
					/>
					<figcaption>{size}px</figcaption>
				</figure>
			))}
		</div>
	),
	play: async ({ canvasElement }) => {
		const avatars = canvasElement.querySelectorAll(
			'[data-testid="user-avatar"]'
		);
		expect(avatars.length).toBe(AVATAR_SIZE_OPTIONS.length);
		const backgrounds: string[] = [];
		for (const [index, avatar] of Array.from(avatars).entries()) {
			const circle = avatar.firstElementChild as HTMLElement;
			expect(avatar.getBoundingClientRect().width).toBe(
				AVATAR_SIZE_OPTIONS[index]
			);
			expect(avatar.getBoundingClientRect().height).toBe(
				AVATAR_SIZE_OPTIONS[index]
			);
			expect(getComputedStyle(circle).borderTopWidth).toBe('0px');
			backgrounds.push(getComputedStyle(circle).backgroundColor);
			await waitFor(() =>
				expect(circle.querySelector('svg')).toBeTruthy()
			);
		}
		expect(new Set(backgrounds).size).toBe(1);
		const host = avatars[0].parentElement!.parentElement!;
		expect(host.scrollWidth).toBeLessThanOrEqual(host.clientWidth);
		for (const avatar of avatars)
			expect(avatar.getBoundingClientRect().right).toBeLessThanOrEqual(
				host.getBoundingClientRect().right
			);
	}
};
