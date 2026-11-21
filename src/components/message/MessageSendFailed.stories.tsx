import type { CSSProperties } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { MessageSendFailed } from './MessageSendFailed';

const meta = {
	id: 'components-chat-messagesendfailed',
	title: 'Chat/System messages/Delivery failure',
	component: MessageSendFailed,
	tags: ['autodocs'],
	parameters: {
		layout: 'padded'
	}
} satisfies Meta<typeof MessageSendFailed>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	name: 'Sending message failed',
	args: {
		messageTime: String(new Date('2026-07-10T12:54:00').getTime())
	},
	play: async ({ canvasElement }) => {
		const avatar = canvasElement.querySelector<HTMLElement>(
			'.messageItem__avatar--failure'
		)!;
		// Same 6px surface frame as every chat avatar; no separate outline.
		expect(getComputedStyle(avatar).borderTopWidth).toBe('6px');
		expect(getComputedStyle(avatar, '::after').content).toBe('none');
	}
};

export const DecryptionFailure: Story = {
	name: 'Incoming message decryption failed',
	args: {
		messageTime: String(new Date('2026-07-10T12:54:00').getTime()),
		isDecryptionFailure: true
	}
};

export const CustomTheme: Story = {
	name: 'Failure avatar on a custom chat surface',
	decorators: [
		(Story) => (
			<div
				style={
					{
						'--m3-outline-variant': '#314f69',
						'--m3-surface-container-lowest': '#e6f0f8',
						'background': '#e6f0f8'
					} as CSSProperties
				}
			>
				<Story />
			</div>
		)
	],
	args: { isDecryptionFailure: true },
	play: async ({ canvasElement }) => {
		const avatar = canvasElement.querySelector<HTMLElement>(
			'.messageItem__avatar--failure'
		)!;
		// The frame takes the custom chat surface, not a hard-coded white.
		expect(getComputedStyle(avatar).borderTopWidth).toBe('6px');
		expect(getComputedStyle(avatar, '::after').content).toBe('none');
		expect(getComputedStyle(avatar).backgroundColor).toBe(
			'rgb(230, 240, 248)'
		);
	}
};
