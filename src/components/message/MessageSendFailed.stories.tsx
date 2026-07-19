import type { Meta, StoryObj } from '@storybook/react';
import { MessageSendFailed } from './MessageSendFailed';

const meta = {
	title: 'Components/Chat/MessageSendFailed',
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
	}
};
